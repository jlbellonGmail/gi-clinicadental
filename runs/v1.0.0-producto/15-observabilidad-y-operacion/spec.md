# Spec: 15-observabilidad-y-operacion

Origen: ítem 15 de `ROADMAP.md`. Este documento es el plan aprobado por el
humano en el HITL 1 de esta ejecución, incorporando los ajustes que exigió
antes de autorizar la implementación.

## Nota de proceso (desviación declarada)

`AGENTS.md` define un circuito de 4 subagentes sin HITL intermedio. Esta
ejecución usó otro flujo, por instrucción explícita del humano, y se
declara en vez de aplicarse en silencio:

- Claude Code construye → **OpenCode audita en solo lectura** → Claude
  corrige → OpenCode reaudita.
- **No se invocó `reviewer-agent` ni ningún auditor sustituto.**
- `audit-1.md` **no lo escribe el constructor**: se persistirá fielmente
  con el resultado de la auditoría externa de OpenCode.
- Hubo un HITL adicional sobre el plan (HITL 1), previo a implementar.

Consecuencia de secuencia: `Assert-FeatureContract` exige al menos un
`audit-*.md`, y `ready-for-pr.ps1` lo invoca antes de crear la PR. Por eso
la construcción cierra **sin PR y sin `[-]` en `ROADMAP.md`**; ambos pasos
quedan detrás de la auditoría de OpenCode.

## Objetivo

Incorporar logs estructurados y seguros a `POST /api/leads`, e implantar
procedimientos de operación para diagnóstico, recuperación, rotación de
credenciales, revisión de leads pendientes y detección de notificaciones
fallidas, usando el panel protegido de Supabase para administrar los
estados `nuevo`, `contactado`, `confirmado` y `descartado`.

## Fuera de alcance

Panel administrativo propio; autenticación o backoffice; servicios
externos de observabilidad; cambios de funcionalidad de negocio de otras
features; el ítem 16 del roadmap.

## Estado de partida verificado

- Un único evento estructurado existente: `logRejection()` →
  `lead_rechazado` con `ip_hash` (feature 04).
- 13 `console.error('[api/leads] …')` ad-hoc, sin correlación ni formato.
- **Cinco de ellos serializaban el objeto de error completo** (líneas 620,
  647, 653, 689 y 815 del `api/leads.js` de partida). El más grave es el
  del INSERT: un error de Postgres incluye los valores de la fila en su
  detalle (`Key (email)=(...)`, `Failing row contains (...)`), es decir
  nombre, email, teléfono y mensaje del paciente.
- `respond()` es el único choke point de todas las respuestas HTTP.
- Identificadores disponibles: `leads.id` (uuid), flags
  `notificacion_clinica_enviada` / `confirmacion_paciente_enviada`, y
  `estado` con `check` de cuatro valores.

## Diseño

### Política de logging (endurecida en el HITL 1)

**La defensa primaria es la lista blanca de campos, no la sanitización.**
Ningún campo del esquema acepta texto libre.

Prohibido registrar, en ningún canal: `err.message`,
`PostgrestError.details`, `.hint`, query, payload, `err.response`, objetos
`Error`, stack traces, headers, cookies, variables de entorno,
contraseñas, claves, tokens, y nombre/email/teléfono/mensaje del paciente.

`metadatosDeError()` es el único punto que mira un error, y lee sólo
`name`, `code` y `responseCode`.

### Correlación

`request_id` (`crypto.randomUUID()`) en todos los eventos de la request;
`lead_id` desde que Supabase lo devuelve. **No se usa `email_hash`**
(restricción del HITL 2: eliminado del esquema por no existir necesidad
operativa imprescindible). **No se agrega `X-Request-Id` a la respuesta
HTTP**: no se demostró necesidad operativa y se prioriza no alterar la
superficie HTTP.

### Huella de agrupación

`huella = sha256(evento | tipo | codigo | smtp_response_code)` truncado a
16 hex. **No participa `err.message` ni ningún otro texto potencialmente
sensible** (restricción del HITL 2). Sirve para contar y agrupar
recurrencias, no para reconstruir contenido.

### Formato y niveles

Una línea JSON por evento a `stdout`/`stderr`, capturada por Vercel como
Runtime Log. Campos base: `timestamp`, `nivel`, `evento`, `request_id`.
Niveles `info` / `warn` / `error` → `console.log` / `warn` / `error`. Sin
`debug`.

### Eventos

`solicitud_recibida`, `validacion_aceptada`, `validacion_rechazada`,
`lead_rechazado`, `duplicado_detectado`, `supabase_cliente_error`,
`supabase_duplicados_error`, `supabase_insercion_ok`,
`supabase_insercion_error`, `smtp_configuracion_error`, `smtp_clinica_ok`,
`smtp_clinica_error`, `smtp_paciente_ok`, `smtp_paciente_error`,
`flag_actualizacion_error`, `error_no_controlado`, `solicitud_finalizada`.

### Log injection

`campo` se valida contra la lista de campos conocidos del lead y cae a
`no_permitido`: el caso `propiedad_desconocida` devuelve una clave tomada
del JSON entrante, es decir texto controlado por quien llama. `metodo` se
valida contra los métodos HTTP conocidos.

## Criterios de aceptación

1. Existe `api/_lib/logger.js`, sin dependencias nuevas, que impone la
   lista blanca y descarta toda clave o valor no declarado.
2. `api/leads.js` no contiene ningún `console.*` directo.
3. Se emiten los 17 eventos del catálogo, con los niveles indicados.
4. Todos los eventos de una request comparten un único `request_id`; los
   posteriores a la inserción llevan `lead_id`.
5. Ningún log contiene PII del paciente, secretos, texto libre de error ni
   IP en claro.
6. Un error de Supabase con PII en `message`/`details`/`hint` no filtra
   nada de eso; sí se registra su SQLSTATE.
7. Un fallo SMTP registra `codigo` y `smtp_response_code`, nunca la
   respuesta del servidor.
8. La superficie HTTP no cambia: mismos status, body `{ id }`, y sin
   headers nuevos.
9. La funcionalidad preexistente se preserva: la suite existente pasa sin
   modificar sus assertions.
10. `lead_rechazado` sigue siendo el primer `warn` en los rechazos de la
    feature 04.
11. Existe `docs/tecnica/observabilidad-y-operacion.md` con arquitectura,
    formato de eventos, campos, niveles, correlación, política de
    redacción, dónde consultar logs en Vercel y diagnóstico
    Supabase/SMTP.
12. Existe `docs/usuario/observabilidad-y-operacion.md` con detección de
    leads pendientes y de notificaciones fallidas, administración de los
    cuatro estados en Supabase, procedimiento de recuperación y rotación
    de credenciales.
13. La rotación se documenta en el orden: crear nueva → configurar en
    Vercel → redeploy → verificar → revocar anterior, cuando el proveedor
    permita coexistencia; con el camino alternativo cuando no la permita.
14. **No se documenta ningún "reenvío manual"**: no existe hoy un
    mecanismo real y soportado. Se documenta la brecha explícitamente.
15. Existe `runs/15-observabilidad-y-operacion/decision.md` con decisiones
    demostrables.
16. Existe `runs/15-observabilidad-y-operacion/test-report-1.md` con
    resultados reales y muestras de log capturadas.
17. Enlace exacto en `docs/tecnica/index.md` y en `docs/usuario/index.md`.
18. No se inventan valores de credenciales ni datos de pacientes.

## Riesgos y supuestos

- **Pérdida de texto diagnóstico**: ante un error no catalogado quedan
  `tipo`, `codigo` y `huella`, no la frase. Costo aceptado por mandato
  explícito, documentado como decisión.
- **La lista blanca es la garantía**: si se agrega un campo de texto libre
  en el futuro, la protección se degrada. Mitigado con un test que fija la
  lista completa.
- **Retención de Runtime Logs**: depende del plan de Vercel. Se documenta
  como verificación obligatoria, no se inventa un número.
- `ip_hash` no es irreversible frente a quien pruebe rangos de IP:
  limitación ya asumida en la feature 04.
- La observabilidad no reemplaza a la tabla `leads` como fuente de verdad.
