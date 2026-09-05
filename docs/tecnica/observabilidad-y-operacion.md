# Observabilidad y operación — Documentación técnica

Cómo `POST /api/leads` registra lo que hace, qué garantías de privacidad
ofrece ese registro y cómo usarlo para diagnosticar un fallo.

## Arquitectura

No se incorpora ningún servicio externo de observabilidad. El endpoint
escribe **una línea JSON por evento** en `stdout`/`stderr`, y Vercel las
captura como Runtime Logs de la función serverless. Esto mantiene la
observabilidad dentro de la plataforma que ya se usa, sin dependencias
nuevas ni credenciales adicionales que custodiar.

```
POST /api/leads
      │
      ├── api/_lib/logger.js ──► console.log / warn / error ──► Vercel Runtime Logs
      │      (lista blanca de campos + hashing + huella)
      │
      └── api/leads.js  (emite los eventos en cada paso del flujo)
```

Piezas:

| Archivo | Rol |
|---|---|
| `api/_lib/logger.js` | Único emisor. Impone la lista blanca de campos, calcula hashes y huellas, y serializa. |
| `api/leads.js` | Emite los eventos. **No contiene ningún `console.*` directo.** |

`api/_lib/logger.js` no tiene dependencias: usa `crypto.randomUUID()` y
`crypto.createHash()` del runtime de Node.

## Política de redacción

La regla que ordena todo el diseño:

> **La defensa primaria es la lista blanca de campos, no la sanitización
> del texto.** Ningún campo del esquema acepta texto libre.

`emitir()` descarta toda clave que no esté declarada y todo valor que no
pase el validador de su campo. Por eso no existe un camino por el cual un
mensaje de error, un payload o un header lleguen a un log: no hay dónde
ponerlos.

### Prohibido registrar

Nunca, en ningún canal, ni truncado ni hasheado:

- `err.message`, `PostgrestError.details`, `.hint`, la query y el payload;
- `err.response` (respuesta completa del servidor SMTP);
- objetos `Error` serializados y stack traces;
- headers, cookies y variables de entorno;
- contraseñas, API keys, `service_role`, tokens de cualquier tipo;
- nombre, email, teléfono o mensaje del paciente, completos o parciales.

`metadatosDeError()` es el **único** punto del sistema que mira un error, y
lee exclusivamente tres propiedades acotadas por protocolo: `name`, `code`
y `responseCode`. El objeto de error no sale de esa función.

### Por qué esto importa acá

No es precaución teórica. Un error de INSERT de Postgres incluye los
valores de la fila en su detalle —por ejemplo `Key (email)=(...) already
exists` o `Failing row contains (...)`—, de modo que loguear el error
completo publicaría nombre, email, teléfono y mensaje del paciente en los
Runtime Logs. Un test lo verifica inyectando un error con PII en
`message`, `details` y `hint`, y comprobando que nada de eso aparece.

### Log injection

El caso `propiedad_desconocida` devuelve al cliente una clave tomada del
JSON entrante, es decir **texto controlado por quien llama**. Por eso el
campo `campo` se valida contra la lista de campos conocidos del lead y cae
a `no_permitido` si no está. Lo mismo con `metodo`, que se valida contra
los métodos HTTP conocidos. La respuesta HTTP no cambia: sigue devolviendo
la clave al cliente, como antes.

## Formato de los eventos

Una línea, un evento, JSON válido:

```json
{"timestamp":"2026-09-03T07:23:11.898Z","nivel":"error","evento":"smtp_clinica_error","request_id":"0a94cbd5-b7ea-44c8-89d8-d4d7ebd68cea","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","tipo":"Error","codigo":"EAUTH","smtp_response_code":535,"huella":"a21c24d0731dedfd","duracion_ms":0}
```

Campos base, siempre presentes: `timestamp` (ISO 8601), `nivel`, `evento`,
`request_id`.

### Campos opcionales

El orden de serialización es fijo, para que las líneas sean comparables.

| Campo | Tipo | Validación | Significado |
|---|---|---|---|
| `lead_id` | uuid | patrón uuid | Fila de `leads`. Correlaciona log ↔ base de datos. |
| `ip_hash` | 16 hex | patrón hash | sha256 truncado de la IP. **Nunca la IP en claro.** |
| `metodo` | enum | métodos HTTP | Método de la solicitud. |
| `http_status` | entero | ≥ 0 | Código de la respuesta. |
| `error` | enum | códigos de la API | Mismo código que se devuelve en el body. |
| `campo` | enum | campos del lead | **Nombre** del campo, nunca su valor. |
| `motivo` | enum | `rate_limit`, `origen_no_permitido`, `antispam` | Motivo del rechazo. |
| `flag` | enum | los dos flags de notificación | Cuál flag falló al actualizarse. |
| `tipo` | token | `[A-Za-z0-9_.-]{1,64}` | `err.name`. |
| `codigo` | token | ídem | SQLSTATE de Postgres (`23505`) o código de Nodemailer (`EAUTH`). |
| `smtp_response_code` | entero | ≥ 0 | Código numérico SMTP (`535`, `550`). |
| `supabase_status_code` | entero | ≥ 0 | Status HTTP de la respuesta de Supabase/PostgREST. **No confundir con `http_status`**, que es el que devolvemos nosotros al cliente. |
| `huella` | 16 hex | patrón hash | Agrupación de errores equivalentes (ver abajo). |
| `duracion_ms` | entero | ≥ 0 | Duración de la operación. |

El patrón de token es deliberadamente estrecho: un email contiene `@` y
una frase contiene espacios, así que ninguno de los dos sobrevive — el
valor se reemplaza por `no_valido` en lugar de truncarse, para no dejar
pasar fragmentos.

## Niveles

| Nivel | Canal | Uso |
|---|---|---|
| `info` | `console.log` | Curso normal: recepción, validación aceptada, inserción, envíos, cierre. |
| `warn` | `console.warn` | Rechazos esperables: validación, rate limit, origen, antispam. |
| `error` | `console.error` | Fallos de Supabase o SMTP, y errores inesperados. |

No hay nivel `debug`: en un entorno serverless no habría forma de
activarlo sin un redeploy.

## Correlación

`request_id` es un `crypto.randomUUID()` por invocación, presente en todos
los eventos de esa request. Permite reconstruir una solicitud completa
filtrando por un solo valor.

`lead_id` se agrega desde el momento en que Supabase devuelve el id, y liga
los eventos de email con la fila de la tabla `leads`.

**`request_id` no se expone en la respuesta HTTP.** Fue una decisión
explícita: no se altera la superficie HTTP sin una necesidad operativa
demostrable, y no la hay — la correlación externa se hace por `lead_id` y
por marca temporal. Un test verifica que la respuesta siga trayendo
únicamente `Content-Type` y un body `{ id }`.

La correlación **no** usa el email ni el teléfono del paciente.

## Catálogo de eventos

| Evento | Nivel | Campos propios |
|---|---|---|
| `solicitud_recibida` | info | `metodo`, `ip_hash` |
| `validacion_aceptada` | info | — |
| `validacion_rechazada` | warn | `error`, `campo?`, `http_status` |
| `lead_rechazado` | warn | `motivo`, `ip_hash` |
| `duplicado_detectado` | info | `lead_id` |
| `supabase_cliente_error` | error | `tipo`, `codigo`, `huella` |
| `supabase_duplicados_error` | error | `tipo`, `codigo`, `huella`, `supabase_status_code?` |
| `supabase_insercion_ok` | info | `lead_id`, `duracion_ms` |
| `supabase_insercion_error` | error | `tipo`, `codigo`, `huella`, `supabase_status_code?`, `duracion_ms` |
| `smtp_configuracion_error` | error | `tipo`, `codigo`, `huella` |
| `smtp_clinica_ok` | info | `lead_id`, `duracion_ms` |
| `smtp_clinica_error` | error | `lead_id`, `tipo`, `codigo`, `smtp_response_code?`, `huella`, `duracion_ms` |
| `smtp_paciente_ok` | info | `lead_id`, `duracion_ms` |
| `smtp_paciente_error` | error | ídem que clínica |
| `flag_actualizacion_error` | error | `lead_id`, `flag`, `tipo`, `codigo`, `huella`, `supabase_status_code?` |
| `error_no_controlado` | error | `tipo`, `codigo`, `huella` |
| `solicitud_finalizada` | info | `http_status`, `lead_id?`, `duracion_ms` |

`validacion_rechazada` y `solicitud_finalizada` se emiten desde
`respond()`, el único punto por el que pasan todas las respuestas del
endpoint. Eso garantiza cobertura sin instrumentar los ~25 sitios que
llaman a `respond()` uno por uno.

En los rechazos por origen, rate limit y antispam, `lead_rechazado` se
emite **antes** que `validacion_rechazada`; ese orden es contrato de la
feature 04 y está verificado por test.

## La huella

`huella` agrupa errores equivalentes. Se construye **exclusivamente** con
metadatos estructurados:

```
sha256( evento | tipo | codigo | smtp_response_code )  → 16 hex
```

Deliberadamente **no participa `err.message`** ni ningún otro texto. Sirve
para contar recurrencias del mismo tipo de fallo y reconocerlo después de
haberlo diagnosticado por otra vía; no para reconstruir su contenido. Dos
errores con el mismo mensaje pero distinto código agrupan distinto, y dos
errores con mensajes distintos pero mismos metadatos agrupan igual.

Como `evento` participa del hash, el mismo error SMTP produce huellas
distintas para la clínica y para el paciente. Es intencional: permite
distinguir cuál de los dos envíos está fallando.

## Dónde consultar los logs

Vercel Dashboard → el proyecto → **Logs** (según la versión del panel,
bajo *Observability* → *Runtime Logs*). Se filtra por función
(`api/leads`), por entorno (Preview o Production) y por texto: pegando un
`request_id` se obtiene la solicitud completa; pegando un `lead_id` se
obtienen los eventos de esa fila.

Dos advertencias:

- **La retención depende del plan de Vercel.** Verificarla en el panel
  antes de apoyar cualquier procedimiento en logs históricos. No se
  documenta acá un número que podría ser falso.
- Los Runtime Logs **no son la fuente de verdad del negocio**: esa es la
  tabla `leads` en Supabase, con sus flags. Los logs explican *por qué*
  algo falló; la tabla dice *qué* quedó pendiente.

## Diagnóstico

### Fallos de Supabase

El campo `codigo` trae el SQLSTATE de Postgres.

| Evento | Qué pasó | Dónde mirar |
|---|---|---|
| `supabase_cliente_error` | Faltan `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`, o son inválidas | Variables de entorno del proyecto en Vercel |
| `supabase_insercion_error` con `codigo: 23505` | Violación de unicidad | Índices únicos de la tabla `leads` |
| `supabase_insercion_error` con `codigo: 23514` | Violación de un `check` | El `check` de `estado` en la migración |
| `supabase_insercion_error` con `codigo: 42501` | Permiso denegado | Políticas RLS; la escritura debe ir por `service_role` |
| `supabase_duplicados_error` | Falló el SELECT de deduplicación | Igual que arriba; el lead **no** se insertó |

El endpoint responde `500 { "error": "error_interno" }` en todos estos
casos, sin filtrar detalle al cliente.

### Fallos de SMTP

`codigo` trae el código de Nodemailer y `smtp_response_code` el numérico
del servidor.

| `codigo` | Significado | Acción |
|---|---|---|
| `EAUTH` (suele venir con `535`) | Credenciales SMTP rechazadas | Revisar `SMTP_USER`/`SMTP_PASS` en Vercel; ver el runbook de rotación |
| `ECONNECTION` / `ETIMEDOUT` | No se pudo conectar con Ferozo | Verificar `SMTP_HOST`, puerto 465 y disponibilidad del proveedor |
| `EENVELOPE` (suele venir con `550`) | Remitente o destinatario rechazado | Revisar `SMTP_FROM` y `LEADS_NOTIFICATION_EMAIL`; ver `entregabilidad-correo-dominio.md` |
| `smtp_configuracion_error` | Falta alguna variable SMTP | Variables de entorno en Vercel |

Un fallo de email **nunca** altera la respuesta ya decidida: el lead quedó
guardado y el endpoint responde `201`. Lo que queda pendiente es la
notificación, detectable por los flags en la tabla — ver el documento de
usuario.

### Errores inesperados

`error_no_controlado` indica un fallo fuera de los casos previstos. Trae
`tipo`, `codigo` y `huella`, sin mensaje. **Es el costo aceptado de la
política de redacción**: se pierde precisión diagnóstica a cambio de la
garantía de no publicar PII. La huella permite al menos contar
recurrencias y correlacionarlas con un despliegue o una ventana temporal.

## Regla de mantenimiento

Si en el futuro se agrega un campo de texto libre a la lista blanca de
`api/_lib/logger.js`, la garantía de este documento se degrada. El test
`la lista blanca no contiene ningun campo de texto libre` compara la lista
completa contra un valor esperado, de modo que cualquier agregado obliga a
revisarlo conscientemente en vez de pasar inadvertido.
