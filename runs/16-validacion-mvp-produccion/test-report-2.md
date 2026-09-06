# Test report 2 — Validación del MVP en Production

**Etapa**: 16-validacion-mvp-produccion, paso 5 de la secuencia.
**Fecha**: 2026-09-05.
**Autor**: Claude Code.

```yaml
status: rechazado
attempt: 1
resultado: BLOQUEADO — la validacion funcional no puede completarse
bloqueantes:
  - "POST /api/leads devuelve HTTP 500 error_interno en Production: ningun lead se crea y no se envia ningun correo"
  - "La marca de plantilla anterior sigue publicamente visible, incrustada en los pixeles de 2 de las 3 imagenes principales"
estado_bloqueantes:
  bloqueante_1: "diagnosticado (ver Anexo A) - clase A, entorno/configuracion - pendiente de accion humana"
  bloqueante_2: "CORREGIDO - PR #25, imagenes regeneradas y test de regresion agregado"
```

**El MVP no se cierra.** No se ejecuta `audit-2`, no se crea el tag y
`ROADMAP.md` permanece en `[ ]`.

## Datos del deployment validado

| | |
|---|---|
| URL Production | `https://gi-clinicadental.vercel.app` |
| SHA de `main` | `eaf4e6f95ab3f6e47c1855e01bfedb33b0b8f478` |
| Merge commit | `eaf4e6f` (PR #24, `develop → main`) |
| Candidato liberado | `26e2a682bcb0eb635c9f2d3e69c1062968cd81dd` — coincide con el SHA auditado en `audit-1` |
| Deployment de Vercel | id `6286569895`, environment `Production`, estado **`success`** |
| URL del deployment | `https://gi-clinicadental-okmrl7bll-gi26.vercel.app` |
| Fecha/hora del deployment | 2026-09-05T22:32:29Z (creado), 22:32:31Z (success) |
| Navegador desktop | Chrome (automatización Claude in Chrome), viewport 1440×900 |
| Dispositivo móvil | **no ejecutado** — ver "Alcance no cubierto" |

Workflows disparados por el release:

| Workflow | Resultado |
|---|---|
| `CI` sobre `main` @ `eaf4e6f` | ejecutado |
| `Docs` sobre `main` @ `eaf4e6f` | **success** |
| `post-merge-close-feature.yml` | no se disparó (sólo escucha base `develop`), como estaba previsto |

## Resumen de resultados

| # | Verificación | Resultado |
|---|---|---|
| V1 | Sitio público | ⚠️ **parcial** — todo correcto salvo la marca en las imágenes |
| V2 | Consentimiento obligatorio | ✅ **PASS** |
| V3 | Envío desde la UI real | ✅ ejecutado |
| V4 | Respuesta de la API | ❌ **FAIL — HTTP 500** |
| V5 | Lead en Supabase | ⛔ no alcanzable |
| V6 | Correo a la clínica | ⛔ no alcanzable |
| V7 | Correo al paciente | ⛔ no alcanzable |
| V8 | Flags y estado | ⛔ no alcanzable |
| V9 | Logs estructurados | ⛔ requiere acceso humano al panel |
| V10 | Ausencia de PII/secretos | ⛔ requiere acceso humano al panel |
| V11 | Desktop | ⚠️ parcial — render OK, circuito falla |
| V12 | Móvil | ⛔ no ejecutado |
| N1 | `GET /api/leads` → 405 | ✅ **PASS** |
| N2 | Formulario sin consentimiento | ✅ **PASS** |

---

## V1 — Sitio público

El release **sí llegó a Production**, y eso está probado por el cambio de
estado respecto de la línea de base registrada en `test-report-1.md`:

| Sonda | Antes del release | Después | Resultado |
|---|---|---|---|
| `GET /` | 200 (sitio de 2026-08-19) | **200** | ✅ |
| `GET /api/leads` | **404** | **405 `metodo_no_permitido`** | ✅ |
| `GET /politica-privacidad.html` | **404** | **200** | ✅ |
| `GET /404.html` | — | **200** | ✅ |
| `GET /style.css`, `/script.js` | — | **200** | ✅ |

Cabeceras de seguridad de `vercel.json`, ausentes antes del release:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

Contenido servido, verificado sobre el HTML real de Production:

| Verificación | Resultado |
|---|---|
| `<title>` | `Sonríe más \| Tu Sonrisa, Nuestra Pasión` ✅ |
| `Savia` en el HTML de `/` | **0** ✅ |
| `Sonríe más` en el HTML de `/` | 14 ✅ |
| Aviso de demostración técnica sobre el formulario | presente y **visible en pantalla** ✅ |
| `sonriamas-contactos@nextgia.io` | presente ✅ |
| `contacto@sonrimas.com` | **0** ✅ |
| `script.js` con `// Simulate API call` | **0** ✅ |
| `script.js` con `fetch('/api/leads'` | 2 ✅ |
| `POLITICA_PRIVACIDAD_VERSION` | `v1-2026-08-20` ✅ |
| Política: placeholders `[A COMPLETAR...]` | **0** ✅ |
| Política: aviso de demo (sección 0) | presente ✅ |

Assets:

| Archivo | HTTP |
|---|---|
| `static/images/paciente-sonrisa.webp` | 200 |
| `static/images/equipo-dental.webp` | 200 |
| `static/images/interior-clinica.webp` | 200 |
| `favicon.ico` | **404** (preexistente, no bloqueante) |
| `apple-touch-icon.png` | **404** (preexistente, no bloqueante) |

### ❌ BLOQUEANTE 1 — "Savia Dental" sigue visible en público

**Las imágenes principales no son fotografías: son placeholders generados
por `create_images.py`, con texto incrustado en los píxeles.** Dos de las
tres llevan la marca vieja.

Verificado en `create_images.py`:

| Imagen | Texto incrustado |
|---|---|
| `paciente-sonrisa` | "Sonrisa" / "Perfecta" — sin marca |
| `equipo-dental` | "Equipo Dental" / **"Savia Dental"** (líneas 40-41, 49-50) |
| `interior-clinica` | "Interior Clínica" / **"Savia Dental"** (líneas 59-60, 66-67) |

Confirmado visualmente en el sitio en producción: la imagen de la sección
de contacto muestra en pantalla, en texto legible, *"Interior Clínica"* y
*"Savia Dental"*.

**Por qué se nos pasó, y es lo importante del hallazgo**: todas las
verificaciones de marca —las mías, las del preflight P8 y las de
`audit-1`— se hicieron con `grep` sobre HTML. **Un `grep` no puede leer
texto rasterizado dentro de un `.webp`.** El criterio "0 ocurrencias de
Savia Dental" se cumplía en el código y era falso en la pantalla.

Esto contradice directamente el criterio V1 *"cero referencias públicas
actuales a Savia Dental"*, y el humano ya declaró esa exposición
**bloqueante** para el primer release estable.

**Hallazgo adicional relacionado**: las tres imágenes son rectángulos de
color con texto, no material fotográfico. La feature 09 declaraba
"incorporar recursos visuales con licencia válida"; lo que hay son
placeholders. No se corrige por cuenta propia: conseguir imágenes reales
requiere insumos que este agente no puede inventar (`AGENTS.md`, reglas
de dominio).

---

## V2 — Consentimiento obligatorio ✅ PASS

Con nombre y email completados y el checkbox **sin marcar**, el envío
quedó bloqueado por la validación nativa del navegador, con el mensaje
*"Selecciona esta casilla de verificación si quieres continuar"*.

No se emitió ninguna petición a `/api/leads`. La API nunca se entera del
intento, que es exactamente el comportamiento esperado.

## V3 / V4 — Envío desde la UI real ❌ FAIL

Ejecutado desde la interfaz pública real (no por `curl`), con el dataset
sintético aprobado:

| Campo | Valor |
|---|---|
| `nombre` | `PRUEBA MVP16 DESKTOP` |
| `email` | `jlbellon+desktop@gmail.com` |
| `servicio` | `otro` |
| `mensaje` | `PRUEBA SINTETICA MVP16 DESKTOP - no es un paciente real - no contactar - 2026-09-05T22:54Z` |
| consentimiento | marcado |

**Resultado:**

```
POST https://gi-clinicadental.vercel.app/api/leads  →  HTTP 500
{"error":"error_interno"}
```

El botón mostró *"Error en la conexión, intente más tarde"*, que es el
estado de error definido por la feature 08.

**No se creó ningún lead y no se envió ningún correo.** V5, V6, V7 y V8
quedan fuera de alcance por dependencia.

### Diagnóstico: dónde falla exactamente

El fallo se acotó desde fuera, sin acceso al panel, probando cada capa por
separado contra Production:

| Prueba | Resultado | Qué demuestra |
|---|---|---|
| `GET /api/leads` | **405** `metodo_no_permitido` | La función serverless existe y responde |
| `POST` con `{"foo":"bar"}` | **400** `propiedad_desconocida`, `campo: foo` | La capa de validación funciona |
| `POST` con `nombre` de 1 carácter | **400** `longitud_excedida`, `campo: nombre` | Las reglas de longitud funcionan |
| `POST` con `Origin: https://ejemplo-no-permitido.test` | **403** `origen_no_permitido` | La validación de origen funciona **y rechaza correctamente** |
| `POST` válido con `Origin` real | **500** `error_interno` | **El origen real SÍ se acepta**; falla después |

**El riesgo R1 (origen) queda descartado en vivo**: un origen ajeno da 403
y el origen real pasa. `SITE_URL` / `ALLOWED_ORIGINS` están bien.

Todo lo anterior a Supabase funciona. El fallo está en la etapa de
Supabase: inicialización del cliente, `SELECT` de duplicados o `INSERT`.
Los tres devuelven el mismo `error_interno` al cliente, por diseño.

### Señal que acota más: el fallo es inmediato

Comparación de tiempos de respuesta contra Production, 3 intentos cada
uno:

| Ruta | Tiempos |
|---|---|
| `400` (validación puramente local, sin red externa) | 0.447s, 0.436s, 0.455s |
| `500` (etapa Supabase) | 0.430s, 0.434s, 0.464s |

**Son indistinguibles.** Si la petición hubiera llegado a Supabase, el
`SELECT` de duplicados habría añadido un viaje de red medible. No lo
añade.

**Interpretación —declarada como inferencia, no como hecho confirmado**:
el fallo ocurre **antes de cualquier llamada de red**, lo que apunta a
`getSupabaseClient()` lanzando en `api/_lib/supabase-client.js`, que es lo
que sucede cuando `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`
están **ausentes, vacías o malformadas en el entorno Production del
deployment servido**. El evento correspondiente sería
`supabase_cliente_error`.

**Sólo los Runtime Logs pueden confirmarlo**, y su lectura requiere acceso
humano al panel de Vercel. Esto no es una limitación del diagnóstico: es
precisamente el caso de uso para el que se construyó la feature 15.

### Clasificación del fallo

**Clase A — entorno / configuración.** Según la estrategia acordada:
**no se toca código**. La corrección es del humano en el panel, con
redeploy obligatorio, y luego se repite la validación con dataset nuevo.

Hay una tensión que conviene señalar sin adornos: el preflight **P3
registró esas variables como configuradas**, sobre la palabra del humano,
porque este agente no tiene —ni debe tener— acceso a los valores. Las
hipótesis compatibles con ambas cosas, en orden de probabilidad:

1. **Las variables existen pero el deployment servido se construyó antes
   de que estuvieran disponibles.** Vercel inyecta las variables en el
   momento del build: una variable agregada después no llega a un
   deployment ya construido. **Requiere redeploy**, no basta con
   guardarlas. Es además el mismo motivo por el que la feature 15 declara
   el redeploy obligatorio: el cliente de Supabase se cachea a nivel de
   módulo.
2. **Están cargadas en el entorno equivocado** (Preview y no Production,
   o sólo en uno de los dos).
3. **Error de nombre o valor vacío** en alguna de las dos.

**R3 se materializó.** Estaba anotado como riesgo desde el principio: *"El
único deployment Production es previo a la existencia de `api/`: esas
credenciales nunca se usaron."* Ésta fue la primera ejecución real del
endpoint contra Supabase en toda la historia del proyecto, y falló en el
primer intento. El riesgo estaba bien identificado.

## V5 / V6 / V7 / V8 — No alcanzables

Dependen de un `201` que no ocurrió. La tabla `leads` sigue vacía, y no se
envió ningún correo ni a la clínica ni al paciente.

## V9 / V10 — Requieren acceso humano

Los Runtime Logs de Vercel no son accesibles desde este entorno: no hay
CLI de Vercel instalada ni token disponible, y no se solicitó ninguno.

Lo que hay que buscar en **Vercel → el proyecto → Logs → función
`api/leads` → entorno Production**, alrededor de `2026-09-05T22:54Z`:

- Qué evento de error se emitió: `supabase_cliente_error`,
  `supabase_duplicados_error`, `supabase_insercion_error` o
  `error_no_controlado`.
- Sus campos `tipo`, `codigo` y `huella`.
- Que la secuencia previa sea `solicitud_recibida` → `validacion_aceptada`,
  y que `solicitud_finalizada` traiga `http_status: 500`.
- **V10**: que en ninguna línea aparezcan en claro `nombre`, `email`,
  `telefono`, `mensaje`, la IP, `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`,
  tokens, `Authorization`, cookies, payloads ni stack traces.

V10 sigue siendo una comprobación **obligatoria** aunque el circuito haya
fallado: un fallo es justamente el escenario donde una fuga de PII es más
probable, porque es cuando se serializan objetos de error.

## V11 — Desktop ⚠️ parcial

Navegador Chrome, viewport 1440×900. Render correcto: cabecera con la
marca `Sonríe más`, secciones, tarjetas de servicios, bloque de contacto y
formulario. Las animaciones de aparición al hacer scroll funcionan.

El bloque de aviso de demostración técnica **se ve correctamente** encima
del formulario, y el checkbox de consentimiento muestra el texto nuevo
*"…y entiendo que este sitio es una demostración técnica"*.

Falla el circuito funcional (V4) y se ve la marca vieja en las imágenes
(bloqueante 1).

## V12 — Móvil ⛔ no ejecutado

**No se ejecutó a propósito.** Repetir el mismo envío desde móvil habría
producido el mismo 500 sin aportar información nueva, y habría consumido
la segunda casilla controlada (`jlbellon+movil@gmail.com`) sin obtener
evidencia útil.

Se ejecutará junto con la revalidación completa, una vez corregido el
bloqueante de configuración.

## N1 / N2 — Negativos de bajo impacto ✅ PASS

| Prueba | Esperado | Obtenido |
|---|---|---|
| `GET /api/leads` | 405 `metodo_no_permitido` | **405** `{"error":"metodo_no_permitido"}` ✅ |
| Formulario sin consentimiento | bloqueado por el frontend, sin request | bloqueado, sin request ✅ |

No se ejecutó la prueba de rate limit (6 envíos), excluida
deliberadamente: no es determinista entre instancias serverless y
generaría leads y correos innecesarios. Cubierta por `npm test`.

## Datos sintéticos generados

Ninguno llegó a persistirse, porque no hubo ningún `201`:

| Origen | Datos | Resultado |
|---|---|---|
| UI desktop | `PRUEBA MVP16 DESKTOP` / `jlbellon+desktop@gmail.com` | 500, sin fila |
| Diagnóstico `curl` | `PRUEBA MVP16 DIAG` / `jlbellon+diag@gmail.com` | 500, sin fila |
| Diagnóstico `curl` | `PRUEBA MVP16 DIAG2` / `jlbellon+diag2@gmail.com` | 500, sin fila |
| Diagnóstico `curl` ×3 | `PRUEBA MVP16 TIMING` / `jlbellon+timing@gmail.com` | 500, sin fila |

**No hay leads sintéticos que descartar**: la tabla `leads` debería seguir
vacía. Conviene confirmarlo en el panel de Supabase junto con el
diagnóstico.

## Qué hay que hacer, en orden

1. **Leer los Runtime Logs** (humano) e identificar el evento exacto.
2. **Corregir la configuración** de Production en Vercel según el evento.
3. **Forzar un redeploy** — obligatorio, no opcional: las variables se
   inyectan en el build y los clientes se cachean a nivel de módulo.
4. **Repetir la validación completa** con dataset nuevo: nombre y email
   distintos de los ya usados, para no chocar con la ventana de
   idempotencia de 5 minutos.
5. **Resolver el bloqueante de la marca en las imágenes**, que es una
   decisión de contenido del humano.
6. Sólo entonces: `audit-2`, HITL 2, tag y cierre.

## Estado del repositorio

Sin cambios respecto de lo esperado, y así debe seguir hasta que la
validación pase:

| | |
|---|---|
| `main` | `eaf4e6f` (release mergeado) |
| Tags | **0** |
| `ROADMAP.md` ítem 16 | `- [ ]` |
| `feature/16` | sin PR, sin mergear |
| `audit-2` | **no ejecutada** |

---

# Anexo A — Diagnóstico de causa raíz del 500

**Fecha**: 2026-09-05.
**Insumo humano**: log real de Production, aportado por el humano.

```
validacion_aceptada        OK
supabase_duplicados_error  tipo=sin_tipo  codigo=sin_codigo  huella=ba074af0b5975e81
solicitud_finalizada       http_status=500
```

Confirmado también por el humano: `public.leads` existe y está **vacía**
(`COUNT(*) = 0`). `supabase_duplicados_error` **no** significa que exista
un duplicado: significa que falló técnicamente el bloque que consulta
duplicados.

## A.0 — Corrección de una inferencia previa mía

En el cuerpo de este reporte escribí, a partir de una medición de
tiempos, que *"el fallo ocurre antes de cualquier llamada de red"* y que
apuntaba a `getSupabaseClient()` lanzando por variables ausentes.

**Era una inferencia demasiado fuerte y es incorrecta.** Dos motivos:

1. El evento registrado es `supabase_duplicados_error`, no
   `supabase_cliente_error`. **El cliente Supabase se creó
   correctamente**, luego `NEXT_PUBLIC_SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` **están presentes y no vacías**.
2. La diferencia de tiempos que medí (0.430-0.464s en el 500 frente a
   0.436-0.455s en el 400) está **dentro del ruido de medición**. La
   función se ejecutó en `iad1`; si Supabase está en la misma región, el
   viaje de red cabe holgadamente en ese margen. La medición no
   demostraba lo que le hice decir.

Queda corregido acá en vez de dejarlo en pie.

## A.1 — Verificación de la huella

Antes de analizar nada se comprobó que los metadatos reportados son
exactamente los que dice el log, recalculando la huella con la función
real del repositorio:

```
calcularHuella({evento:'supabase_duplicados_error', tipo:'sin_tipo', codigo:'sin_codigo'})
  → ba074af0b5975e81   ← coincide con el log
```

Combinaciones alternativas descartadas por no coincidir:

| tipo | codigo | huella |
|---|---|---|
| `sin_tipo` | `no_valido` | `4ee7bfe80bff4fbe` |
| `TypeError` | `sin_codigo` | `f8c505a8028a2015` |
| `no_valido` | `no_valido` | `244ffc2236d3d20c` |
| `Error` | `sin_codigo` | `da76ef2255630556` |

**Conclusión**: el objeto de error no tenía `name` ni `code` como
strings. En `api/_lib/logger.js`, `sin_tipo` y `sin_codigo` sólo se
producen cuando `typeof err.name !== 'string'` y
`typeof err.code !== 'string'`.

## A.2 — Respuestas a los diez puntos verificados

### 1. Qué consulta construye el código

`api/leads.js`, bloque de detección de duplicados:

```js
await supabase
  .from('leads')
  .select('id')
  .ilike('email', escapeIlikeValue(email))
  .eq('nombre', nombre)
  .gte('fecha_creacion', duplicateWindowStartIso)
  .limit(1);
```

URL real generada, reconstruida localmente con el mismo cliente y los
mismos datos de la prueba:

```
/rest/v1/leads?select=id&email=ilike.jlbellon%2Bdesktop%40gmail.com&nombre=eq.PRUEBA+MVP16+DESKTOP&fecha_creacion=gte.2026-09-05T23%3A15%3A24.961Z&limit=1
```

### 2. Qué tabla consulta

`leads`, sin esquema explícito, que resuelve a **`public.leads`** — la
misma que el humano verificó por SQL.

### 3. Qué columnas utiliza

`id` (select), `email`, `nombre`, `fecha_creacion` (filtros).

### 4. Qué filtros utiliza

`email=ilike.<valor escapado>`, `nombre=eq.<valor>`,
`fecha_creacion=gte.<ISO>`, `limit=1`.

### 5. ¿Alguna columna no existe en el esquema real?

**No.** Contrastado contra
`supabase/migrations/20260819210130_create_leads_table.sql`:

| Columna usada | Definida en la migración |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `nombre` | `text not null` |
| `email` | `text not null` |
| `fecha_creacion` | `timestamptz not null default now()` |

Las cuatro existen.

**Y hay una prueba más fuerte que la comparación**: si una columna no
existiera, PostgREST devolvería un JSON de error con
`code: "42703"`. El log habría registrado `codigo=42703`, no
`sin_codigo`. **Una columna faltante queda descartada por el propio
log.**

### 6. ¿Hay un problema en `.or()`, `.eq()`, `.gte()` u otro filtro?

**No.** El código no usa `.or()` en ningún punto. Los filtros empleados
son sintaxis PostgREST válida.

Se investigó y **descartó** una hipótesis concreta: los cuatro emails de
prueba contenían `+` (`jlbellon+desktop@`, `+diag@`, `+diag2@`,
`+timing@`), y un `+` sin codificar en un query string se decodifica como
espacio. Reconstruyendo la URL localmente se comprobó que **`postgrest-js`
lo codifica correctamente como `%2B`**. La hipótesis del `+` queda
descartada con evidencia, no por suposición.

`escapeIlikeValue()` escapa `\`, `%` y `_`; ninguno aparece en los datos
usados.

### 7. ¿El cliente Supabase se crea correctamente en Production?

**Sí.** Es la conclusión más sólida del log: si `getSupabaseClient()`
hubiera lanzado, el evento habría sido `supabase_cliente_error`, que es un
bloque `try/catch` distinto. Se registró `supabase_duplicados_error`, así
que la ejecución pasó de largo la creación del cliente.

Corolario: `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
**existen y no están vacías** en el deployment servido.

### 8. ¿La consulta usa correctamente `SUPABASE_SERVICE_ROLE_KEY`?

`api/_lib/supabase-client.js` la pasa como clave a `createClient()`, que
la envía en las cabeceras `apikey` y `Authorization` de cada petición.

**Si la clave fuera inválida o insuficiente**, PostgREST respondería
`401`/`403` con un **cuerpo JSON** (`{"message":"Invalid API key",...}` o
un error de RLS con `code: "42501"` / `"PGRST301"`). El log habría
registrado ese `codigo`. **Una clave incorrecta o RLS bloqueando también
quedan descartadas por el `sin_codigo`.**

### 9. ¿El error ocurre antes o después de llegar a Supabase?

**Después de recibir una respuesta HTTP.** No es una suposición: es la
única rama del código de `postgrest-js` que puede producir ese objeto de
error (ver punto 10), y esa rama sólo se ejecuta tras leer el cuerpo de
una respuesta con `res.text()`.

Un fallo de red puro (DNS, conexión rechazada, timeout) toma otra rama,
la del `catch(fetchError)`, que construye `code: ""` — un string vacío que
el logger habría registrado como `no_valido`, no `sin_codigo`.

### 10. Por qué el logger recibe un error sin `tipo` ni `codigo`

**Ésta es la clave del diagnóstico.** En `@supabase/postgrest-js@2.112.3`,
`processResponse()` construye el error así cuando el cuerpo de la
respuesta **no es JSON parseable**:

```js
} catch (_unused2) {
    if (res.status === 404 && body === "") { ... }
    else error = { message: body };     // ← objeto plano: sin name, sin code
}
```

Ese objeto tiene **únicamente `message`**. No es una instancia de `Error`
(no tiene `name`) y no tiene `code`.

`metadatosDeError()` en `api/_lib/logger.js` lee exactamente tres
propiedades —`name`, `code`, `responseCode`— y cae a `sin_tipo` /
`sin_codigo` cuando no son strings. De ahí el par observado.

Para contraste, un `PostgrestError` normal **sí** habría dado metadatos
útiles: la clase `extends Error` y fija `this.name = "PostgrestError"`
más `this.code` con el SQLSTATE.

## A.3 — Causa raíz

> **El endpoint contactado devolvió una respuesta HTTP cuyo cuerpo no es
> JSON.**

Todas las causas "de base de datos" quedan descartadas por el propio log,
porque **todas ellas devuelven JSON con un `code`**:

| Hipótesis | Qué habría registrado el log | Descartada |
|---|---|---|
| Columna inexistente | `codigo=42703` | ✅ |
| Tabla inexistente | `codigo=42P01` | ✅ |
| RLS bloqueando | `codigo=42501` / `PGRST301` | ✅ |
| Clave inválida | JSON con mensaje de API key | ✅ |
| Fallo de red puro | `codigo=no_valido` (string vacío) | ✅ |
| Cliente mal creado | evento `supabase_cliente_error` | ✅ |
| Duplicado real | no es un error; y la tabla está vacía | ✅ |
| **Respuesta no-JSON** | **`sin_tipo` + `sin_codigo`** | **← es ésta** |

Lo que devuelve un cuerpo no-JSON desde una URL de Supabase es,
típicamente:

1. **El proyecto Supabase está pausado.** Los proyectos gratuitos se
   pausan por inactividad y su endpoint REST responde con una página
   HTML/texto, no con JSON. **Es la hipótesis más probable**, y encaja con
   que el proyecto estuviera sin uso: la tabla está vacía y ésta fue la
   primera petición real de su historia.
2. **`NEXT_PUBLIC_SUPABASE_URL` apunta a otro sitio**: un typo, una barra
   final o una ruta de más, un dominio distinto. La petición llega a algo
   que responde HTML (un 404 de plataforma, una página de login, un
   proxy).

En ambos casos es **clase A — entorno / configuración**. Según la
estrategia acordada: **no se toca código.**

## A.4 — Comprobaciones para el humano

### Primero, la que más probablemente cierra el caso

Abrir el panel de **Supabase** y mirar si el proyecto está **activo o
pausado**. Si está pausado, reanudarlo y ya está: no hay nada que
corregir en el repositorio.

### SQL de confirmación del esquema

Aunque el esquema ya quedó descartado como causa, esta consulta lo
confirma de forma independiente y es barata. Ejecutar en el **SQL Editor
del proyecto de Production**:

```sql
-- 1. La tabla existe y tiene las 4 columnas que usa la consulta de duplicados
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'leads'
  and column_name in ('id', 'nombre', 'email', 'fecha_creacion')
order by column_name;
-- Esperado: 4 filas -> email/text, fecha_creacion/timestamp with time zone,
--           id/uuid, nombre/text

-- 2. La consulta de duplicados corre sin error contra el esquema real
select id
from public.leads
where email ilike 'jlbellon+desktop@gmail.com'
  and nombre = 'PRUEBA MVP16 DESKTOP'
  and fecha_creacion >= now() - interval '5 minutes'
limit 1;
-- Esperado: 0 filas, SIN error. Si devuelve error, ahi esta la causa.

-- 3. Estado de RLS (informativo, no se modifica nada)
select relrowsecurity as rls_habilitada
from pg_class
where oid = 'public.leads'::regclass;
-- Esperado: true
```

**Ninguna de las tres modifica nada**: son consultas de sólo lectura. No
desactivan RLS, no otorgan permisos a `anon` y no insertan registros.

### Verificación de la URL

En **Vercel → Settings → Environment Variables → Production**, comprobar
que `NEXT_PUBLIC_SUPABASE_URL`:

- tiene la forma `https://<ref>.supabase.co`,
- **sin barra final**,
- sin `/rest/v1` ni ninguna ruta añadida,
- y que `<ref>` es el del proyecto donde se verificó `public.leads`.

Contraste rápido desde una terminal, con la URL real: debe devolver
**JSON**, no HTML.

```bash
curl -i "https://<ref>.supabase.co/rest/v1/" -H "apikey: <anon key>"
```

## A.5 — Hallazgo de observabilidad (no corregido)

Este diagnóstico requirió leer el código de `postgrest-js` para averiguar
qué había fallado. Eso no debería hacer falta.

La feature 15 fijó que `metadatosDeError()` lee sólo `name`, `code` y
`responseCode`. Es una decisión correcta para no filtrar PII, pero **deja
ciego al operador justo en este caso**: cuando la respuesta no es JSON, no
hay `name` ni `code`, y el log dice `sin_tipo` / `sin_codigo`, que es
tanto como no decir nada.

**Propuesta, no aplicada**: agregar al esquema del logger el campo
`http_status` en los eventos de error de Supabase, tomándolo de
`status`/`statusCode` de la respuesta. Es un entero, valida con
`validarEntero`, **no puede transportar PII**, y habría reducido este
diagnóstico a un vistazo: un `502` o un `503` habrían señalado
inmediatamente a un proyecto pausado o inalcanzable.

**No se aplica ahora** porque la causa raíz es de entorno y la regla
acordada para clase A es no tocar código, y porque cambiar el código
alteraría otra vez el SHA candidato. Queda como candidata a feature
posterior, con la evidencia de por qué hace falta.

---

# Anexo B — Segunda ronda de diagnóstico

**Fecha**: 2026-09-05.
**Insumo humano**: las tres variables de Supabase están definidas y
habilitadas para Production y Preview; `public.leads` existe, RLS
habilitado, `COUNT(*) = 0`.

Este anexo no repite el Anexo A: añade lo que se pudo descartar en una
segunda pasada y aísla la única pregunta que queda abierta.

## B.1 — Lo que el nuevo insumo humano descarta por sí solo

**El proyecto Supabase no está pausado.** Era la hipótesis principal del
Anexo A. Queda descartada por una razón simple: el humano ejecutó
`COUNT(*)` sobre `public.leads` y obtuvo respuesta. **Un proyecto pausado
no responde consultas**, ni siquiera desde el editor SQL del panel. Si la
consulta corrió, el proyecto está activo.

Eso deja una sola familia de causas en pie: **el deployment de Production
está contactando un endpoint que no es el PostgREST de ese proyecto**, o
lo contacta en una ruta que no existe.

## B.2 — Variantes de forma de `NEXT_PUBLIC_SUPABASE_URL`

Que una variable esté *definida* no dice nada sobre su *forma*. Se probó
localmente cómo construye la URL `@supabase/supabase-js@2.112.3` para
cada error de tipeo plausible:

| Valor de la variable | Ruta resultante | ¿Explica el síntoma? |
|---|---|---|
| `https://<ref>.supabase.co` | `/rest/v1/leads` | correcta |
| `https://<ref>.supabase.co/` | `/rest/v1/leads` | **no** — la barra final se normaliza |
| `https://<ref>.supabase.co//` | `//rest/v1/leads` | **posible** |
| `https://<ref>.supabase.co/rest/v1` | `/rest/v1/rest/v1/leads` | **posible** |
| `https://<ref>.supabase.co/rest/v1/` | `/rest/v1/rest/v1/leads` | **posible** |
| `https://<ref>.supabase.co ` (espacio) | `/rest/v1/leads` | **no** — se normaliza |
| `<ref>.supabase.co` (sin protocolo) | — | **no** — lanza en `createClient()`, daría `supabase_cliente_error` |
| `http://…` en vez de `https://` | `/rest/v1/leads` | improbable |

**Hallazgos que importan:**

- Una **barra final simple se normaliza**: era una hipótesis razonable y
  queda descartada.
- **Un valor sin protocolo lanza dentro de `createClient()`**, lo que
  habría producido `supabase_cliente_error` y no
  `supabase_duplicados_error`. Descartado por el propio log.
- Siguen en pie las variantes que **añaden una ruta**: doble barra, o
  `/rest/v1` incluido en la variable. Ambas producen una URL que el
  gateway de Supabase no reconoce y puede contestar con HTML.

## B.3 — La hipótesis que mejor encaja ahora

**`NEXT_PUBLIC_SUPABASE_URL` no apunta al PostgREST del proyecto
verificado.** Las dos formas concretas:

1. **La variable incluye una ruta** (`/rest/v1`, barra doble). El cliente
   la concatena y pide algo que no existe; la respuesta es una página de
   error, no JSON.
2. **La variable apunta a otro host.** El caso más fácil de cometer y el
   más difícil de ver: si apuntara al propio sitio
   (`https://gi-clinicadental.vercel.app`), la petición iría a
   `https://gi-clinicadental.vercel.app/rest/v1/leads?...`, y **Vercel
   responde a las rutas inexistentes con `The page could not be
   found` — texto, no JSON**. Eso produce exactamente
   `{ message: body }`, es decir `sin_tipo` + `sin_codigo`.

   Esta respuesta concreta está verificada en este mismo proyecto: es la
   que devolvía `GET /api/leads` antes del release.

Nótese que la variable puede estar "configurada originalmente para este
proyecto Supabase" y aun así tener una de estas dos formas: lo que el
panel muestra como *definida* no valida su contenido.

## B.4 — Lo que sigue sin poder verificarse desde acá

El valor de `NEXT_PUBLIC_SUPABASE_URL` **no es observable desde fuera**:

- El frontend no usa Supabase, así que la URL no llega al navegador pese
  al prefijo `NEXT_PUBLIC_`.
- No hay CLI de Vercel ni token en este entorno, y no se solicitó ninguno.
- El logger, por diseño, no registra ni la URL ni el cuerpo del error.

Por eso este diagnóstico se detiene acá y pide **una verificación
puntual**, en vez de seguir especulando o de cambiar código a ciegas.

## B.5 — Sobre el punto 10: por qué el log no ayudó

Ya respondido en el Anexo A, pero conviene subrayar la consecuencia
operativa: **el diagnóstico exigió leer el código fuente de
`postgrest-js` en `node_modules`.** Un operador de guardia no puede hacer
eso.

`metadatosDeError()` se diseñó contra la forma de `PostgrestError`, que
`extends Error` y trae `name` y `code`. Pero `postgrest-js` tiene una
rama documentada que devuelve un **objeto plano `{ message: body }`**
cuando la respuesta no es JSON, y contra esa forma el logger no tiene nada
que leer.

No es un fallo de la política de redacción —no registrar texto libre
sigue siendo correcto— sino un **hueco en el esquema**: falta un campo
estructurado que distinga "la base rechazó la consulta" de "el endpoint
ni siquiera habló PostgREST".

**Corrección mínima propuesta, no aplicada**: agregar `http_status` al
esquema del logger para los errores de Supabase, tomándolo de
`status`/`statusCode` de la respuesta. Es un entero, valida con
`validarEntero`, **no puede transportar PII**, y habría reducido toda esta
investigación a un vistazo:

- `404` → la ruta no existe: la URL trae una ruta de más.
- `200` con cuerpo no-JSON → el host no es Supabase.
- `502`/`503` → proyecto caído o inalcanzable.

Queda pendiente de decisión, junto con el redeploy que hará falta de
todos modos.

---

# Anexo C — Tercera ronda: corrijo un error propio y aíslo la causa

**Fecha**: 2026-09-05.
**Insumo humano**: `NEXT_PUBLIC_SUPABASE_URL` termina exactamente en
`.supabase.co`, sin `/rest/v1`, sin ruta adicional y sin barra final.

## C.1 — Error mío en el Anexo A, que hay que corregir

En el Anexo A escribí esta tabla de descartes:

> | Clave inválida | JSON con mensaje de API key | ✅ descartada |

**Esa línea es incorrecta y eliminó indebidamente la hipótesis que hoy es
la más probable.**

El razonamiento que usé fue: "todas las causas de base de datos devuelven
JSON **con `code`**, luego `sin_codigo` las descarta". El fallo del
razonamiento es que **una clave rechazada no la contesta PostgREST, sino
el gateway que está delante**, y ése responde con una forma distinta:

```json
{"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}
```

**Ese JSON no tiene `code`.** Y en `postgrest-js`, la rama de respuesta
no-ok hace `error = JSON.parse(body)` cuando el cuerpo **sí** es JSON:

```js
} else {
  const body = await res.text();
  try {
    error = JSON.parse(body);      // <-- el objeto parseado, tal cual
    ...
  } catch (_unused2) { ... error = { message: body }; }
}
```

Si ese JSON no trae `code`, el objeto resultante tampoco lo trae. Y no es
una instancia de `Error`, así que tampoco tiene `name`. **Resultado:
`sin_tipo` + `sin_codigo`, exactamente lo observado.**

Es decir: el síntoma **no exige** que el cuerpo sea no-JSON, como afirmé
en el Anexo A. Basta con que sea **un JSON sin campo `code`**. Corrijo la
conclusión: el conjunto de causas posibles es más amplio de lo que
declaré, y una clave rechazada estaba dentro todo el tiempo.

## C.2 — Lo que sí queda excluido, ahora con prueba

**Un `ref` de proyecto inexistente o mal escrito queda excluido.**
Verificado empíricamente:

```
curl https://noexisteesteproyecto123456.supabase.co/rest/v1/leads
  → curl: (6) Could not resolve host
```

Supabase **no tiene DNS comodín**: un proyecto que no existe no resuelve.
Un fallo de DNS hace que `fetch` lance, y eso toma la rama
`catch(fetchError)` de `postgrest-js`, que construye `code: ""` — un
string vacío que el logger registra como **`no_valido`**, no como
`sin_codigo`.

Como el log dice `sin_codigo`, **el host resolvió y contestó**. El
proyecto del `ref` existe y está en línea.

Combinado con el insumo de esta ronda —la URL base está bien formada—
quedan excluidas todas las variantes de forma de la URL.

## C.3 — Estado del descarte, actualizado

| Hipótesis | Estado | Por qué |
|---|---|---|
| Columna inexistente | excluida | daría `codigo=42703` |
| Tabla inexistente | excluida | daría `codigo=42P01` o `PGRST205` |
| RLS bloqueando | excluida | daría `codigo=42501` / `PGRST301` |
| Cliente mal creado | excluida | daría `supabase_cliente_error` |
| Variable vacía | excluida | ídem: `getSupabaseClient()` lanza |
| Duplicado real | excluida | la tabla tiene 0 filas |
| URL con ruta de más | **excluida** | insumo humano de esta ronda |
| URL con barra final / espacio | excluida | se normalizan (Anexo B) |
| URL sin protocolo | excluida | lanza en `createClient()` |
| `ref` inexistente o mal escrito | **excluida** | no resolvería por DNS (C.2) |
| Proyecto pausado | excluida | el `COUNT(*)` respondió (Anexo B) |
| **Clave rechazada por el gateway** | **← candidata principal** | JSON **sin `code`** (C.1) |
| Cuerpo no-JSON de un intermediario | posible, menos probable | mismo síntoma |

## C.4 — Por qué la clave es ahora la hipótesis principal

Sobrevive a todas las restricciones simultáneamente:

- El cliente **se crea**: la variable existe y no está vacía. ✔
- El host **resuelve y contesta**: el `ref` es real. ✔
- La URL está **bien formada**. ✔
- La respuesta trae **JSON sin `code`**, que es exactamente la forma de
  los errores de autenticación del gateway de Supabase. ✔
- **La tabla, el esquema y RLS son irrelevantes**: la petición se rechaza
  **antes** de llegar a PostgREST, así que da igual que `public.leads`
  esté perfecta. Eso explica la aparente contradicción entre "verifiqué
  la tabla por SQL y está bien" y "la consulta falla". **Son dos caminos
  distintos**: el editor SQL del panel entra por la conexión de Postgres
  autenticada por la sesión del panel; el backend entra por HTTP con la
  clave. Que uno funcione no dice nada del otro.

Formas concretas en que la clave puede ser rechazada teniendo la variable
"definida":

1. **La clave pertenece a otro proyecto.** URL y clave se configuraron en
   momentos distintos, o se copió la de otro proyecto de la cuenta.
2. **La clave fue rotada en Supabase y no se actualizó en Vercel.**
3. **Está truncada o con espacios/saltos de línea al pegarla.** Las claves
   JWT son largas y es un error frecuente.
4. **Formato**: Supabase migró a claves `sb_secret_…`; si el proyecto
   deshabilitó las claves JWT heredadas, una clave JWT antigua se
   rechaza.
5. **Se pegó la `anon` en la variable de `service_role`.** No daría
   "Invalid API key" sino un rechazo de RLS con `code`, así que esta
   variante en particular **no** encaja con `sin_codigo`.

## C.5 — La verificación que lo resuelve, sin revelar el secreto

Una clave `service_role` con formato JWT lleva su **payload en claro** en
el segmento del medio. Decodificarlo **no revela la firma**, que es la
parte secreta, y responde las dos preguntas que importan.

```bash
python -c "import base64,json,sys; p=sys.argv[1].split('.')[1]; p+='='*(-len(p)%4); d=json.loads(base64.urlsafe_b64decode(p)); print('ref  =', d.get('ref')); print('role =', d.get('role'))" "<SUPABASE_SERVICE_ROLE_KEY>"
```

Reportar únicamente esas dos líneas. **Ninguna de las dos es secreta.**

- `role` debe decir **`service_role`**. Si dice `anon`, la variable tiene
  la clave equivocada.
- `ref` debe coincidir con **el subdominio de `NEXT_PUBLIC_SUPABASE_URL`**
  y con el proyecto donde se verificó `public.leads`.

**Si el comando falla** porque la clave no tiene dos puntos, entonces no
es un JWT sino una clave del formato nuevo (`sb_secret_…`), y eso es en sí
mismo el dato: hay que verificar si el proyecto acepta ese formato en el
endpoint REST.

### Alternativa sin decodificar nada

En Supabase → **Settings → API**, comparar los **últimos 6 caracteres**
del `service_role key` con los del valor guardado en Vercel. Si difieren,
la clave está desactualizada o es de otro proyecto.

Ninguna de las dos comprobaciones modifica nada.

## C.6 — Si la clave resulta correcta

Entonces la causa es la otra rama: **un intermediario devolviendo un
cuerpo no-JSON**. En ese caso ya no hay más que deducir desde acá, y la
vía es el campo `supabase_status_code` que se agregó en la PR #26: tras el
próximo deployment, el log dirá el status en una línea y eso cierra el
caso —`401` clave, `404` ruta, `200` con cuerpo raro, `5xx` upstream—.

Es exactamente el escenario para el que se agregó el campo.

---

# Anexo D — Causa raíz CONFIRMADA

**Fecha**: 2026-09-05.
**Confirmado por el humano.**

## D.1 — Qué era

`SUPABASE_SERVICE_ROLE_KEY` en Vercel contenía una **clave legacy en
formato JWT** (`eyJ...`). El proyecto Supabase ya no la acepta, así que el
**gateway rechazaba la petición antes de que llegara a PostgREST**.

Fue reemplazada por la **Secret key activa `sb_secret_...`** llamada
`gi_clinicadental`, del **mismo** proyecto. No se tocaron
`NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## D.2 — Encaja exactamente con la hipótesis C.4.4

Era la cuarta forma listada en el Anexo C:

> **Formato**: Supabase migró a claves `sb_secret_…`; si el proyecto
> deshabilitó las claves JWT heredadas, una clave JWT antigua se rechaza.

Y explica cada observación sin forzar nada:

| Observación | Explicación |
|---|---|
| El cliente se creaba bien | La variable existía y no estaba vacía; `createClient()` no valida la clave contra el servidor |
| El host resolvía y contestaba | El `ref` y la URL siempre fueron correctos |
| `sin_tipo` + `sin_codigo` | El gateway responde `{"message":"Invalid API key","hint":"..."}`, **JSON sin campo `code`** |
| El `COUNT(*)` funcionaba | El editor SQL del panel entra por la conexión de Postgres autenticada por la sesión, **no** por HTTP con la clave. Son dos caminos distintos |
| Tabla, esquema y RLS irrelevantes | La petición se rechazaba **antes** de llegar a PostgREST |
| Primera ejecución real del endpoint | R3, anotado como riesgo desde el preflight: esas credenciales nunca se habían usado |

## D.3 — La corrección del Anexo C fue la que destrabó el caso

Vale la pena dejarlo escrito porque es la lección del episodio.

En el Anexo A descarté la clave con este razonamiento: *"todas las causas
devuelven JSON con `code`, luego `sin_codigo` las descarta"*. **Era
falso**, y mantuvo la hipótesis correcta fuera de consideración durante
dos rondas enteras.

El error fue asumir que **un solo componente** contestaba. Delante de
PostgREST hay un gateway, y ese gateway tiene su **propio formato de
error, sin `code`**. Corregir esa afirmación en el Anexo C fue lo que
devolvió la clave a la lista de candidatas, y de ahí salió la causa.

## D.4 — Verificación de compatibilidad del cliente

Antes de dar el caso por cerrado se comprobó que la versión instalada
soporta el formato nuevo, para no cambiar un fallo por otro.

`@supabase/supabase-js@2.112.3` **conoce las claves nuevas de forma
explícita**: su código incluye un helper `isNewApiKey(supabaseKey)` y una
opción `omitApiKeyAsBearer` para controlar cómo se envía. Por defecto
manda la clave en ambos sitios:

```js
if (!headers.has("apikey")) headers.set("apikey", supabaseKey);
if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${bearer}`);
```

**No se requiere ningún cambio de código** para usar `sb_secret_…`. El
constructor sólo valida que la clave no esté vacía (`supabaseKey is
required.`), sin asumir formato JWT.

## D.5 — Estado y qué falta

La corrección es de **entorno**, coherente con la clasificación clase A
que se mantuvo durante todo el diagnóstico: **no se cambió una sola línea
de código por este fallo**.

El humano **no hizo redeploy manual**, y es lo correcto: las variables se
inyectan en el build, así que el deployment actual de Production
(`eaf4e6f`) sigue con la clave vieja. **El próximo release construye de
cero y toma el valor nuevo**, en el mismo movimiento que lleva las
imágenes corregidas y el logger instrumentado.

Un solo deployment, una sola validación, como se había planificado al
retener el release.

**Verificación pendiente tras el deployment**: que
`supabase_status_code` no aparezca en ningún evento de error, porque no
debería haber errores de Supabase. Si volviera a fallar, ese campo dirá
el motivo en una línea — que es exactamente para lo que se agregó.

---

# Anexo E — Segundo deployment: el 500 persiste, y aparece un sospechoso en el cliente

**Fecha**: 2026-09-06.

## E.1 — El release llegó bien; el fallo no

Segundo release ejecutado y desplegado correctamente:

| | |
|---|---|
| `main` | `dc8a40b5c79519e065d60db9c8b6642aa8836667` (PR #27) |
| Candidato liberado | `8611e96` — coincide con el SHA de `audit-1-intento-2` |
| Deployment | `6287515993`, environment `Production`, **`success`** |
| Fecha/hora | 2026-09-06T00:38:46Z |

**V1 pasa completo**, y hay prueba de que este deployment es el nuevo:

| Comprobación | Resultado |
|---|---|
| `/`, `/politica-privacidad.html`, `/404.html` | 200 |
| `GET /api/leads` | 405 |
| Cabeceras de seguridad | las tres presentes |
| `Savia` en el HTML | **0** |
| `equipo-dental.webp` servido | **7558 bytes** — el regenerado |
| `interior-clinica.webp` servido | **2850 bytes** — el regenerado |
| `paciente-sonrisa.webp` | 11186 bytes — intacto, como debía |

Los pesos de las dos imágenes regeneradas coinciden exactamente con los
del repositorio: **el bloqueante 2 está resuelto en Production**.

## E.2 — V4 vuelve a fallar

Envío desde la UI real con el dataset aprobado:

```
POST https://gi-clinicadental.vercel.app/api/leads  →  HTTP 500
{"error":"error_interno"}
```

Reproducido también por `curl`. **El cambio de clave no resolvió el
fallo.**

## E.3 — Un hallazgo en `@supabase/supabase-js@2.112.3`

Al revisar cómo el cliente maneja las claves de formato nuevo apareció
esto, **en un comentario del propio paquete**:

```js
/**
* New-format Supabase API keys (`sb_publishable_…` / `sb_secret_…`) are not JWTs and
* must never be sent as a Bearer token — they belong only in the `apikey` header.
* All other keys (legacy JWT keys, `sb_temp_…` temporary keys, unrecognized `sb_`
* subtypes) keep the Bearer fallback.
*/
const isNewApiKey = (key) => key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
```

La regla es tajante: una clave `sb_secret_…` **nunca** debe viajar como
Bearer.

Pero mirá cómo se aplica:

```js
const allowKeyAsBearer = !((options?.omitApiKeyAsBearer) && isNewApiKey(supabaseKey));
...
if (!headers.has("apikey")) headers.set("apikey", supabaseKey);
if (!headers.has("Authorization")) {
  const bearer = realToken ?? (allowKeyAsBearer ? supabaseKey : null);
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
}
```

`allowKeyAsBearer` sólo vale `false` si **quien llama pasa
`omitApiKeyAsBearer: true`**. Y en el constructor del cliente:

```js
this.fetch          = fetchWithAuth(supabaseKey, supabaseUrl, ..., settings.global.fetch, settings.tracePropagation);
this.functionsFetch = fetchWithAuth(supabaseKey, supabaseUrl, ..., settings.global.fetch, settings.tracePropagation, { omitApiKeyAsBearer: true });
```

**Sólo `functionsFetch` lo pasa.** El `fetch` que usa `this.rest` —el que
hace nuestra consulta de duplicados— **no lo pasa**, así que
`options` es `undefined`, `allowKeyAsBearer` queda en `true`, y la clave
`sb_secret_…` **se envía como `Authorization: Bearer`**, que es
exactamente lo que el comentario del paquete prohíbe.

Si el gateway rechaza esa cabecera, la respuesta es un error de
autenticación en **JSON sin campo `code`** — que produce, otra vez,
`sin_tipo` + `sin_codigo`.

**Encaja con el orden de los hechos**: con la clave legacy JWT el Bearer
era válido y el fallo tenía otra causa aparente; al cambiar a
`sb_secret_…` el `apikey` pasó a ser correcto pero el Bearer pasó a ser
inválido, y el síntoma se mantuvo idéntico.

## E.4 — Por qué esto NO se declara todavía como causa raíz

Porque sería repetir el error del Anexo A: dar por cerrada una hipótesis
sin la evidencia que la distingue de sus alternativas.

Lo que hay es un sospechoso muy fuerte, no una prueba. Las alternativas
siguen vivas:

- La clave nueva podría no estar habilitada para el endpoint REST.
- El deployment podría no haber tomado el valor nuevo.
- El gateway podría estar rechazando por otro motivo.

**La diferencia con las rondas anteriores es que ahora el log lo dice.**
La PR #26 agregó `supabase_status_code`, y este deployment ya la lleva.

## E.5 — La comprobación que cierra el caso, en un campo

En **Vercel → el proyecto → Logs → función `api/leads` → entorno
Production**, alrededor de `2026-09-06T00:40Z`, buscar el evento
`supabase_duplicados_error` y leer **un solo campo**:

```
supabase_status_code
```

| Valor | Significado | Acción |
|---|---|---|
| **401** | El gateway rechaza la autenticación → **confirma E.3** | Workaround en el cliente o actualizar el paquete |
| **404** | La ruta no existe | Revisar URL |
| **200** | Respondió OK con un cuerpo que no es JSON | El host no es PostgREST |
| **5xx** | Upstream caído | Reintentar / soporte |
| **ausente** | El deployment no lleva la instrumentación | Revisar qué se desplegó |

Es exactamente el escenario para el que se agregó el campo: la
investigación que antes llevó tres rondas ahora debería resolverse
leyendo un número.

## E.6 — Correcciones previstas según el valor

**Si es 401** (confirma E.3), hay tres caminos, en orden de preferencia:

1. **Actualizar `@supabase/supabase-js`** a una versión donde el cliente
   REST no mande la clave nueva como Bearer. Es la corrección de raíz y
   no agrega código propio.
2. **Envolver `fetch`** en `createClient` con un wrapper que elimine la
   cabecera `Authorization` cuando la clave sea de formato nuevo. Es
   pequeño y bajo nuestro control, pero es código propio compensando un
   defecto de terceros, y hay que documentarlo como tal.
3. **Volver a una clave legacy JWT**, si el proyecto todavía las acepta.
   Es un retroceso y no se recomienda.

Cualquiera de los tres es un cambio de código o de dependencia, así que
pasa por el circuito completo: nuevo candidato, tests, re-auditoría y
release.

**Si no es 401**, el valor indica otra dirección y se descarta E.3 sin
haber tocado nada — que es la razón de pedir el dato antes de corregir.

---

# Anexo F — Tercer deployment: instrumentación de endpoint desplegada

**Fecha**: 2026-09-06.

## F.1 — El 404 refuta la hipótesis del anexo E

Log de Production aportado por el humano:

```
request_id                 479bf400-5cfb-4f9e-a3e4-9072f277c545
supabase_duplicados_error  supabase_status_code = 404
solicitud_finalizada       http_status = 500
```

**404, no 401.** La hipótesis del anexo E —la clave `sb_secret_` viajando
como `Authorization: Bearer` y siendo rechazada— **queda refutada**.

Salió bien no haberla declarado causa raíz. De haberlo hecho se habría
"corregido" algo que no estaba roto —actualizando el paquete o
envolviendo `fetch`— y el 404 seguiría ahí, ahora con código nuevo
encima.

## F.2 — Lo que el 404 sí permite afirmar

**Ese 404 no lo emite PostgREST.**

Un 404 de PostgREST por relación o esquema inexistentes devuelve un JSON
**con `code`**: `42P01` (relación no existe) o `PGRST205` (tabla no
encontrada en el schema cache). El log sigue registrando `sin_codigo`, y
`sin_codigo` sólo ocurre cuando el objeto de error no trae `code`.

Conclusión: **el 404 lo emite un componente delante de PostgREST**, y por
lo tanto la petición no llega a la base. Eso deja fuera, otra vez y por
una vía distinta, a la tabla, al esquema y a RLS.

## F.3 — Qué faltaba, y por qué

El status no distingue dos escenarios muy diferentes:

- La ruta `/rest/v1/leads` no existe **en el host correcto**.
- Le estamos pegando a **otro host**, que devuelve 404 a cualquier cosa.

Y el objeto de error de Supabase **no dice a qué URL se llamó**. Sin ese
dato el diagnóstico no puede avanzar sin adivinar, que es exactamente lo
que se decidió no hacer.

## F.4 — Instrumentación desplegada (PR #28 → #29)

Dos campos nuevos: `supabase_host` y `supabase_path`.

**La garantía de privacidad, que es lo que hace esto aceptable**: la
consulta instrumentada lleva el email del paciente en su query string.

1. `metadatosDeEndpoint()` lee **únicamente** `.host` y `.pathname`.
   Nunca `.search`, nunca la URL completa.
2. Los patrones del logger excluyen `?`, `=`, `&`, `@`, `%` y el espacio.
   Un pathname con query se rechaza **entero**; el email URL-encodeado
   (`%40`) tampoco pasa.

Auditado con foco en este punto en `audit-1-intento-3.md`: **approved**.

### Un defecto del doble de pruebas, encontrado por el camino

`makeFakeSupabaseClient()` devolvía en `limit()` y `single()` **una
promesa pelada**, mientras el cliente real devuelve un *thenable* que
expone `.url`. Con ese doble, los tests de la instrumentación **pasaban
sin probar nada**.

Se corrigió el doble para replicar la forma real. Es el tipo de fallo que
un test verde esconde, y la razón de verificar siempre en negativo:
quitando la instrumentación, 3 tests fallan.

## F.5 — Estado del deployment y disparo

| | |
|---|---|
| `main` | `9ad687477a2ef55463952682ddc0120910d6516c` (PR #29) |
| Candidato liberado | `1991211` — coincide con `audit-1-intento-3` |
| Deployment | `6287860202`, `Production`, **`success`**, 2026-09-06T01:26:21Z |
| Envío de diagnóstico | 2026-09-06T01:26:39Z → **500 `error_interno`** |

El envío usó datos de diagnóstico, **no** el dataset oficial de la
validación: como falla, no crea lead ni envía correo, así que las dos
casillas controladas siguen sin consumirse.

## F.6 — El dato que cierra el diagnóstico

En **Vercel → Logs → función `api/leads` → Production**, alrededor de
`2026-09-06T01:26:39Z`, evento `supabase_duplicados_error`. Dos campos:

```
supabase_host
supabase_path
```

| Valor | Lectura | Corrección |
|---|---|---|
| `<ref>.supabase.co` + `/rest/v1/leads` | La URL es correcta; el 404 viene de otro lado | Investigar el proyecto/gateway |
| `<ref>.supabase.co` + `/rest/v1/rest/v1/leads` | La variable trae una ruta de más | Corregir la variable |
| Otro host | La variable apunta a otro destino | Corregir la variable |
| Ausentes | El deployment no lleva la instrumentación | Revisar qué se desplegó |

Ninguno de los dos es secreto: el host es el subdominio público del
proyecto y el pathname es una ruta fija de la API.

---

# Anexo G — Consolidación final de la evidencia (V1–V12)

**Fecha**: 2026-09-06.
**Punto de entrada único de la evidencia del punto 16.** El detalle de la
segunda ejecución vive en `test-report-3.md`; este anexo consolida el
estado de las doce comprobaciones y de dónde sale cada una.

## G.0 — Un matiz que cambia la lectura de la evidencia anterior

La confirmación humana incluye que **la autenticación SMTP quedó
corregida** (`SMTP_USER` / `SMTP_FROM` = `sonriamas@nextgia.io`), y que la
prueba con flags en `true` es la del lead **`PRUEBA SMTP`**.

Consecuencia que hay que dejar escrita: **los tres leads que creé antes de
esa corrección (`SONDA`, `DESKTOP`, `MOVIL`) se insertaron cuando SMTP
todavía fallaba.** Lo esperable es que tengan
`notificacion_clinica_enviada = false` y
`confirmacion_paciente_enviada = false`.

Eso **no es un defecto**: es exactamente el comportamiento especificado en
la feature 05 —un fallo de SMTP no elimina ni duplica el lead, sólo deja
el flag en `false`—. Pero significa que **la evidencia autoritativa de V6,
V7 y V8 es el lead `PRUEBA SMTP`, no los míos**. Atribuirles flags en
`true` sería falsear el registro.

## G.1 — Estado de las doce comprobaciones

| # | Comprobación | Estado | Fuente de la evidencia |
|---|---|---|---|
| **V1** | Sitio público | ✅ **PASS** | `test-report-3.md` §V1 — verificado por Claude Code |
| **V2** | Consentimiento obligatorio | ✅ **PASS** | `test-report-3.md` §V2 — bloqueo nativo, sin petición a la API |
| **V3** | Envío desde la UI real | ✅ **PASS** | `test-report-3.md` §V3/V4 |
| **V4** | Respuesta de la API | ✅ **PASS** | 201, body `{id}`, **0 ocurrencias de `X-Request-Id`** |
| **V5** | Lead en Supabase | ✅ **PASS** | Confirmación humana — lead `PRUEBA SMTP` creado correctamente |
| **V6** | Aviso a la clínica | ✅ **PASS** | Confirmación humana — recibido en `sonriamas-contactos@nextgia.io` |
| **V7** | Confirmación al paciente | ✅ **PASS** | Confirmación humana — recibido, y **aclara que el turno no está confirmado** |
| **V8** | Flags y consentimiento | ✅ **PASS** | Confirmación humana — `consentimiento_privacidad`, `notificacion_clinica_enviada` y `confirmacion_paciente_enviada` en `true` |
| **V9** | Logs correlacionados | ✅ **PASS** | Anexo I.2 — lead `37390789-…` con ambos flags en `true`, más la secuencia correlacionada observada en `87854053-…` |
| **V10** | Sin PII ni secretos en logs | ✅ **PASS** | Anexo I.3 — confirmación humana: sólo `ip_hash`, nada en claro |
| **V11** | Desktop | ✅ **PASS** | `test-report-3.md` §V11 |
| **V12** | Móvil | ⛔ **pendiente** | Requiere un teléfono real — ver G.3 |
| **N1** | `GET /api/leads` → 405 | ✅ **PASS** | `test-report-3.md` |
| **N2** | Formulario sin consentimiento | ✅ **PASS** | `test-report-3.md` |

**11 de 12 con evidencia suficiente.** La única pendiente es **V12**, que
requiere mirar el render en un teléfono real (ver G.3).

## G.2 — Configuración de Production confirmada

| Componente | Estado |
|---|---|
| Supabase Data API | habilitada |
| Schema `public` | expuesto |
| Tabla `leads` | expuesta |
| `NEXT_PUBLIC_SUPABASE_URL` | correcta |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | correcta (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | correcta (`sb_secret_…`) |
| `SMTP_USER` / `SMTP_FROM` | `sonriamas@nextgia.io` |
| `LEADS_NOTIFICATION_EMAIL` | `sonriamas-contactos@nextgia.io` |
| `SMTP_PASS` | configurada — **no se muestra ni se persiste** |

**Causa raíz del episodio, cerrada**: la configuración de Supabase en
Vercel, más un segundo problema de autenticación SMTP. **Ambos de
entorno.** No se cambió código de producto para resolverlos.

## G.3 — Por qué V12 sigue pendiente

`resize_window` reportó éxito con 390×844 y con 414×896, pero
`window.innerWidth` siguió devolviendo **1696** en ambos intentos: la
ventana no se redimensiona de verdad en este entorno, así que **no hay
manera de evaluar las media queries a ancho de móvil**.

**No hace falta enviar otro formulario.** La parte funcional ya está
cubierta por el backend: el lead móvil `2b3513ed-…` se creó desde la UI
con 201, y el circuito completo de correos quedó probado con
`PRUEBA SMTP`. Lo único que falta es **mirar el render**.

Comprobación concreta pedida: abrir
`https://gi-clinicadental.vercel.app` en un teléfono y confirmar que se
ve bien la cabecera, las imágenes, el aviso de demostración técnica y el
formulario, sin scroll horizontal.

## G.4 — Inventario de filas sintéticas

Cuatro filas, todas sintéticas. **Ninguna se borra**: son la evidencia de
que la validación ocurrió.

| # | `nombre` | `email` | `id` | Notas |
|---|---|---|---|---|
| 1 | `PRUEBA MVP16 SONDA` | `…+sonda@gmail.com` | `b61f91f5-06f8-47b6-963d-f7effa8f1bc4` | Sonda de diagnóstico. Flags probablemente `false` (SMTP aún roto) |
| 2 | `PRUEBA MVP16 DESKTOP` | `…+desktop@gmail.com` | *(en Supabase)* | UI real, V3/V4. Flags probablemente `false` |
| 3 | `PRUEBA MVP16 MOVIL` | `…+movil@gmail.com` | `2b3513ed-42e4-4d5d-9971-2bfe2566fcb3` | UI real, dataset móvil. Flags probablemente `false` |
| 4 | `PRUEBA SMTP` | `…+desktop@gmail.com` | *(en Supabase)* | **Evidencia autoritativa de V5–V8**: flags en `true` |

**Pasarlas a `estado = 'descartado'` sólo cuando toda la evidencia esté
registrada**, es decir después de V9, V10 y V12 — porque V9 y V10 se
verifican sobre los logs de esas mismas requests.

## G.5 — Lo que falta para poder lanzar `audit-2`

1. **V9** — secuencia de eventos correlacionados.
2. **V10** — ausencia de PII y secretos en los logs.
3. **V12** — render en un teléfono real.

`audit-2` **no se lanza antes**. Auditar una evidencia con tres
comprobaciones sin confirmar sería pedirle al auditor que valide huecos, y
un veredicto sobre evidencia incompleta no vale nada.

---

# Anexo H — `smtp_paciente_error` / ETIMEDOUT: análisis

**Fecha**: 2026-09-06.
**Insumo humano**: `request_id 87854053-e779-4a53-b850-130be2a4c8f7`,
secuencia `solicitud_recibida → validacion_aceptada →
supabase_insercion_ok → smtp_clinica_ok → smtp_paciente_error
(codigo=ETIMEDOUT) → solicitud_finalizada (201)`.

## H.1 — Lo que el propio log descarta

`smtp_clinica_ok` es un dato muy fuerte: **el host SMTP responde, el TLS
del 465 negocia y las credenciales autentican correctamente**. Por lo
tanto quedan fuera, sin necesidad de probar nada:

- credenciales SMTP incorrectas,
- host o puerto mal configurados,
- Supabase (la inserción fue correcta),
- el lead (se creó, y el 201 es correcto por diseño: la feature 05 fija
  que un fallo de correo no altera la respuesta ya decidida).

El fallo está **exclusivamente en el segundo envío**.

## H.2 — Prueba controlada única (autorizada)

Un solo envío nuevo, con cuenta controlada y `nombre` distinto para no
chocar con la ventana de idempotencia.

| | |
|---|---|
| Hora | 2026-09-06T03:25:38Z |
| `lead_id` | `37390789-37dd-48d6-8d8b-1b247207d986` |
| Respuesta | **201** |
| **Duración total** | **7,92 s** |

### Descomposición del tiempo, medida contra líneas de base reales

| Ruta | Tiempo | Qué ejecuta |
|---|---|---|
| `400` validación | 0,583 s / 0,577 s | sólo validación local, sin red externa |
| `201` rama duplicado | 0,642 s / 0,617 s | + un `SELECT` a Supabase, **sin insert y sin SMTP** |
| `201` completo | **7,92 s** | + insert + **2 envíos SMTP** + 2 `UPDATE` |

De ahí: el viaje a Supabase cuesta **~0,05 s** (0,63 − 0,58), y las tres
operaciones de base suman ~0,15 s. **Quedan ~7,1 s para los dos envíos
SMTP.**

Con `connectionTimeout` y `socketTimeout` en **5000 ms**, el reparto que
encaja es: clínica ~2 s, paciente **agotando los 5 s**.

**Límite honesto de esta medición**: el tiempo total es compatible con el
timeout, pero **también** con dos envíos simplemente lentos (~3,5 s cada
uno). La duración por sí sola no distingue los dos casos. La confirmación
está en `confirmacion_paciente_enviada` de ese lead, o en su log.

## H.3 — Análisis de los cinco puntos

### Reutilización de conexión entre ambos envíos

**No hay reutilización.** `createTransporter()` cachea el *objeto*
transporter a nivel de módulo, pero `nodemailer.createTransport()` se
llama **sin `pool`** (`grep -c pool api/_lib/mailer.js` → **0**).

Sin pool, nodemailer abre **una conexión TCP+TLS nueva por cada
`sendMail()`**. Los dos correos no comparten conexión: hacen dos
handshakes completos y **dos autenticaciones**.

### Timeout configurado

```js
const SMTP_CONNECTION_TIMEOUT_MS = 5000;
const SMTP_SOCKET_TIMEOUT_MS = 5000;
```

Cinco segundos para abrir un TLS implícito en el 465 contra un host
compartido, autenticar y entregar. Es un presupuesto ajustado para una
**primera** conexión; para una **segunda inmediata** deja muy poco margen.

### Comportamiento de Nodemailer

Sin pool, cada `sendMail()` recorre el ciclo completo: `connect` → saludo
→ TLS → `AUTH` → `MAIL FROM` → `DATA` → `QUIT`. Dos mensajes = dos ciclos
completos, incluidas dos autenticaciones.

### Cierre y reapertura

Es exactamente el punto. La conexión del primer correo **se cierra** al
terminar, y el segundo **abre una nueva**. Lo que agota el timeout no es
enviar el segundo mensaje: es **volver a conectar**.

Entre ambos envíos hay además un `UPDATE` a Supabase, así que la segunda
conexión llega ~2 s después de cerrarse la primera.

### Límites del servidor SMTP

Los servidores de hosting compartido suelen aplicar límites de
**conexiones por minuto y por IP**, y retardar deliberadamente conexiones
sucesivas como medida antispam. Dos conexiones consecutivas desde la
misma IP en pocos segundos es justo el patrón que dispara ese retardo.

Encaja con la asimetría observada: la primera conexión pasa, la segunda
se queda esperando.

## H.4 — Corrección mínima propuesta (NO aplicada)

**Que los dos correos viajen por una sola conexión**, en vez de abrir una
segunda:

```js
pool: true,
maxConnections: 1,
```

Ataca la causa directamente —elimina el segundo handshake, que es lo que
expira— y de paso baja la latencia total de la request. Son dos líneas en
`createTransporter()`, sin tocar `api/leads.js` ni la lógica de envío.

**Alternativa descartada**: subir los timeouts a 10-15 s. No arregla nada,
sólo espera más al mismo retardo, y alarga cada request. Trataría el
síntoma.

**Riesgo a vigilar del pool en serverless**: nodemailer mantiene la
conexión abierta entre invocaciones de una instancia caliente. Si el
servidor la cierra por inactividad, nodemailer debe reabrirla. Es
manejable, pero es un cambio de comportamiento y por eso se propone en vez
de aplicarse a ciegas.

## H.5 — Por qué no se aplica todavía

Porque **la medición no prueba el ETIMEDOUT**, sólo lo hace muy probable.
Aplicar el pool ahora sería exactamente el cambio especulativo que se
pidió evitar: si los dos envíos fueron simplemente lentos, el pool no
cambiaría nada y habría código nuevo sin causa demostrada.

**El dato que lo decide**, sobre el lead
`37390789-37dd-48d6-8d8b-1b247207d986`:

- `confirmacion_paciente_enviada = false` → el ETIMEDOUT **reprodujo**;
  la corrección de H.4 queda justificada.
- `confirmacion_paciente_enviada = true` → el fallo anterior fue
  **transitorio**; no se toca nada y la validación queda completa.

Equivale a leer `smtp_paciente_ok` o `smtp_paciente_error` en el log de
esa request.

---

# Anexo I — Cierre de V9 y V10

**Fecha**: 2026-09-06.

## I.1 — El ETIMEDOUT era transitorio

Confirmado por el humano sobre el lead
`37390789-37dd-48d6-8d8b-1b247207d986`, el de la prueba controlada del
anexo H:

```
notificacion_clinica_enviada  = true
confirmacion_paciente_enviada = true
```

**Los dos envíos funcionaron.** El `ETIMEDOUT` de la request
`87854053-…` fue un fallo transitorio de red/SMTP, no un defecto
reproducible.

**Decisión: no se aplica el pool, no se tocan los timeouts, no se cambia
nada de SMTP.** La corrección propuesta en H.4 queda **descartada por
falta de causa**, que es exactamente para lo que se pidió el dato antes
de tocar código.

Vale la pena señalar el contraste con el anexo H.2: la medición de 7,92 s
apuntaba con fuerza al timeout, y **se equivocaba**. Es la tercera
hipótesis mía que los datos refutan en esta etapa, y la tercera vez que
declararla "probable pero no probada" evitó un cambio de código
innecesario.

## I.2 — V9: logs correlacionados ✅ PASS

Evidencia sobre el lead `37390789-37dd-48d6-8d8b-1b247207d986`:

| Evento | Cómo queda evidenciado |
|---|---|
| `solicitud_recibida` | La request llegó y devolvió 201 |
| `validacion_aceptada` | El payload pasó todas las validaciones; si no, habría sido 4xx |
| `supabase_insercion_ok` | **La fila existe** en `public.leads` con ese `id` |
| `smtp_clinica_ok` | `notificacion_clinica_enviada = true` |
| `smtp_paciente_ok` | `confirmacion_paciente_enviada = true` |
| `solicitud_finalizada` con `http_status: 201` | **201 medido directamente** en la respuesta HTTP |

La cadena es concluyente por construcción del código: cada flag se
escribe **únicamente** en la rama de éxito del envío correspondiente,
inmediatamente después de emitir su evento `_ok`. Que ambos estén en
`true` implica necesariamente que ambos eventos se emitieron.

**Precisión sobre el alcance de esta evidencia**: el `request_id` de esa
request no quedó capturado —se leyó la fila, no el log—, así que la
correlación por `request_id` no se verificó *para esta request en
concreto*. Sí se verificó en la request `87854053-…`, donde el humano
observó los seis eventos correlacionados; la única diferencia allí fue
`smtp_paciente_error` en vez de `smtp_paciente_ok`.

Entre ambas requests la secuencia completa queda cubierta: la
correlación en una, el camino de éxito completo en la otra.

## I.3 — V10: privacidad ✅ PASS

Confirmado por el humano sobre los logs revisados. **No aparecen en
claro**: nombre, email, teléfono, mensaje, IP real, contraseñas, tokens,
claves, `Authorization` ni cookies.

Aparece únicamente `ip_hash`, que es el comportamiento correcto: el hash
truncado que la feature 04 introdujo precisamente para no persistir la IP
en texto plano.

Es la comprobación que más importaba de las doce. La garantía de la
feature 15 —lista blanca de campos, ningún campo de texto libre— se
sostiene en Production con datos reales, incluyendo el camino de error:
la request `87854053-…` registró un `smtp_paciente_error` y tampoco
filtró nada.
