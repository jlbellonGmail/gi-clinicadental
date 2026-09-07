# Spec: 16-validacion-mvp-produccion

Origen: ítem 16 de `ROADMAP.md`. Este documento es el plan aprobado por el
humano en el HITL 1 de esta ejecución, incorporando los tres ajustes que
exigió antes de autorizar la Fase 2 (orden de `audit-1`, autoría de las
auditorías, y versionado npm sobre ambos archivos).

## Nota de proceso (desviación declarada)

`AGENTS.md` define un circuito de 4 subagentes (`analyst` → `reviewer` →
`builder` → `qa`) sin HITL intermedio. Esta ejecución usa otro flujo, por
instrucción explícita del humano, y se declara en vez de aplicarse en
silencio:

- Claude Code construye → **OpenCode audita en solo lectura** → Claude
  corrige → OpenCode reaudita.
- **No se invoca `analyst-agent`, `reviewer-agent` ni `qa-agent`.** Este
  spec lo escribe Claude Code a partir del plan aprobado en HITL 1.
- `audit-1.md` y `audit-2.md` **no los escribe el constructor**: ver
  "Autoría de las auditorías".
- El circuito de esta etapa tiene **exactamente dos** controles humanos:
  **HITL 1** (aprobación del plan) y **HITL 2** (aceptación final del
  MVP). No hay ningún otro.

Consecuencia de secuencia: `Assert-FeatureContract` exige al menos un
`audit-*.md`, y `ready-for-pr.ps1` lo invoca antes de crear la PR. Por eso
la rama de esta feature cierra **sin PR y sin `[-]` en `ROADMAP.md`**
hasta después de la validación real en Production.

## Objetivo

Ejecutar una validación funcional completa del MVP **en Production**, con
datos sintéticos controlados, y dejar la evidencia versionada que permita
cerrar el MVP. El MVP sólo puede cerrarse si todo el circuito funciona sin
credenciales expuestas, sin errores críticos y sin pasos manuales no
documentados.

Esta etapa es distinta de una feature funcional: su entregable es
**evidencia verificada**, no funcionalidad nueva. Las únicas
modificaciones de producto que autoriza son las correcciones acotadas
pre-release descritas más abajo, necesarias para que el primer release
estable no exponga contenido incorrecto ni workflows en rojo.

## Fuera de alcance

Cualquier feature funcional nueva; rediseño; dominio propio y DNS; panel
administrativo propio; reenvío manual de notificaciones fallidas (brecha
ya declarada en la feature 15); `<link rel="canonical">`; reescritura de
la marca en artefactos históricos de `runs/` y `docs/`; ejecución de
cambios en los paneles de Vercel, Supabase o Ferozo (son verificaciones y
acciones del humano, no del agente).

## Estado de partida verificado (2026-09-03)

Verificado por inspección directa, no asumido:

- `develop` @ `04e7644`, sincronizada con `origin/develop`.
- `main` = `origin/main` = `a034703`: **sólo el commit baseline de la
  landing estática**. 86 commits de diferencia, 176 archivos.
- **No existe ningún tag** en el repositorio.
- `npm test`: 202/202. `pytest`: 33/33. `mkdocs build --strict`: OK.
  (`pytest` falla localmente con `PermissionError [WinError 5]` sobre
  `Temp\pytest-of-*`; es entorno local, no defecto: con `--basetemp`
  escribible pasa completo.)
- Vercel: 60 deployments, **un solo `Production`** (id `5988339664`,
  `2026-08-19`, ref `1b7735c`), y ese commit **no contiene `api/`,
  `package.json` ni `vercel.json`**.
- El alias público `https://gi-clinicadental.vercel.app` responde 200 y
  sirve ese estado viejo: `GET /api/leads` → **404**,
  `/politica-privacidad.html` → **404**, `script.js` con
  `// Simulate API call`, y **sin** las cabeceras de seguridad de
  `vercel.json`.
- Los deployments Preview están tras **Vercel Authentication**
  (`302 → vercel.com/sso-api`): **el único origen público validable es
  Production**.
- **GitHub Pages no está disponible** en este repositorio: es privado y
  el plan actual no lo incluye. Settings → Pages muestra *"Upgrade or make
  this repository public to enable Pages"* y
  `GET /repos/<owner>/<repo>/pages` devuelve 404. No existe rama
  `gh-pages` y `docs.yml` nunca había corrido. **No se cambia la
  visibilidad del repositorio ni el plan**, así que Pages **no bloquea el
  MVP**: `docs.yml` construye y omite el deploy (ver correcciones).

**Conclusión dura:** Production no tiene MVP. El punto 16 es imposible sin
un release `develop → main` previo. De ahí la secuencia de esta spec.

## Correcciones acotadas pre-release

Son parte de esta etapa porque el primer release estable no puede publicar
contenido incorrecto ni workflows conocidos como rojos. Viajan en la rama
`release/v1.0.0-preparacion`, **deliberadamente fuera del patrón
`feature/NN-slug`**, para que `post-merge-close-feature.yml` la ignore sin
fallar y `ROADMAP.md` no se toque antes de tiempo.

### 1. Marca — bloqueante

Verificado: **17 ocurrencias de "Savia Dental"** en los tres HTML
públicos, mientras la marca visible en cabecera y pie ya es "Sonríe más".

| Archivo | Ocurrencias | Dónde |
|---|---|---|
| `index.html` | 11 | `<title>`, `meta description`, `og:title`, `og:description`, `og:site_name`, `twitter:title`, `twitter:description`, párrafo visible, `alt` de las 3 imágenes |
| `404.html` | 2 | `<title>`, `alt` de imagen |
| `politica-privacidad.html` | 4 | `<title>`, `meta description`, `<span>` del header, aviso del pie |

Sustitución a **"Sonríe más"**, marca ya usada en el propio sitio, en
`mkdocs.yml` (`site_name`) y en el ítem 10 del `ROADMAP.md`. No se inventa
denominación nueva (regla de dominio de `AGENTS.md`).

Verificación sobre los seis frentes exigidos: `title`, `meta description`,
Open Graph, Twitter Card, contenido visible y `alt` de imágenes.
Comprobación mecánica: `grep -c "Savia"` → **0** en los tres archivos.

Quedan **fuera**: `create_images.py` (script de desarrollo, excluido del
deployment por `.vercelignore`) y los `.md` de `docs/` y `runs/` que citan
"Savia" describiendo el estado histórico — `AGENTS.md` prohíbe sobrescribir
artefactos de otro agente, y reescribir evidencia pasada la falsearía.

### 2. Open Graph adyacente

- `og:url` declaraba `https://sonrimas.com`. **No es una errata**: es el
  dominio institucional declarado en la feature 10, coherente con
  `contacto@sonrimas.com` y con los perfiles sociales del footer. El
  motivo real del cambio, verificado, es que **el dominio no resuelve**
  (sin registro A; `curl` devuelve `000`), de modo que `og:url` apuntaba
  a un destino que hoy no sirve el sitio.
  Se corrige a la URL canónica indicada por el humano:
  **`https://gi-clinicadental.vercel.app`**, el único origen público del
  proyecto — y el mismo valor que debe coincidir exactamente con
  `SITE_URL` / `ALLOWED_ORIGINS` en P4, de modo que la corrección alinea
  las dos cosas. No se inventa dominio.
  Cuando `sonrimas.com` se conecte a Vercel habrá que actualizar juntos
  `og:url`, `og:image`, `twitter:image` y `SITE_URL`, o el formulario
  empezará a devolver `403 origen_no_permitido`.
- `og:image` / `twitter:image` son rutas relativas; Open Graph requiere
  URL absoluta. Se corrigen junto con `og:url`.
- `contacto@sonrimas.com` y los perfiles sociales **no se tocan**: son
  datos institucionales de la feature 10, fuera del alcance del release.
- No existe `<link rel="canonical">`: se registra como observación en
  `decision.md`, no se agrega en este release.

### 3. `docs.yml` — que no pueda dejar `main` en rojo

Dos causas distintas, separadas a propósito:

- **Limitación de entorno, no configuración pendiente**: **GitHub Pages no
  está disponible en este repositorio.** Es privado y el plan actual no lo
  incluye — Settings → Pages muestra *"Upgrade or make this repository
  public to enable Pages"* y `GET /repos/<owner>/<repo>/pages` devuelve
  404. **Decisión del proyecto: no se cambia la visibilidad del
  repositorio ni el plan.** Por lo tanto **Pages no bloquea el MVP**.
- **Defecto del workflow versionado**: `docs.yml` usaba
  `mkdocs gh-deploy --force`, que exige *Source = "Deploy from a branch"*
  y que además requiere Pages igual. Como `docs.yml` se dispara con `push`
  a `main` filtrando por `docs/**`, y el release lleva `docs/` a `main`
  por primera vez, el workflow corre sí o sí en ese merge: cualquier
  variante que intente publicar deja `main` en rojo el día del primer
  release estable.

Corrección adoptada, separando lo obligatorio de lo opcional:

| | |
|---|---|
| **`mkdocs build --strict`** | **Obligatorio.** Sin condición, en el job `build`. Sigue siendo el gate real de la documentación: si un enlace queda roto o falta una página, la corrida falla, haya Pages o no. |
| **Deploy a Pages** | **Opcional.** `configure-pages`, `upload-pages-artifact` y `deploy-pages` viven sólo en el job `deploy`, condicionado. |

- El job `build` **no contiene ningún paso de Pages**, así que no puede
  fallar por ese motivo.
- El sitio se sube como artefacto **`mkdocs-site`** (14 días), que es de
  donde se descarga la documentación mientras la limitación siga vigente.
- Un paso consulta la API de Pages y expone `pages_disponible`; el job
  `deploy` corre únicamente con `== 'true'`. **El default seguro es NO
  publicar**: 404, 403, fallo de red o salida vacía omiten el deploy. Un
  job `skipped` no pone la corrida en rojo.
- Se agrega `workflow_dispatch` para construir la documentación a demanda
  sin esperar a un push a `main`.

**Sin ajuste humano pendiente.** Si algún día Pages se habilita, no hay
que tocar el workflow: basta con *Settings → Pages → Source = "GitHub
Actions"* y el job `deploy` empieza a ejecutarse en la siguiente corrida.

`AGENTS.md` se corrige en sus tres afirmaciones sobre Pages (Stack, CI/CD
y Setup manual), que describían una publicación que no ocurre y pedían un
ajuste imposible de cumplir en este repositorio.

**Verificación empírica realizada** (no sólo declarada): corrida
`33826977524` disparada con `workflow_dispatch` sobre `develop` →
`completed/success`, con `build: success`, `deploy: skipped` y artefacto
`mkdocs-site` de 5.379.313 bytes.

### 4. Versionado npm

Estado real: `package.json` declara `"version": "0.1.0"`;
`package-lock.json` es `lockfileVersion: 3` y repite `"version": "0.1.0"`
en **dos lugares** — la raíz y el paquete raíz `packages[""]`.

Procedimiento: **`npm version 1.0.0 --no-git-tag-version`**, que actualiza
los tres campos según la estructura real de ambos archivos y **no crea tag
ni commit**. Verificación:

- `"version": "1.0.0"` aparece **2 veces** en `package-lock.json` y
  `"0.1.0"` **0 veces** en ambos archivos.
- **`npm ci` debe pasar**: falla por diseño si `package.json` y
  `package-lock.json` quedan desincronizados. Es el chequeo real de
  coherencia, y es el que corre el CI.

Es metadata del release, no funcionalidad.

## Secuencia

`audit-1` audita el **candidato real** —el árbol exacto que la PR
`develop → main` va a mover—, no el spec en el vacío. La PR de release no
se crea hasta que `audit-1` esté aprobada.

```
HITL 1 (aprobado)
 1  feature/16-validacion-mvp-produccion (worktree A): spec + docs + decision parcial
 2  release/v1.0.0-preparacion (worktree B): marca + og + docs.yml + npm 1.0.0
 3  Pruebas: npm ci · npm test · pytest · mkdocs --strict · grep "Savia"=0 · lock 1.0.0 x2
 4  (sin accion humana: Pages no esta disponible y docs.yml ya lo contempla)
 5  PR release/v1.0.0-preparacion -> develop · CI verde · merge
       => origin/develop @ <SHA_CANDIDATO> ES el candidato de release
 6  Sincronizar develop dentro de feature/16
 7  Preflight P1-P8 -> test-report-1.md
 8  OpenCode, SOLO LECTURA, audita <SHA_CANDIDATO> -> devuelve informe
 9  Claude Code persiste el informe LITERAL en audit-1.md
10  rejected -> Claude corrige en fix/<motivo> -> PR a develop -> nuevo <SHA_CANDIDATO>
       -> se repiten 7-9 (intento N+1, artefacto nuevo, nada se sobrescribe)
    approved -> continúa
11  PR develop -> main "release: MVP v1.0.0" · CI verde · merge
12  Vercel despliega Production automáticamente
13  Validación real en Production (V1-V12 + negativos) -> test-report-2.md + evidencia/
14  OpenCode, SOLO LECTURA, audita la evidencia -> devuelve informe
15  Claude Code persiste el informe LITERAL en audit-2.md
HITL 2 (aceptación final del MVP)
16  Humano: git tag v1.0.0 <sha del merge en main> && git push origin v1.0.0
17  ready-for-pr.ps1 -> [-] -> PR a develop -> CI verde -> merge
18  post-merge-close-feature.yml -> [x]   => MVP CERRADO
```

**Control antideriva**: `audit-1.md` registra el `<SHA_CANDIDATO>`
auditado. Antes de crear la PR del paso 11 se verifica que
`origin/develop` siga apuntando a ese SHA. Si cambió, la auditoría no vale
para el nuevo árbol y se repite.

**Por qué `feature/16` no se mergea antes**: `post-merge-close-feature.yml`
marca `[x]` en cuanto una rama `feature/NN-slug` se mergea a `develop`.
Mergearla antes de validar equivaldría a declarar el MVP cerrado sin
pruebas. `ROADMAP.md` permanece en `[ ]` durante todo el release, que es
la verdad en ese momento.

## Dataset sintético

| Campo | DESKTOP | MÓVIL |
|---|---|---|
| `nombre` | `PRUEBA MVP16 DESKTOP` | `PRUEBA MVP16 MOVIL` |
| `email` | `<EMAIL_CONTROLADO_DESKTOP>` | `<EMAIL_CONTROLADO_MOVIL>` |
| `servicio` | `otro` | `otro` |
| `mensaje` | `PRUEBA SINTETICA MVP16 - no es un paciente real - no contactar - <fecha ISO>` | ídem, sufijo `MOVIL` |
| `telefono` | `null` (el formulario no tiene campo de teléfono) | `null` |
| consentimiento | checkbox marcado | checkbox marcado |
| `version_politica_privacidad` | `v1-2026-08-20` (constante real de `script.js`) | ídem |

Esperado en la fila: `estado='nuevo'`, `origen='formulario_web'`,
`consentimiento_privacidad=true`. Respeta las validaciones reales del
endpoint (`nombre` 2-150, `email` <=254 con patrón, `mensaje` <=2000,
`version_politica_privacidad` 1-50).

**Direcciones**: se usan los placeholders `<EMAIL_CONTROLADO_DESKTOP>` y
`<EMAIL_CONTROLADO_MOVIL>` hasta que el humano indique las cuentas
controladas disponibles. **No se infieren ni se derivan de ninguna cuenta
del entorno.** La casilla de la clínica es el valor de
`LEADS_NOTIFICATION_EMAIL` en Vercel: no se lee ni se transcribe; en los
artefactos se registra únicamente *recibido: sí/no*.

**Restricciones operativas derivadas del código real:**

- Idempotencia de 5 min sobre `email` (case-insensitive) + `nombre`
  (case-sensitive): repetir el mismo par dentro de la ventana devuelve
  **201 con el id existente y NO envía correos**. Por eso desktop y móvil
  llevan nombre y email distintos.
- `sitio_web` y `formulario_mostrado_en` (honeypot y control temporal) no
  los envía el frontend; son opcionales y no rechazan. Cobertura unitaria.
- **Limpieza posterior**: los leads sintéticos pasan a
  **`estado='descartado'`** desde el panel de Supabase (procedimiento ya
  documentado en la feature 15). **No se eliminan**, para conservar
  trazabilidad.

## Criterios de aceptación

### Preflight (P1-P8), previo a `audit-1`

1. `npm ci` OK, `npm test` 202/202, `pytest` 33/33.
2. `mkdocs build --strict` OK.
3. Variables de Production presentes en Vercel: `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `LEADS_NOTIFICATION_EMAIL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`,
   `ALLOWED_ORIGINS`. Se registra *presente/ausente*, **nunca el valor**.
4. **`SITE_URL` o `ALLOWED_ORIGINS` contienen EXACTAMENTE el origen
   público** (riesgo principal, ver "Riesgos").
5. Acceso confirmado a las casillas paciente y clínica.
6. Tabla `leads` en el proyecto Supabase de Production, con RLS y `anon`
   bloqueado para escritura.
7. Alias Production confirmado, y Production **sin** deployment
   protection.
8. **Documentación y release candidate**, reformulado tras verificar que
   Pages no está disponible (ver correcciones): **Pages ya no es
   bloqueante**. Sigue siendo obligatorio que `mkdocs build --strict` pase
   y que `docs.yml` no pueda dejar `main` en rojo — verificado con una
   corrida real de `workflow_dispatch` que termina en `success` con
   `deploy: skipped`. Además: marca `grep "Savia"` = 0 en los tres HTML;
   versión `1.0.0` en `package.json` y en `package-lock.json`.

### Validación en Production (V1-V12)

1. **V1 — Carga del sitio público**: 200 en `/`; cabeceras
   `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
   presentes; `/politica-privacidad.html` 200; `/404.html` coherente;
   `script.js` **sin** `// Simulate API call`; **0 ocurrencias de
   "Savia"** en el HTML servido.
2. **V2 — Aceptar la política**: `#consent` marcado; envío bloqueado si no
   lo está.
3. **V3 — Enviar formulario válido**: desde la UI real, no por `curl`.
4. **V4 — Respuesta de la API**: **HTTP 201**; body exactamente
   `{ "id": "<uuid>" }`; **ausencia de `X-Request-Id` añadido por la
   aplicación** (contrato fijado por el test f15); cabeceras de seguridad
   de `vercel.json` presentes. **No** se exige que la respuesta traiga
   sólo `Content-Type`: Vercel añade cabeceras de infraestructura propias,
   y eso no es un fallo. Mensaje en el botón: *"Solicitud recibida. La
   clínica se comunicará para confirmar el turno"*.
5. **V5 — Lead en Supabase**: fila con ese `id`; `nombre`, `email`,
   `servicio`, `mensaje` iguales al dataset; `origen='formulario_web'`.
6. **V6 — Notificación a la clínica**: recibida en
   `LEADS_NOTIFICATION_EMAIL`; remitente `SMTP_FROM`; datos escapados.
7. **V7 — Confirmación al paciente**: recibida; **aclara que el turno no
   está confirmado**; sin información clínica.
8. **V8 — Flags y estado**: `estado='nuevo'`,
   `consentimiento_privacidad=true`,
   `version_politica_privacidad='v1-2026-08-20'`,
   **`notificacion_clinica_enviada=true`**,
   **`confirmacion_paciente_enviada=true`**.
9. **V9 — Logs estructurados**: en Vercel, función `api/leads`, entorno
   Production: `solicitud_recibida` → `validacion_aceptada` →
   `supabase_insercion_ok` → `smtp_clinica_ok` → `smtp_paciente_ok` →
   `solicitud_finalizada(http_status=201)`, todos con el mismo
   `request_id`; cada línea, JSON de una sola línea.
10. **V10 — Sin PII ni secretos en logs**: ausencia de `nombre`, `email`,
    `telefono`, `mensaje`, IP en claro, `SMTP_PASS`,
    `SUPABASE_SERVICE_ROLE_KEY`, tokens, `Authorization`, cookies y stack
    traces. Sólo los 13 campos de la lista blanca del logger.
11. **V11 — Desktop**: navegador y versión, viewport, render, foco y
    teclado, envío completo.
12. **V12 — Móvil**: dispositivo o emulación con viewport declarado,
    render responsive, envío completo.

### Negativos de bajo impacto (los únicos en Production)

13. `GET /api/leads` → **405 `metodo_no_permitido`** (hoy devuelve 404: es
    la prueba de que Production se actualizó).
14. Formulario sin marcar el consentimiento → **envío bloqueado por el
    frontend**, sin llegar a la API.

**Excluido deliberadamente**: la prueba de 6 envíos rápidos → 429. El rate
limit es en memoria y por instancia serverless: no es determinista y
generaría leads y correos innecesarios. La cobertura automatizada
existente (202/202) es suficiente, y así se declara en `test-report-2.md`.

### Artefactos y documentación (obligatorios)

15. `runs/16-validacion-mvp-produccion/spec.md` (este archivo).
16. `runs/16-validacion-mvp-produccion/audit-1.md` — informe de OpenCode
    sobre el candidato de release.
17. `runs/16-validacion-mvp-produccion/audit-2.md` — informe de OpenCode
    sobre la evidencia de Production.
18. `runs/16-validacion-mvp-produccion/test-report-1.md` — preflight
    P1-P8.
19. `runs/16-validacion-mvp-produccion/test-report-2.md` — evidencia real
    de Production.
20. `runs/16-validacion-mvp-produccion/decision.md` — decisiones
    demostrables, desviaciones declaradas, limpieza de datos sintéticos,
    tag emitido y estado final del MVP. No puede quedar vacío ni
    ornamental.
21. `docs/tecnica/validacion-mvp-produccion.md`.
22. `docs/usuario/validacion-mvp-produccion.md`.
23. Enlace exacto en `docs/tecnica/index.md` con el título
    `Validación del MVP en producción`.
24. Enlace exacto en `docs/usuario/index.md` con el mismo título.
25. `ROADMAP.md` en `[-]` sólo después de la validación aprobada, y en
    `[x]` sólo por el cierre automático post-merge.

## Autoría de las auditorías

Separación estricta, no negociable:

| | |
|---|---|
| **Autor de la auditoría** | **OpenCode**, ejecutado **estrictamente en solo lectura**. **No crea ni modifica `audit-1.md`, `audit-2.md` ni ningún otro archivo del repositorio.** Únicamente devuelve el informe. |
| **Persistencia del artefacto** | **Claude Code**, que escribe el informe **literal** en el `audit-N.md` correspondiente, **sin reinterpretar hallazgos, veredicto ni recomendaciones**, sin resumir y sin corregir redacción. |

Cada `audit-N.md` abre con una cabecera de procedencia —autor: OpenCode;
persistido por: Claude Code; fecha; SHA auditado; alcance— seguida del
informe íntegro, con su bloque YAML `status / attempt / feedback` tal cual
lo emitió OpenCode. Claude Code no añade contenido dentro del informe:
cualquier respuesta o corrección propia va en `decision.md`, nunca dentro
del artefacto de auditoría.

**Numeración de reintentos** (`AGENTS.md`: ningún agente sobrescribe el
artefacto de otro): un veredicto `rejected` se persiste como
`audit-1-intento-N.md` o `audit-2-intento-N.md`; `audit-1.md` y
`audit-2.md` quedan reservados para el veredicto **aprobado** de cada
etapa. Todos coinciden con el patrón `audit-*.md` que exige
`Assert-FeatureContract`.

## Versionado

- Versión adoptada: **`v1.0.0`** — primer MVP estable que llega realmente
  a Production, con `package.json` y `package-lock.json` alineados.
- El tag lo crea y pushea **exclusivamente el humano**, y sólo cuando
  concurren las tres condiciones: **Production validada + `audit-2` de
  OpenCode aprobada + HITL 2 aprobado**.
- Los agentes nunca crean tags (`AGENTS.md`, sección Versionado).

## Estrategia ante fallos

Clasificación obligatoria **antes** de tocar nada.

**A — Entorno / configuración.** Síntomas: `403 origen_no_permitido`;
`500` con `supabase_cliente_error` o `smtp_configuracion_error`; 201 con
`notificacion_*_enviada=false` y `smtp_*_error` (`codigo=EAUTH`,
`smtp_response_code=535`).
Acción: **no se toca código**. El humano corrige en Vercel, Supabase o
Ferozo y **fuerza redeploy** (obligatorio: el cliente de Supabase y el
transporter de Nodemailer se cachean a nivel de módulo, feature 15). Se
re-ejecuta con dataset nuevo. Queda registrado como hallazgo de
configuración, con el procedimiento faltante documentado.

**B — Defecto de código.** Síntomas: `500` con `error_no_controlado`;
contrato HTTP distinto del especificado; flags que no reflejan la
realidad; PII en un log.
Acción: se identifica **causa y alcance** y se declara en `decision.md`
antes de escribir una línea. Si es estrictamente necesario para cerrar el
MVP y es acotado, se corrige con tests que reproduzcan el fallo y se
repite el ciclo completo: PR a `develop` → nuevo preflight → **nueva
auditoría OpenCode del candidato** → **nuevo PR `develop → main`** → nuevo
deployment → `test-report-3.md`. Si excede lo acotado o cambia
funcionalidad, se abre `17-<slug>` en `ROADMAP.md` y **el MVP no se
cierra**. **Una fuga de PII en logs es bloqueante siempre.**

**C — Externo (Ferozo / Supabase / Vercel).** Síntomas: `ETIMEDOUT` o
`ECONNECTION` hacia SMTP; 5xx de Supabase; incidente declarado por el
proveedor.
Acción: registrar `request_id`, `huella`, `codigo`, hora y evidencia del
proveedor. **No se parchea código para tapar una caída externa.** Reintento
en otra ventana; si persiste, el MVP queda **bloqueado** con causa externa
documentada.

En los tres casos: no se oculta el fallo, no se marca el MVP como cerrado,
**no se crea el tag**.

## Rollback

Disparadores: el sitio no carga; `/api/leads` responde 5xx sistemático; se
filtran PII o secretos; se envía correo incorrecto a terceros.

1. **Contención inmediata**: Vercel UI → Deployments → *Promote to
   Production* del anterior. **Advertencia real**: el único Production
   previo es el de `2026-08-19` (`1b7735c`), el sitio **sin backend**;
   devuelve al estado actual, con el formulario roto. Sirve como
   contención, no como estado final.
2. **Trazable y preferido**: `git revert -m 1 <merge-commit>` en `main` +
   push → Vercel redespliega automáticamente.
3. Si la causa es configuración: corregir la variable en Vercel +
   redeploy, sin revert.
4. Si ya existiera el tag (no debería: va después de HITL 2), **no se
   borra ni se mueve** un tag publicado; se documenta el incidente y el
   siguiente release lleva `v1.0.1`.

Límites explícitos: el rollback **no revierte filas en Supabase** (se pasan
a `descartado`) ni **des-envía correos**.

## Seguridad

No se muestran, copian ni pegan en ningún artefacto los valores de
`SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, tokens, cookies, cabeceras
`Authorization` ni secretos de Vercel. Tampoco capturas del panel de
variables de entorno, ni el contenido íntegro de los correos con la
dirección real de la clínica. Se registra **presencia**, nunca **valor**.

Los extractos de logs incluidos como evidencia llevan `request_id` y
`lead_id`, y **no** cabeceras ni cuerpos de request.

## Riesgos y supuestos

- **R1 — Origen no permitido (el más probable).** `isOriginAllowed()`
  compara el header `Origin` **por igualdad exacta** contra `SITE_URL`,
  `ALLOWED_ORIGINS` y `https://${VERCEL_URL}`. En Production, `VERCEL_URL`
  es la URL *del deployment*, **no el alias** que usa el navegador. Si
  `SITE_URL` no es exactamente el origen público, todo envío desde la UI
  devuelve **403** y el frontend mostrará *"Error en la conexión"*.
  Bloqueante en P4.
- **R2 — Pages: mitigado, ya no es riesgo abierto.** Pages no está
  disponible en este repositorio (privado, plan actual) y no se va a
  habilitar. El riesgo era que `docs.yml` dejara `main` en rojo al
  intentar publicar; se elimina separando el build obligatorio del deploy
  opcional, con el deploy condicionado a que la API de Pages responda que
  está habilitada. Verificado empíricamente en la corrida `33826977524`:
  `success` con `deploy: skipped`. **Ninguna acción humana pendiente en
  la UI de GitHub.**
- **R3 — Production nunca ejerció sus variables.** El único deployment
  Production es previo a la existencia de `api/`: esas credenciales nunca
  se usaron. Errores de credencial o de host SMTP pueden aparecer recién
  aquí (clase A).
- **R4 — Exposición pública real.** Desde el merge, el formulario queda
  operativo para cualquiera; un lead real podría entrar durante la ventana
  de validación. Mitigación: ventana corta y prefijo `PRUEBA MVP16` para
  distinguir siempre.
- **R5 — Deployment protection.** Si la protección SSO estuviera activa
  también en Production, el alias dejaría de ser público y la validación
  sería imposible. Hoy responde 200 sin SSO; se confirma en P7.
- **R6 — Retención de logs.** Depende del plan de Vercel. La evidencia de
  logs se captura **en el momento**; no se confía en consultarla después.
- **R7 — `main` sin historial de CI.** La PR de release es el estreno de
  `ci.yml` contra `main`. Se espera verde, pero es la primera vez.
- **R8 — Corrección de marca sin tests de frontend.** La sustitución es
  textual y se verifica con `grep -c "Savia" → 0` más inspección visual en
  V1; no hay suite automatizada de frontend que la cubra.
- **R9 — Deriva del candidato entre `audit-1` y la PR a `main`.**
  Cualquier commit que entre a `develop` después de la auditoría invalida
  el veredicto. Mitigación: el control antideriva descrito en "Secuencia".

## Referencias

- `ROADMAP.md`, ítem 16.
- `AGENTS.md`: Circuito, Git, Versionado, CI/CD, Reglas de dominio.
- `runs/14-pipeline-despliegue-vercel/decision.md` — por qué no hay
  `deploy.yml` y por qué `vercel.json` es mínimo.
- `runs/15-observabilidad-y-operacion/decision.md` — catálogo de eventos,
  política de redacción y runbook operativo.
- `docs/tecnica/observabilidad-y-operacion.md` — catálogo de eventos y
  dónde consultar los logs.
- `docs/tecnica/pipeline-despliegue-vercel.md` — flujo de despliegue y
  rollback.
