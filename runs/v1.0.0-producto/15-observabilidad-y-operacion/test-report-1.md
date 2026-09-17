```yaml
status: approved
attempt: 1
feedback:
  - "npm test 202/202 y pytest 33/33 en verde; ninguna assertion preexistente fue modificada."
  - "Los 5 console.error que serializaban el objeto de error completo fueron eliminados; api/leads.js ya no tiene ningun console.* directo."
  - "Verificado con un error de INSERT cargado de PII en message/details/hint: no se filtra nada, solo el SQLSTATE."
  - "Reporte del constructor. La auditoria independiente la realiza OpenCode en solo lectura; audit-1.md no lo escribe el constructor."
```

# Test report 1 — 15-observabilidad-y-operacion

## 1. Resultados

| Suite | Comando | Resultado |
|---|---|---|
| Producto (Node) | `npm test` | **202 pass / 0 fail** |
| Circuito (Python) | `python -m pytest tests/` | **33 pass / 0 fail** |

Desglose de los 202: **158** preexistentes (sin modificar ninguna
assertion) + **25** nuevos de `api/_lib/logger.test.js` + **19** nuevos de
observabilidad en `api/leads.test.js`.

**Nota de entorno (no es un defecto del código)**: en este equipo `pytest`
aborta en *setup* con `PermissionError: [WinError 5]` sobre
`AppData\Local\Temp\pytest-of-<user>`. Es un problema de permisos del
directorio temporal base, ya observado en la feature 14. Con `--basetemp`
apuntando a un directorio escribible la suite corre completa. El CI de
GitHub Actions corre sobre Linux y no está afectado.

## 2. Muestras reales de log

Capturadas ejecutando el handler real contra dobles de Supabase y SMTP.

### Flujo 201 exitoso

```json
{"timestamp":"2026-09-03T07:23:11.849Z","nivel":"info","evento":"solicitud_recibida","request_id":"92bc0fc9-19c4-4864-8599-245c72628e6a","ip_hash":"0c25434b09c62046","metodo":"POST"}
{"timestamp":"2026-09-03T07:23:11.858Z","nivel":"info","evento":"validacion_aceptada","request_id":"92bc0fc9-19c4-4864-8599-245c72628e6a"}
{"timestamp":"2026-09-03T07:23:11.859Z","nivel":"info","evento":"supabase_insercion_ok","request_id":"92bc0fc9-19c4-4864-8599-245c72628e6a","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","duracion_ms":0}
{"timestamp":"2026-09-03T07:23:11.895Z","nivel":"info","evento":"smtp_clinica_ok","request_id":"92bc0fc9-19c4-4864-8599-245c72628e6a","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","duracion_ms":0}
{"timestamp":"2026-09-03T07:23:11.895Z","nivel":"info","evento":"smtp_paciente_ok","request_id":"92bc0fc9-19c4-4864-8599-245c72628e6a","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","duracion_ms":0}
{"timestamp":"2026-09-03T07:23:11.896Z","nivel":"info","evento":"solicitud_finalizada","request_id":"92bc0fc9-19c4-4864-8599-245c72628e6a","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","http_status":201,"duracion_ms":48}
```

El payload de esa solicitud contenía `nombre: "Ana Pérez"`,
`email: "ana@example.com"`, `telefono: "+54 379 4123456"` y un mensaje
libre. **Nada de eso aparece.** La IP `203.0.113.77` aparece únicamente
como `ip_hash: "0c25434b09c62046"`.

### Validación rechazada

```json
{"timestamp":"2026-09-03T07:23:11.896Z","nivel":"info","evento":"solicitud_recibida","request_id":"414152b5-a505-49ee-82e6-9304c1e3d469","ip_hash":"0c25434b09c62046","metodo":"POST"}
{"timestamp":"2026-09-03T07:23:11.897Z","nivel":"warn","evento":"validacion_rechazada","request_id":"414152b5-a505-49ee-82e6-9304c1e3d469","http_status":400,"error":"consentimiento_requerido"}
{"timestamp":"2026-09-03T07:23:11.897Z","nivel":"info","evento":"solicitud_finalizada","request_id":"414152b5-a505-49ee-82e6-9304c1e3d469","http_status":400,"duracion_ms":1}
```

### Fallo SMTP

```json
{"timestamp":"2026-09-03T07:23:11.898Z","nivel":"error","evento":"smtp_clinica_error","request_id":"0a94cbd5-b7ea-44c8-89d8-d4d7ebd68cea","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","tipo":"Error","codigo":"EAUTH","smtp_response_code":535,"huella":"a21c24d0731dedfd","duracion_ms":0}
{"timestamp":"2026-09-03T07:23:11.898Z","nivel":"error","evento":"smtp_paciente_error","request_id":"0a94cbd5-b7ea-44c8-89d8-d4d7ebd68cea","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","tipo":"Error","codigo":"EAUTH","smtp_response_code":535,"huella":"2d3ca2df16f726d0","duracion_ms":0}
{"timestamp":"2026-09-03T07:23:11.899Z","nivel":"error","evento":"solicitud_finalizada","request_id":"0a94cbd5-b7ea-44c8-89d8-d4d7ebd68cea","lead_id":"9c1f5a20-0b3e-4d77-9a11-5f0e2b6c8d44","http_status":201,"duracion_ms":2}
```

El error inyectado era
`Invalid login: 535 auth failed for ana@example.com`, con
`response: "535 5.7.8 Authentication failed: SMTP_PASS=secreta"`. Del
error sobreviven **sólo** `tipo`, `codigo` y `smtp_response_code`. Ni el
mensaje, ni la respuesta del servidor, ni la contraseña.

Nótese que las huellas de clínica y paciente **difieren** pese a ser el
mismo error: `evento` participa del hash, lo que permite distinguir cuál de
los dos envíos falla.

Nótese también que el status sigue siendo **201**: un fallo de email no
altera la respuesta ya decidida ni el lead ya guardado.

## 3. Cobertura de los tests obligatorios

| Requisito | Test | Resultado |
|---|---|---|
| Estructura de los logs | `cada evento es una unica linea JSON con los campos base`, `f15: cada linea de log es JSON valido de una sola linea` | ✅ |
| Correlación | `f15: todos los eventos de una request comparten un unico request_id`, `f15: dos requests distintas no comparten request_id`, `f15: lead_id correlaciona los eventos posteriores a la insercion` | ✅ |
| Eventos de éxito | `f15: el flujo 201 completo emite la secuencia de eventos esperada` | ✅ |
| Validación rechazada | `f15: cada familia de rechazo emite validacion_rechazada con su codigo` (5 escenarios) | ✅ |
| Fallo Supabase | `f15: un error de INSERT con PII en details/hint solo loguea metadatos`, `f15: un fallo al inicializar el cliente Supabase se registra sin detalle` | ✅ |
| Fallo SMTP | `f15: un fallo SMTP registra codigo y smtp_response_code, nunca la respuesta del servidor`, `f15: config SMTP ausente emite smtp_configuracion_error sin variables de entorno` | ✅ |
| Ausencia de secrets | `assertSinPiiNiSecretos` en 3 tests; verifica `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`, `service_role` | ✅ |
| Ausencia de PII completa | ídem; verifica nombre, email, teléfono, mensaje e IP | ✅ |
| Preservación de respuestas HTTP | `f15: la superficie HTTP no cambia (sin request id en la respuesta)` | ✅ |
| Preservación de funcionalidad | `f15: la funcionalidad preexistente se preserva bajo instrumentacion` + las 158 preexistentes | ✅ |

Tests adicionales que refuerzan la política de redacción:

- `descarta toda clave que no este en la lista blanca` — intenta loguear
  `message`, `details`, `hint`, `response`, `query`, `payload`, `stack`,
  `headers`, `cookies` y `env`; ninguna sobrevive.
- `un objeto Error pasado como campo no se serializa`.
- `tipo y codigo: un email o una frase nunca sobreviven al patron de token`.
- `metadatosDeError extrae solo name, code y responseCode`.
- `la huella NO depende del mensaje del error`.
- `f15: una clave desconocida hostil no llega al log (log injection)`.
- `la lista blanca no contiene ningun campo de texto libre` — guardia de
  mantenimiento: fija la lista completa de 13 campos.

## 4. Verificación de la política de redacción

| Prohibido | Verificado por |
|---|---|
| `err.message` | `metadatosDeError extrae solo name, code y responseCode`; muestras reales |
| `PostgrestError.details` / `.hint` | `f15: un error de INSERT con PII en details/hint solo loguea metadatos` |
| query / payload | `descarta toda clave que no este en la lista blanca` |
| `err.response` (SMTP) | `f15: un fallo SMTP registra codigo y smtp_response_code...` |
| Objetos `Error` / stack | `un objeto Error pasado como campo no se serializa` |
| Headers / cookies / env | `descarta toda clave que no este en la lista blanca`; `f15: config SMTP ausente...` |
| PII del paciente | `assertSinPiiNiSecretos`; `f15: ningun canal filtra PII ni secretos en un flujo 201 completo` |
| IP en claro | `f15: solicitud_recibida registra metodo e ip_hash, nunca la IP en claro` |

Verificación estructural adicional: `api/leads.js` **no contiene ningún
`console.*`** (`grep -n "console\." api/leads.js` → sin resultados).

## 5. Autocorrecciones durante la construcción

1. **Helper de test con orden incorrecto.** El primer `capturarConsola()`
   concatenaba los canales (`log`, luego `warn`, luego `error`), lo que
   perdía la cronología real y hizo fallar `f15: incluso un 405 queda
   registrado de punta a punta`. El código emitía los eventos en el orden
   correcto; el defecto era del helper. Se reescribió para registrar en
   orden cronológico real. Sin este arreglo, el test del flujo 201 habría
   pasado por casualidad (todos sus eventos son `info`).
2. **`require('crypto')` muerto.** Al delegar `hashIp()` en
   `hashOpaco()`, `crypto` quedó sin uso en `api/leads.js`. Eliminado.
3. **Comentario desalineado.** `log.info('validacion_aceptada')` quedó
   entre el comentario del cliente Supabase y su código. Reubicado.

Tras cada corrección se volvió a correr la suite completa.

## 6. Criterios de aceptación del spec

Los 18 criterios se verifican como cumplidos. Los que dependen de juicio
—calidad y honestidad de la documentación (11 a 14, 18)— quedan
explícitamente a confirmación de la auditoría independiente.

## 7. Alcance de este reporte

Es el reporte del **constructor**, no una auditoría. La auditoría
independiente en solo lectura la realiza OpenCode, y su resultado se
persistirá en `audit-1.md`. No se invocó `reviewer-agent` ni ningún
auditor sustituto.

Pendiente tras la auditoría: `[-]` en `ROADMAP.md`, PR hacia `develop`, CI
verde y HITL de merge.
