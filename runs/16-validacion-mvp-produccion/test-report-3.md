# Test report 3 — Validación del MVP en Production (intento 2)

**Etapa**: 16-validacion-mvp-produccion, paso 5 de la secuencia.
**Fecha**: 2026-09-06.
**Autor**: Claude Code.

```yaml
status: parcial
attempt: 2
resultado: EL CIRCUITO FUNCIONA — POST /api/leads devuelve 201 y crea leads
verificado_por_claude:
  - V1 sitio publico
  - V2 consentimiento obligatorio
  - V3 envio desde la UI real
  - V4 respuesta de la API (201, body {id}, sin X-Request-Id)
  - V11 desktop
  - N1 GET /api/leads -> 405
  - N2 formulario sin consentimiento -> bloqueado sin peticion
pendiente_de_verificacion_humana:
  - V5 filas en Supabase
  - V6 correo a la clinica
  - V7 correo al paciente
  - V8 flags de notificacion
  - V9 logs estructurados
  - V10 ausencia de PII/secretos en logs
  - V12 render movil en dispositivo real
```

**El MVP no se cierra todavía.** Sin `audit-2`, sin tag, `ROADMAP.md` en
`[ ]`.

## La causa raíz era la configuración de Supabase

Confirmado por el humano y verificado en vivo. Se recreó
`NEXT_PUBLIC_SUPABASE_URL` con la URL correcta del proyecto,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` con la publishable key `sb_publishable_…`
y `SUPABASE_SERVICE_ROLE_KEY` con la `sb_secret_…` del mismo proyecto.
Tras el redeploy, **el endpoint funciona**.

Ninguna de las cinco rondas de diagnóstico requirió cambiar código de
producto: la clasificación **clase A (entorno)** se sostuvo de principio a
fin, y las dos PRs de código que sí se hicieron (#26 y #28) fueron
**instrumentación para poder diagnosticar**, no intentos de arreglar el
fallo a ciegas.

### Nota sobre el redeploy

`develop` y `main` estaban idénticos (`main` @ `9ad6874` ya contenía el
candidato auditado `1991211`), así que **no había nada que liberar**. Un
cambio de variables no reconstruye nada por sí solo: Vercel las inyecta en
el build. El deployment nuevo lo disparó el humano con *Redeploy* desde el
panel. Se deja registrado porque es un paso que no se puede automatizar
desde el repositorio sin commitear a `main`.

## Datos del deployment validado

| | |
|---|---|
| URL Production | `https://gi-clinicadental.vercel.app` |
| SHA de `main` | `9ad687477a2ef55463952682ddc0120910d6516c` |
| Candidato liberado | `1991211` — coincide con `audit-1-intento-3` |
| Deployment base | `6287860202` + **Redeploy manual** con las variables corregidas |
| Fecha/hora de la validación | 2026-09-06T01:53Z – 02:00Z |
| Navegador desktop | Chrome (automatización Claude in Chrome) |
| Viewport efectivo | **1696×751** — ver V12 |

## V1 — Sitio público ✅

| Sonda | Resultado |
|---|---|
| `GET /` | **200** |
| `GET /api/leads` | **405** |
| `GET /politica-privacidad.html` | **200** |
| `GET /404.html` | **200** |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | las tres presentes |
| `Savia` en el HTML | **0** |
| `Sonríe más` | 14 ocurrencias |
| Aviso de demostración técnica | presente |
| `sonriamas-contactos@nextgia.io` | presente |
| `contacto@sonrimas.com` | **0** |

**Imágenes**, con la corrección del bloqueante 2 confirmada por peso
exacto:

| Archivo | HTTP | Bytes | |
|---|---|---|---|
| `paciente-sonrisa.webp` | 200 | 11186 | intacta, nunca llevó marca |
| `equipo-dental.webp` | 200 | **7558** | regenerada |
| `interior-clinica.webp` | 200 | **2850** | regenerada |
| `favicon.ico` | **404** | — | preexistente, no bloqueante |
| `apple-touch-icon.png` | **404** | — | preexistente, no bloqueante |

## V2 — Consentimiento obligatorio ✅

Con los campos completos y el checkbox **sin marcar**, el navegador
bloquea el envío con *"Selecciona esta casilla de verificación si quieres
continuar"*, `form.checkValidity()` devuelve `false` y **no se emite
ninguna petición a `/api/leads`**.

## V3 / V4 — Envío desde la UI real ✅

Ejecutado desde el formulario público, con el dataset aprobado.

| Campo | Valor |
|---|---|
| `nombre` | `PRUEBA MVP16 DESKTOP` |
| `email` | `jlbellon+desktop@gmail.com` |
| `servicio` | `otro` |
| `mensaje` | `PRUEBA SINTETICA MVP16 DESKTOP - no es un paciente real - no contactar - 2026-09-06T01:53Z` |

**Resultado: HTTP 201.** El botón mostró exactamente *"Solicitud
recibida. La clínica se comunicará para confirmar el turno"* y el
formulario se reseteó, que es el camino de éxito de la feature 08.

**Cabeceras de la respuesta de la API**, verificadas aparte con un
payload inválido para no crear otro lead:

```
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

**`X-Request-Id`: 0 ocurrencias.** El contrato de la feature 15 —no
alterar la superficie HTTP— se cumple en Production. Las demás cabeceras
son de infraestructura de Vercel, no de la aplicación.

### Un tropiezo del instrumental, no del producto

El primer clic sobre el botón **no disparó el envío**: no hubo petición,
el formulario no se reseteó y los campos siguieron llenos. No fue un
fallo del sitio sino de la automatización del navegador. Se detectó
porque el estado del formulario no coincidía con ninguno de los dos
caminos del código, y se confirmó con una sonda de diagnóstico antes de
volver a intentar.

**Importa para la validez de la prueba**: si se hubiera dado por bueno
ese primer intento, el dataset oficial habría entrado en la ventana de
idempotencia de 5 minutos y el segundo envío habría devuelto 201 **sin
enviar correos**, dando por válido un V6/V7 que nunca ocurrió.

## V5 – V8 — Leads y correos ⛔ requieren verificación humana

Se crearon **tres** filas. La primera es una sonda de diagnóstico, no
parte del dataset oficial:

| # | `nombre` | `email` | `id` | Origen |
|---|---|---|---|---|
| 1 | `PRUEBA MVP16 SONDA` | `jlbellon+sonda@gmail.com` | `b61f91f5-06f8-47b6-963d-f7effa8f1bc4` | sonda de diagnóstico |
| 2 | `PRUEBA MVP16 DESKTOP` | `jlbellon+desktop@gmail.com` | *(pendiente de leer en Supabase)* | **UI real, V3/V4** |
| 3 | `PRUEBA MVP16 MOVIL` | `jlbellon+movil@gmail.com` | `2b3513ed-42e4-4d5d-9971-2bfe2566fcb3` | UI real, dataset móvil |

El `id` del lead desktop no se capturó: la instrumentación de captura de
respuesta se instaló recién para el tercer envío. Se lee en Supabase.

**A verificar en el panel de Supabase**, para las filas 2 y 3:

- `estado = nuevo`
- `origen = formulario_web`
- `consentimiento_privacidad = true`
- `version_politica_privacidad = v1-2026-08-20`
- **`notificacion_clinica_enviada = true`**
- **`confirmacion_paciente_enviada = true`**
- `nombre`, `email`, `servicio` y `mensaje` iguales al dataset

**A verificar en los buzones:**

- **V6** — aviso a la clínica en `sonriamas-contactos@nextgia.io`, uno por
  cada lead.
- **V7** — confirmación al paciente en `jlbellon+desktop@gmail.com` y
  `jlbellon+movil@gmail.com` (ambas entregan en `jlbellon@gmail.com`). El
  mensaje **debe aclarar que el turno todavía no está confirmado**.

Registrar sólo *recibido sí/no* y la hora. No hace falta pegar el
contenido.

## V9 / V10 — Logs ⛔ requieren verificación humana

En **Vercel → Logs → función `api/leads` → Production**, entre
`01:53Z` y `02:00Z`.

**V9** — secuencia esperada por cada envío exitoso, todos con el mismo
`request_id`:

```
solicitud_recibida → validacion_aceptada → supabase_insercion_ok
→ smtp_clinica_ok → smtp_paciente_ok → solicitud_finalizada (http_status: 201)
```

Con la instrumentación agregada en esta etapa, **`supabase_status_code`,
`supabase_host` y `supabase_path` no deberían aparecer en ningún evento**:
sólo se emiten en errores de Supabase, y ya no debería haberlos.

**V10** — comprobación obligatoria de que en ninguna línea aparecen en
claro: `nombre`, `email`, `telefono`, `mensaje`, la IP, `SMTP_PASS`,
`SUPABASE_SERVICE_ROLE_KEY`, tokens, `Authorization`, cookies, payloads
ni stack traces.

## V11 — Desktop ✅

Render correcto, marca `Sonríe más` en la cabecera, secciones,
formulario, aviso de demostración técnica visible sobre el formulario y
checkbox con el texto nuevo. Las animaciones de aparición al hacer scroll
funcionan. Sin scroll horizontal.

## V12 — Móvil ⚠️ no ejecutado como corresponde

**No se pudo producir un viewport móvil real.** `resize_window` reportó
éxito con 390×844 y luego con 414×896, pero `window.innerWidth` siguió
devolviendo **1696** en ambos casos: la ventana no se redimensiona de
verdad en este entorno.

El segundo envío se hizo con el dataset móvil y **pasó** (201, lead
`2b3513ed-…`), así que la parte funcional está cubierta. Pero **eso no es
V12**: el criterio pide verificar el render responsive, y llamar "móvil"
a una prueba hecha a 1696px sería falsear la evidencia.

**Queda pendiente**: abrir `https://gi-clinicadental.vercel.app` en un
teléfono real y comprobar render, imágenes y formulario. Es una
comprobación de un minuto y no requiere enviar nada — el lead móvil ya
existe.

## Negativos ✅

| Prueba | Esperado | Obtenido |
|---|---|---|
| `GET /api/leads` | 405 `metodo_no_permitido` | **405** `{"error":"metodo_no_permitido"}` |
| Formulario sin consentimiento | bloqueado por el frontend, sin request | **bloqueado**, `huboPeticionALaApi: false` |

No se ejecutó la prueba de rate limit, excluida desde el plan: no es
determinista entre instancias serverless y generaría leads y correos
innecesarios.

## Limpieza pendiente

Las **tres** filas son sintéticas y deben pasar a `estado = 'descartado'`
desde el panel de Supabase. **No se eliminan**: son la evidencia de que
la validación ocurrió.

La fila 1 (`PRUEBA MVP16 SONDA`) no formaba parte del plan: se creó como
sonda para determinar si la API había vuelto a funcionar, tras el envío
que la automatización no llegó a disparar. Se registra en vez de
disimularla.

## Qué falta para HITL 2

1. Verificación humana de V5, V6, V7, V8, V9 y V10.
2. V12 en un teléfono real.
3. Limpieza de las tres filas a `descartado`.
4. `audit-2` de OpenCode sobre la evidencia completa.
5. HITL 2.

**No se ejecuta `audit-2` todavía**: auditar una evidencia con seis
comprobaciones sin confirmar sería pedirle al auditor que valide huecos.
