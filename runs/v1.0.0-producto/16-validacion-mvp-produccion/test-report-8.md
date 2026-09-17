# Test report 8 — Validación C en Production

**Etapa**: 16-validacion-mvp-produccion.
**Fecha**: 2026-09-07.
**Autor**: Claude Code.

```yaml
status: validacion_C_completa_pendiente_de_verificacion_en_base_y_logs
main: 571e999b707ae662fb5b4d46bf7ee89fe18dfd62   # PR 47
deployment: 6311816765 (Production, success)
migracion: aplicada por el humano; backfill verificado, 0 filas en pendiente
solicitud_sintetica: V14-MTREJ5YZ
suites:
  npm_test: 272/272
  pytest: 79/79   # verde completa, sin fallos no deterministas
  mkdocs_strict: ok
pendiente_humano:
  - verificar en Supabase los flags y el estado del lead V14
  - revisar los logs de esa request en Vercel
  - descartar los leads sinteticos
```

## Los tests no deterministas: resueltos, y la causa no era la que dije

Había atribuido las fallas de `test_local_reconciler_scripts.py` a "la
máquina cargada". **Atribución incompleta: la suite se cargaba a sí
misma.**

Varios de esos tests dejan el reconciliador **corriendo** a propósito —solo
verifican que arrancó—. El teardown lo mataba con `taskkill` y seguía
**sin comprobar nada**, así que un proceso lento en morir, o sus hijos
(`cmd.exe` lanza un `powershell` que hace `git fetch` en bucle),
sobrevivía al test y se acumulaba con los de los siguientes. De ahí el
síntoma raro: cada test pasaba en segundos por separado y el módulo
completo fallaba, en un test **distinto cada vez**.

Corregido: el teardown **espera a que los procesos estén realmente
muertos**. Además, sondeo cada 0,2 s en vez de 1 s —`process_alive()`
lanza un PowerShell propio, así que buena parte del timeout se consumía
midiendo— y, sobre todo, **diagnóstico al fallar**: antes el mensaje era
mudo ("no terminó en 90 s"); ahora adjunta la cola de los dos logs del
reconciliador y el estado del lock.

| Corrida del módulo | Resultado | Tiempo |
|---|---|---|
| 1 | **7/7** | 145 s |
| 2 | **7/7** | 129 s |
| 3 | **7/7** | 119 s |

Los tiempos **bajan**, que es justo lo que se espera si dejaron de
acumularse procesos. Suite completa: **79/79**.

## El SHA validado

| | |
|---|---|
| `main` | `571e999b707ae662fb5b4d46bf7ee89fe18dfd62` (PR #47) |
| Deployment | `6311816765`, Production, **success** |

El release solo trajo migración, tests y documentación. Se comprobó que
`index.html`, `script.js`, `style.css`, `api/leads.js` y
`api/_lib/mailer.js` son **idénticos** (hash a hash) a los del `main`
anterior. Y que lo que Production sirve es byte a byte lo mismo que el
árbol local:

| Archivo | Bytes | Production == local |
|---|---|---|
| `index.html` | 19.539 | **sí** |
| `script.js` | 14.428 | **sí** |
| `style.css` | 19.978 | **sí** |

## A — Abrir el sitio desde cero: **PASS**

| Comprobación | Resultado |
|---|---|
| Atributo `hidden` presente | sí |
| `display` computado | **`none`** |
| Altura renderizada | **0 px** |
| Variantes visibles | **0** |
| `body.con-modal` | ausente |
| Scroll horizontal | no |

## B — Refresh: **PASS**

Idéntico, valor por valor.

## C — Una solicitud sintética controlada: **PASS**

Marca `V14-MTREJ5YZ`. Nombre `Prueba Sintetica V14-MTREJ5YZ`, destinatario
la cuenta controlada del humano (`<EMAIL_CONTROLADO_MOVIL>`), mensaje
declarando que es un dato de prueba.

Se instrumentó un espía sobre `fetch` que **solo cuenta** las llamadas a
`/api/leads`, sin alterar el comportamiento.

### Feedback inmediato

| Comprobación | Resultado |
|---|---|
| Tiempo hasta el feedback | **10 ms** |
| Etiqueta del botón | **"Enviando solicitud..."** |
| `disabled` | `true` |
| `aria-busy` | `"true"` |
| Spinner | visible (`display: block`) |
| Diálogo durante la espera | **cerrado** (`display: none`) |

### Una sola request

| Acción | Requests acumuladas |
|---|---|
| Primer click | **1** |
| + 9 clicks más | **1** |
| + 3 `Enter` (evento `submit`) | **1** |
| Al terminar | **1** |

**Diez clicks y tres Enter produjeron una sola request.**

### Resultado

| Comprobación | Resultado |
|---|---|
| Duración | 15,0 s |
| Variante mostrada | **`exito`** |
| Título | **"Solicitud enviada"** |
| `aria-labelledby` | `tituloExito` |
| Foco al abrir | `#modalCerrar` |
| Formulario | **reseteado**: nombre, email y mensaje vacíos, consentimiento desmarcado |
| Botón | `Enviar Solicitud`, habilitado |
| Scroll horizontal | **no** |

Que la variante sea `exito` **prueba que el endpoint respondió
`comunicacion_completa: true`**, y por construcción eso exige que los dos
`sendMail` hayan salido. El diálogo se abrió **solo después** del
resultado terminal: durante los 15 s de espera estuvo cerrado.

### Cierre

| Acción | Resultado |
|---|---|
| `Escape` | cierra; `body.con-modal` se quita |
| Botón **Entendido** | cierra |
| Refresh posterior | **no reabre**: `display: none`, 0 variantes visibles |
| Formulario tras el refresh | vacío |

## Móvil y desktop, con el diálogo abierto

Production envía `X-Frame-Options: DENY`, así que la medición en iframe se
hizo contra el servidor local, previa comprobación de identidad byte a
byte con Production (tabla de arriba).

| Ancho | Diálogo al cargar | Desbordes | Scroll-H | Header | Caja | Dentro |
|---|---|---|---|---|---|---|
| 320 | `none` | **0** | no | 68 px | 288×322 | sí |
| 360 | `none` | **0** | no | 68 px | 328×486 | sí |
| 390 | `none` | **0** | no | 68 px | 358×245 | sí |
| 412 | `none` | **0** | no | 68 px | 380×486 | sí |
| 430 | `none` | **0** | no | 68 px | 398×245 | sí |
| 767 | `none` | **0** | no | 68 px | 440×409 | sí |
| 1024 | `none` | **0** | no | 80 px | 440×258 | sí |
| 1440 | `none` | **0** | no | 80 px | 440×258 | sí |

Las tres variantes se midieron (éxito a 320/390/430, parcial a
360/412/767, error a 1024/1440). El título baja a 20,8 px en móvil, la
caja se topa en 440 px y queda centrada. Sin regresiones.

## Lo que NO se puede verificar desde esta sesión

Ni la CLI de Vercel ni la de Supabase están disponibles o autenticadas
—comprobado, no supuesto—, así que estas tres cosas necesitan una consulta
del humano:

1. **Los flags y el estado del lead `V14-MTREJ5YZ`** en Supabase.
2. **Los logs de esa request** en Vercel.
3. **El descarte de los leads sintéticos.**

### Sobre el reintento SMTP

La duración fue de 15,0 s, contra 13,8 s del envío anterior. **Eso no
prueba ni descarta un reintento**, y no se va a afirmar ninguna de las dos
cosas: con la política vigente un reintento solo ocurre ante un fallo de
conexión demostrable, y desde el navegador no se distingue. El log lo
resuelve en una línea: si aparece un solo `smtp_clinica_ok` y un solo
`smtp_paciente_ok`, no hubo reintento.

Si en el log apareciera un error ambiguo, la política ya definida se
aplica sola: no se reintenta, el lead queda en `requiere_revision` y se
ve en la cola operativa. No se oculta.

## Los dos leads `nuevo + requiere_revision + true/false`

**No los toqué.** Su firma —notificación a la clínica enviada,
confirmación al paciente fallida— es exactamente la del `ETIMEDOUT` en el
segundo envío que se documentó en el Anexo H de `test-report-2.md`, y que
es el defecto que originó toda la corrección de SMTP de esta etapa.

El discriminador que sí es demostrable desde la evidencia: **todos los
envíos sintéticos de esta etapa usaron la casilla controlada del humano
con plus-addressing** —cinco sufijos distintos, uno por tipo de prueba—.
Ningún envío se hizo con otra dirección. Los sufijos concretos están en
los reportes anteriores de esta misma carpeta; no se repiten acá.

**Nota de privacidad.** `audit-6-final.md` señaló que este reporte
incluía la dirección literal. Se reemplazó por un marcador, que es la
convención que ya usaban los artefactos de preflight. Las apariciones
literales en reportes anteriores (`test-report-2.md`) son previas a esta
convención y quedan a criterio del humano: reescribirlas cambiaría
artefactos históricos ya auditados, y por eso no se hace en silencio.

Pero **confirmar que esas dos filas concretas coinciden requiere leer la
base**, y no puedo. Así que quedan como están, para resolución humana, con
la consulta lista abajo.
