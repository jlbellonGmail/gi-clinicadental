# Decision: 15-observabilidad-y-operacion — Observabilidad y operación

## Estado

Construcción terminada. **Pendiente de auditoría independiente de
OpenCode.** Sin PR, sin merge, sin tag, sin `[-]` ni `[x]` en
`ROADMAP.md`, y sin `audit-1.md` escrito por el constructor.

## Evidencias

- `runs/15-observabilidad-y-operacion/spec.md` (plan aprobado en HITL 1)
- `runs/15-observabilidad-y-operacion/test-report-1.md`
- `docs/tecnica/observabilidad-y-operacion.md`
- `docs/usuario/observabilidad-y-operacion.md`

## Decisiones demostrables

### La lista blanca es la defensa primaria, no la sanitización

El plan original proponía un campo `detalle` con el mensaje de error
redactado por una función `redactar()`. El HITL 1 lo rechazó, y con razón:
una lista negra de patrones nunca es completa. El diseño final invierte la
carga — `api/_lib/logger.js` declara **13 campos** y descarta toda clave
que no esté en esa lista y todo valor que no pase el validador de su
campo. **Ningún campo acepta texto libre**, de modo que no existe un camino
por el cual un mensaje de error llegue a un log: no hay dónde ponerlo.

`redactar()` no sobrevivió como concepto separado: se disolvió en los
validadores por campo. El patrón de token (`[A-Za-z0-9_.-]{1,64}`) no
trunca, **reemplaza por `no_valido`**, para no dejar pasar fragmentos: un
email contiene `@` y una frase contiene espacios, así que ninguno de los
dos sobrevive ni parcialmente.

### `metadatosDeError()` es el único punto que mira un error

Lee exclusivamente `name`, `code` y `responseCode`. Nunca `message`,
`details`, `hint`, `response`, `stack` ni `query`. El objeto de error no
sale de esa función, y `api/leads.js` no lo toca directamente en ningún
lado.

### El defecto real que esto corrige

No es una precaución teórica. En el `api/leads.js` de partida, **cinco**
`console.error` serializaban el objeto de error completo (líneas 620, 647,
653, 689 y 815). El más grave es el del INSERT: un error de Postgres
incluye los valores de la fila en su detalle — `Key (email)=(...) already
exists`, `Failing row contains (...)` —, de modo que **nombre, email,
teléfono y mensaje del paciente se habrían publicado en los Runtime Logs
de Vercel** ante una violación de unicidad. El test `f15: un error de
INSERT con PII en details/hint solo loguea metadatos` reproduce ese
escenario exacto y verifica que no queda nada.

### `respond()` como único punto de instrumentación

`validacion_rechazada` y `solicitud_finalizada` se emiten desde
`respond()`, el único choke point por el que pasan todas las respuestas.
Instrumentar ahí cubre los ~25 sitios que llaman a `respond()` sin tocarlos
uno por uno, y hace imposible que una respuesta futura quede sin registrar.

El orden resultó compatible con un contrato preexistente: en los rechazos
de la feature 04, `logRejection()` corre antes de `respond()`, así que
`lead_rechazado` sigue siendo el primer `warn` — cuatro tests existentes lo
leen como `warnCalls[0]` y siguen pasando sin modificarse.

### Log injection: un hallazgo de la inspección

El caso `propiedad_desconocida` responde con `campo: unknownKey`, donde
`unknownKey` es **una clave del JSON entrante**, es decir texto controlado
por quien llama. Loguearla verbatim habría sido texto no acotado y un
vector de inyección en los logs. Por eso `campo` se valida contra la lista
de campos conocidos del lead y cae a `no_permitido`. `metodo` recibe el
mismo tratamiento contra los métodos HTTP conocidos. La respuesta HTTP al
cliente **no cambia**: sigue devolviendo la clave, como antes.

### Sin `email_hash` (restricción del HITL 2)

Se eliminó del esquema. La correlación se hace con `request_id` y, cuando
existe, `lead_id`. No apareció ninguna necesidad operativa imprescindible
que justificara un identificador derivado del email: la detección de
duplicados ya registra `lead_id`, que es un identificador técnico y
suficiente.

### La huella no deriva de ningún texto (restricción del HITL 2)

`huella = sha256(evento | tipo | codigo | smtp_response_code)` truncado a
16 hex. **`err.message` no participa**, ni ningún otro texto
potencialmente sensible. Agrupa recurrencias del mismo tipo de fallo sin
poder reconstruir su contenido, y el test `la huella NO depende del mensaje
del error` lo fija: dos errores con mensajes distintos pero mismos
metadatos producen la misma huella.

Como `evento` participa del hash, el mismo error SMTP produce huellas
distintas para la clínica y para el paciente. Es intencional: permite
distinguir cuál de los dos envíos falla.

### Sin `X-Request-Id` en la respuesta (restricción del HITL 3)

El plan original lo proponía para que un paciente pudiera citarlo en
soporte. No se pudo demostrar una necesidad operativa concreta: ningún
procedimiento del runbook lo requiere, y la correlación externa se resuelve
con `lead_id` y marca temporal. Se priorizó **no alterar la superficie
HTTP**. El test `f15: la superficie HTTP no cambia` fija que la respuesta
siga trayendo únicamente `Content-Type` y un body `{ id }`.

### Sin servicios externos de observabilidad ni dependencias nuevas

Una línea JSON por evento a `stdout`/`stderr`, que Vercel ya captura como
Runtime Logs. `api/_lib/logger.js` usa sólo `crypto.randomUUID()` y
`crypto.createHash()` del runtime. No se agregó ningún paquete.

### Sin nivel `debug`

En un entorno serverless no habría forma de activarlo sin un redeploy, así
que un nivel que nunca se puede encender en el momento en que se lo
necesita es peso muerto. Tres niveles: `info`, `warn`, `error`.

### Costo aceptado: se pierde el texto diagnóstico

Ante un error no catalogado quedan `tipo`, `codigo` y `huella`, no la
frase. Es el precio de la garantía de no publicar PII, y se asume
explícitamente por mandato del HITL. Mitigación: la huella permite contar
recurrencias y reconocer un fallo ya diagnosticado por otra vía. Queda
registrado como decisión, no como olvido, y es reversible si en el futuro
se decide otra cosa.

### No se documenta un "reenvío manual" que no existe (restricción del HITL 5)

No hay hoy ningún mecanismo real ni soportado para reenviar una
notificación fallida. El runbook lo dice con todas las letras en vez de
describir un procedimiento inventado: la recuperación consiste en detectar
la fila con el flag en `false` y que alguien de la clínica contacte al
paciente con los datos que ya ve en el panel.

Además advierte que **volver a completar el formulario no sirve como
reenvío**: dentro de los 5 minutos devuelve el lead existente sin mandar
correo, y pasados los 5 minutos crea un duplicado que hay que limpiar a
mano. Un reenvío real queda declarado como brecha y candidato a feature
futura.

### Rotación de credenciales en el orden correcto (restricción del HITL 4)

**Crear nueva → configurar en Vercel → redeploy → verificar → revocar
anterior**, cuando el proveedor permita coexistencia. Si el paso de
verificación falla, la credencial vieja sigue viva y no hay servicio caído.

El redeploy es obligatorio, no opcional: tanto el cliente de Supabase
(`api/_lib/supabase-client.js`) como el transporter de Nodemailer
(`api/_lib/mailer.js`) se cachean a nivel de módulo, así que una instancia
caliente seguiría usando la credencial vieja hasta reiniciarse.

Se documenta también el camino para el proveedor que **no** permita
coexistencia (típicamente un cambio de contraseña SMTP): ventana de baja
actividad, cambio, actualización, redeploy, verificación, y revisión
posterior de los leads que hayan quedado sin aviso. **No se afirma si
Ferozo o Supabase permiten coexistencia**: el runbook lo marca como
verificación previa obligatoria, no como dato.

### Retención de logs: no se inventa un número

Cuánto tiempo Vercel conserva los Runtime Logs depende del plan
contratado. Ambos documentos lo marcan como verificación en el panel en
lugar de afirmar una cifra que podría ser falsa, y aclaran que la fuente de
verdad del negocio es la tabla `leads`, no los logs.

### Worktree propio

La feature se construyó en `../worktrees/observabilidad-y-operacion/`
sobre la rama `feature/15-observabilidad-y-operacion`, como pide
`AGENTS.md` — a diferencia de la feature 14, que se ejecutó en el checkout
principal.

## Desviación de proceso declarada

`AGENTS.md` define 4 subagentes sin HITL intermedio. Esta ejecución usó el
circuito que indicó el humano: Claude Code construye → OpenCode audita en
solo lectura → Claude corrige → OpenCode reaudita, con un HITL sobre el
plan antes de implementar. **No se invocó `reviewer-agent` ni ningún
auditor sustituto**, y `audit-1.md` no lo escribió el constructor: se
persistirá con el resultado de OpenCode.

Se declara acá en vez de aplicarse en silencio, como exige `AGENTS.md`.

## Resultado

Construcción completa y verificada: `npm test` 202/202 y `pytest` 33/33.
La feature queda lista para la auditoría independiente de OpenCode.
