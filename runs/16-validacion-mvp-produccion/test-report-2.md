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
  - "La marca Savia Dental sigue publicamente visible, incrustada en los pixeles de 2 de las 3 imagenes principales"
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
