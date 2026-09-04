# Test report 1 — Preflight del candidato de release

**Etapa**: 16-validacion-mvp-produccion, paso 7 de la secuencia.
**Fecha**: 2026-09-04.
**Candidato auditable**: `origin/develop` @ `74297a7ce1418ff90a6ba2c789ea1a61b59adfd8`.
**Autor**: Claude Code.

Este reporte cubre el preflight **previo a `audit-1`** y previo a la PR
`develop → main`. No es la validación en Production: ésa es
`test-report-2.md`, y sólo puede ejecutarse después del release.

```yaml
status: incompleto
attempt: 1
bloqueado_por:
  - P3 variables de Production en Vercel (verificación humana en el panel)
  - P4 SITE_URL / ALLOWED_ORIGINS deben contener el origen público exacto
  - P5 casillas de correo controladas y acceso a LEADS_NOTIFICATION_EMAIL
  - P6 tabla leads con RLS y anon bloqueado en el Supabase de Production
```

## Resumen

| # | Verificación | Resultado |
|---|---|---|
| P1 | Suites completas sobre el candidato | ✅ **verde** |
| P2 | `mkdocs build --strict` | ✅ **OK** |
| P3 | Variables de Production presentes en Vercel | ⛔ **bloqueado** — panel |
| P4 | `SITE_URL` / `ALLOWED_ORIGINS` = origen público exacto | ⛔ **bloqueado** — panel |
| P5 | Casillas de correo controladas | ⛔ **bloqueado** — insumo humano |
| P6 | Tabla `leads` con RLS y `anon` bloqueado | ⛔ **bloqueado** — panel |
| P7 | Production público y sin deployment protection | ✅ **verificado** |
| P8 | Documentación y release candidate | ✅ **verificado** |

**4 de 8 verificados. El preflight NO está aprobado.** No se ejecuta
`audit-1` ni se crea la PR hacia `main` hasta cerrar P3-P6.

## P1 — Suites completas sobre el candidato

Ejecutadas por el CI de GitHub Actions sobre el commit exacto del
candidato, que es la evidencia autoritativa (no una corrida local sobre un
árbol parecido):

| Corrida | Commit | Resultado |
|---|---|---|
| `33826956439` | `74297a7` | `completed/success` |
| `33825256265` | `60dbb6c` | `completed/success` |

`ci.yml` ejecuta, en ese orden: `pip install -r requirements-dev.txt`,
**`pytest -v`**, `npm ci` y **`npm test`**.

`npm ci` es además el chequeo real de coherencia entre `package.json` y
`package-lock.json`: falla por diseño si discrepan. Su paso en verde
confirma el versionado `1.0.0` en ambos archivos.

Corridas locales previas, sobre el mismo contenido:
`npm test` **202/202**, `pytest` **33/33**.

> Nota de entorno, no defecto: `pytest` falla en este equipo con
> `PermissionError [WinError 5]` al crear `…\Temp\pytest-of-*`. Con
> `--basetemp` en un directorio escribible pasa completo (33/33). El CI de
> Ubuntu no reproduce el problema.

## P2 — `mkdocs build --strict`

OK, ejecutado localmente sobre el árbol del candidato más los documentos
nuevos de esta feature, y también dentro del workflow `Docs`
(job `build`, corrida `33826977524`).

El modo estricto es el gate real de la documentación: convierte en error
cualquier enlace roto o página no referenciada.

## P3 — Variables de Production en Vercel ⛔

**Bloqueado. Requiere verificación humana en el panel de Vercel**
(Settings → Environment Variables → entorno *Production*).

Variables que el código lee en runtime, extraídas de `api/`:

| Variable | Usada en | Presente |
|---|---|---|
| `SMTP_HOST` | `api/_lib/mailer.js` | pendiente |
| `SMTP_PORT` | `api/_lib/mailer.js` | pendiente |
| `SMTP_USER` | `api/_lib/mailer.js` | pendiente |
| `SMTP_PASS` | `api/_lib/mailer.js` | pendiente |
| `SMTP_FROM` | `api/_lib/mailer.js` | pendiente |
| `LEADS_NOTIFICATION_EMAIL` | `api/_lib/mailer.js` | pendiente |
| `NEXT_PUBLIC_SUPABASE_URL` | `api/_lib/supabase-client.js` | pendiente |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib/supabase-client.js` | pendiente |
| `SITE_URL` | `api/leads.js` | pendiente |
| `ALLOWED_ORIGINS` | `api/leads.js` | pendiente (opcional) |

**Se registra presente/ausente, nunca el valor.** No se piden capturas del
panel de variables.

Relevancia: `SUPABASE_SERVICE_ROLE_KEY` ausente o inválida produce
`supabase_cliente_error` y **500**; cualquier `SMTP_*` ausente produce
`smtp_configuracion_error` y un 201 con los flags de notificación en
`false`. Ambos son fallos **clase A** (entorno), no defectos de código.

## P4 — Origen permitido ⛔ (riesgo principal R1)

**Bloqueado. Es la verificación más importante del preflight.**

`isOriginAllowed()` en `api/leads.js` compara el header `Origin` **por
igualdad exacta** contra tres candidatos: `SITE_URL`, cada entrada de
`ALLOWED_ORIGINS`, y `https://${VERCEL_URL}`.

En Production, `VERCEL_URL` es la URL **del deployment**
(`gi-clinicadental-<hash>-<team>.vercel.app`), **no el alias estable** que
usa el navegador del visitante. Por lo tanto:

> **`SITE_URL` o `ALLOWED_ORIGINS` deben contener exactamente
> `https://gi-clinicadental.vercel.app`** — sin barra final, sin `www`,
> con `https`.

Si no coincide, **todo envío desde el formulario devuelve 403
`origen_no_permitido`** y el frontend muestra sólo *"Error en la conexión,
intente más tarde"*, un mensaje que no distingue esta causa de una caída
de red. En los logs se reconoce por `lead_rechazado` con
`motivo: origen_no_permitido` seguido de `validacion_rechazada`.

No es verificable desde fuera antes del release: Production todavía no
tiene `/api/leads`, y los Preview están tras SSO.

## P5 — Casillas de correo controladas ⛔

**Bloqueado. Insumo humano.**

- `<EMAIL_CONTROLADO_DESKTOP>` — sin definir.
- `<EMAIL_CONTROLADO_MOVIL>` — sin definir.
- Acceso a la casilla `LEADS_NOTIFICATION_EMAIL` — sin confirmar.

**No se infieren ni se derivan de ninguna cuenta del entorno.** Las dos
direcciones deben ser distintas entre sí: la ventana de idempotencia de 5
minutos sobre `email` + `nombre` haría que la segunda ejecución devolviera
201 con el id existente **sin enviar correos**, y V6/V7/V8 darían un falso
negativo.

## P6 — Supabase de Production ⛔

**Bloqueado. Requiere verificación humana en el panel de Supabase.**

- Tabla `leads` existente, con el esquema de la migración
  `supabase/migrations/20260819210130_create_leads_table.sql`.
- RLS habilitada.
- Rol `anon` bloqueado para escritura.
- Las columnas `notificacion_clinica_enviada` y
  `confirmacion_paciente_enviada` presentes, con default `false`.

## P7 — Production público y sin deployment protection ✅

Verificado por sondeo directo, sin autenticación, el 2026-09-04:

| Sonda | Resultado |
|---|---|
| `GET https://gi-clinicadental.vercel.app/` | **200** |
| Redirección a `vercel.com/sso-api` | **ninguna** |
| `GET /api/leads` | **404** |
| `GET /politica-privacidad.html` | **404** |

Los dos 404 son el **estado esperado antes del release** y sirven como
línea de base: después del merge a `main`, `GET /api/leads` debe devolver
**405** y `/politica-privacidad.html` **200**. Si tras el deployment
siguieran en 404, el release no llegó a Production.

Contraste verificado: los deployments Preview
(`…-git-develop-gi26.vercel.app`) devuelven `302 → vercel.com/sso-api`.
**Production es el único origen público del proyecto**, y por eso la
validación se hace ahí.

## P8 — Documentación y release candidate ✅

Reformulado respecto de la versión original del plan, tras verificar que
**GitHub Pages no está disponible en este repositorio**: es privado y el
plan actual no lo incluye. Settings → Pages muestra *"Upgrade or make this
repository public to enable Pages"*, y `GET /repos/.../pages` devuelve
**404**. Decisión del proyecto: no se cambia la visibilidad ni el plan, y
**Pages deja de ser bloqueante para el MVP**.

Lo que sí se exige, y está verificado:

| Verificación | Resultado |
|---|---|
| `mkdocs build --strict` como gate incondicional del job `build` | ✅ sin `if:` |
| Pasos de Pages dentro del job `build` | ✅ **ninguno** |
| `deploy` condicionado a `needs.build.outputs.pages_disponible == 'true'` | ✅ |
| `docs.yml` no puede dejar `main` en rojo | ✅ **verificado empíricamente** |
| Marca: `grep -c "Savia"` en `index.html`, `404.html`, `politica-privacidad.html` | ✅ **0 / 0 / 0** |
| `"version": "1.0.0"` en `package.json` | ✅ 1 ocurrencia |
| `"version": "1.0.0"` en `package-lock.json` | ✅ 2 ocurrencias (raíz y `packages[""]`) |
| `"0.1.0"` en cualquiera de los dos | ✅ 0 ocurrencias |
| `git ls-remote --tags origin` | ✅ **0 tags** |
| `ROADMAP.md` ítem 16 | ✅ `- [ ]`, sin tocar |
| `main` | ✅ intacto en `a034703` |

### Verificación empírica del workflow `Docs`

No se declara que el workflow "no fallará": se ejecutó.

- Corrida **`33826977524`**, disparada con `workflow_dispatch` sobre
  `develop` (commit `74297a7`).
- Resultado: **`completed/success`**.
- `build`: **`success`** — `mkdocs build --strict` ejecutado.
- `deploy`: **`skipped`** — no fallado, omitido por condición.
- Artefacto producido: **`mkdocs-site`, 5.379.313 bytes**.
- Aviso emitido en la corrida: *"GitHub Pages no esta disponible en este
  repositorio (privado, plan actual). El sitio se construyo en modo
  estricto y quedo como artefacto 'mkdocs-site'; se omite el deploy a
  proposito."*

Un job `skipped` no pone la corrida en rojo. El release a `main` no puede
fallar por este motivo.

### Workflows aplicables al release

| Workflow | Se dispara en el release | Estado esperado |
|---|---|---|
| `ci.yml` | PR hacia `main` y push a `main` | verde — ya verde en `develop` con el mismo árbol |
| `docs.yml` | push a `main` (trae `docs/` por primera vez) | verde con `deploy: skipped` — verificado |
| `post-merge-close-feature.yml` | **no se dispara**: sólo escucha base `develop` | n/a |

## Observaciones registradas (no bloqueantes)

1. **Deprecación de Node.js 20 en GitHub Actions.** `actions/checkout@v4`,
   `actions/setup-node@v4`, `actions/setup-python@v5` y
   `actions/upload-artifact@v4` emiten el aviso de que se fuerzan a
   Node.js 24. Es un `warning`, no falla nada. Mantenimiento futuro, fuera
   del alcance de este release.
2. **`favicon.ico` y `apple-touch-icon.png` no existen en el repositorio**,
   pese a estar referenciados en `index.html`. Producirán dos 404 en
   Production. Defecto preexistente de la feature 11, fuera del alcance
   aprobado en HITL 1; se registra para no perderlo.
3. **No existe `<link rel="canonical">`** en el sitio. Registrado en
   `decision.md`; no se agrega en este release.
4. **`sonrimas.com` no resuelve.** Es el dominio institucional declarado en
   la feature 10 (`contacto@sonrimas.com`, perfiles sociales), pero no
   tiene registro A. Por eso `og:url` se apuntó al alias de Vercel. Al
   conectarlo habrá que mover juntos `og:url`, `og:image`,
   `twitter:image` y `SITE_URL`.

## Conclusión

El candidato `74297a7` está **técnicamente listo** en todo lo que depende
del repositorio: suites verdes, documentación que compila en modo
estricto, workflows que no pueden dejar `main` en rojo, marca corregida,
versión alineada, sin tags y sin cambios en `ROADMAP.md`.

**El preflight queda incompleto y el release no avanza** hasta que se
cierren P3, P4, P5 y P6, que dependen de verificaciones en los paneles de
Vercel y Supabase y de dos casillas de correo controladas.

Próximo paso una vez cerrados: completar este reporte, ejecutar `audit-1`
de OpenCode en solo lectura sobre `74297a7` y, con veredicto aprobado y
sin deriva de SHA, crear la PR `develop → main`.
