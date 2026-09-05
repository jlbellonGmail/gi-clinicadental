# Test report 1 — Preflight del candidato de release

**Etapa**: 16-validacion-mvp-produccion, paso 7 de la secuencia.
**Fecha**: 2026-09-05.
**Candidato auditable**: `origin/develop` @ `26e2a682bcb0eb635c9f2d3e69c1062968cd81dd`.
**Autor**: Claude Code.

Este reporte cubre el preflight **previo a `audit-1`** y previo a la PR
`develop → main`. No es la validación en Production: ésa es
`test-report-2.md`, y sólo puede ejecutarse **después** del release y del
deployment del candidato real.

```yaml
status: aprobado
attempt: 2
candidato: 26e2a682bcb0eb635c9f2d3e69c1062968cd81dd
resultado: P1-P8 completos
```

## Resumen

| # | Verificación | Resultado |
|---|---|---|
| P1 | Suites completas sobre el candidato | ✅ **verde** |
| P2 | `mkdocs build --strict` | ✅ **OK** |
| P3 | Variables de Production en Vercel | ✅ **confirmado** |
| P4 | `SITE_URL` / `ALLOWED_ORIGINS` = origen público exacto | ✅ **confirmado** |
| P5 | Casillas controladas y acceso al buzón de la clínica | ✅ **confirmado** |
| P6 | Tabla `leads` con RLS y `anon` bloqueado | ✅ **confirmado** |
| P7 | Production público y sin deployment protection | ✅ **verificado** |
| P8 | Documentación y release candidate | ✅ **verificado** |

**8 de 8. El preflight queda aprobado.** Habilita `audit-1` de OpenCode
sobre `26e2a68`.

## Historial de candidatos

El candidato cambió dos veces durante el preflight. Cada cambio invalidó
al anterior como árbol auditable, por diseño: `audit-1` debe correr sobre
el árbol exacto que la PR `develop → main` va a mover.

| Candidato | Qué lo reemplazó |
|---|---|
| `60dbb6c` | PR #22 — `docs.yml` sin dependencia de GitHub Pages, `AGENTS.md` |
| `74297a7` | PR #23 — contacto público corregido y sitio declarado demo técnica |
| **`26e2a68`** | **vigente** |

Ninguna auditoría previa se reutiliza. `audit-1` se ejecuta sobre
`26e2a68` y se verifica que `origin/develop` siga apuntando a ese SHA
antes de abrir la PR hacia `main`.

## P1 — Suites completas sobre el candidato ✅

Ejecutadas **dos veces** sobre el commit exacto: en el CI de GitHub
Actions y localmente.

**CI (evidencia autoritativa, sobre el SHA exacto):**

| Corrida | Commit | Resultado |
|---|---|---|
| `33994570282` | `26e2a68` | `success` |

`ci.yml` ejecuta en ese orden: `pip install -r requirements-dev.txt`,
**`pytest -v`**, **`npm ci`** y **`npm test`**.

**Local, sobre `HEAD = 26e2a682bcb0eb635c9f2d3e69c1062968cd81dd`:**

| Comando | Resultado |
|---|---|
| `npm ci` | exit **0** |
| `npm test` | **202 tests, 202 pass, 0 fail** |
| `python -m pytest tests/` | **33 passed** (167.63s) |
| `python -m mkdocs build --strict` | **OK** |

`npm ci` es además el chequeo real de coherencia entre `package.json` y
`package-lock.json`: falla por diseño si discrepan. Su exit 0 confirma el
versionado `1.0.0` en ambos archivos.

> **Nota de entorno, no defecto de producto.** `pytest` falla en este
> equipo con `PermissionError [WinError 5]` al crear
> `…\Temp\pytest-of-*`. Se resolvió pasando `--basetemp` a un directorio
> escribible del scratchpad; con eso pasa completo, 33/33. **No se
> modificó producto ni tests** para sortear el problema: es una
> restricción del equipo local, y el CI de Ubuntu no lo reproduce.

## P2 — `mkdocs build --strict` ✅

**OK**, verificado en dos contextos sobre el candidato:

- Local, sobre `26e2a68`.
- Dentro del workflow `Docs`, job `build`, corrida `33994642948`
  (`headSha = 26e2a68`).

El modo estricto es el gate real de la documentación: convierte en error
cualquier enlace roto o página no referenciada.

## P3 — Variables de Production en Vercel ✅

Confirmado por el humano en el panel de Vercel, entorno *Production*. Se
registra **presencia y propósito, nunca el valor**.

| Variable | Estado |
|---|---|
| `SMTP_HOST` | configurada (proveedor DonWeb) |
| `SMTP_PORT` | configurada (proveedor DonWeb) |
| `SMTP_USER` | configurada — cuenta remitente de la demo |
| `SMTP_PASS` | configurada — **secreto, no se muestra ni se persiste** |
| `SMTP_FROM` | configurada — mismo buzón remitente |
| `LEADS_NOTIFICATION_EMAIL` | configurada — buzón receptor de los avisos |
| `NEXT_PUBLIC_SUPABASE_URL` | configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | configurada — **secreto, no se muestra ni se persiste** |
| `SITE_URL` | configurada — ver P4 |
| `ALLOWED_ORIGINS` | configurada — ver P4 |

Relevancia operativa: `SUPABASE_SERVICE_ROLE_KEY` ausente o inválida
produce `supabase_cliente_error` y **500**; cualquier `SMTP_*` ausente
produce `smtp_configuracion_error` y un **201 con los flags de
notificación en `false`**. Ambos serían fallos **clase A** (entorno), no
defectos de código.

## P4 — Origen permitido ✅ (riesgo principal R1, cerrado)

**Confirmado por el humano.** `SITE_URL` y `ALLOWED_ORIGINS` permiten
exactamente:

```
https://gi-clinicadental.vercel.app
```

Sin barra final, sin `www`, con `https`.

Por qué importaba tanto: `isOriginAllowed()` en `api/leads.js` compara el
header `Origin` **por igualdad exacta** contra `SITE_URL`, cada entrada de
`ALLOWED_ORIGINS` y `https://${VERCEL_URL}`. En Production, `VERCEL_URL`
es la URL **del deployment** (`gi-clinicadental-<hash>-<team>.vercel.app`),
**no el alias estable** que usa el navegador del visitante. Si no
coincidía, **todo envío desde el formulario habría devuelto 403
`origen_no_permitido`** y el frontend habría mostrado sólo *"Error en la
conexión, intente más tarde"*, indistinguible de una caída de red.

Con esta confirmación, el riesgo R1 queda cerrado antes del release en
lugar de descubrirse durante la validación.

## P5 — Casillas controladas ✅

Confirmado por el humano:

| Uso | Dirección | Estado |
|---|---|---|
| Prueba desktop | `jlbellon+desktop@gmail.com` | verificada, entrega correctamente |
| Prueba móvil | `jlbellon+movil@gmail.com` | verificada, entrega correctamente |
| Buzón de la clínica (`LEADS_NOTIFICATION_EMAIL`) | `sonriamas-contactos@nextgia.io` | **acceso confirmado: SÍ** |

Las dos direcciones de prueba son **distintas entre sí**, como exige el
diseño: la ventana de idempotencia de 5 minutos sobre `email` + `nombre`
haría que una segunda ejecución con los mismos datos devolviera **201 con
el id existente y sin enviar correos**, y V6/V7/V8 darían un falso
negativo.

Ambas resuelven al mismo buzón controlado por sub-direccionamiento, lo que
permite verificar las dos entregas desde un único inbox sin exponer
cuentas adicionales.

## P6 — Supabase de Production ✅

Confirmado por el humano mediante consulta SQL directa sobre el proyecto
de Production:

| Verificación | Resultado |
|---|---|
| Tabla `public.leads` existe | **SÍ** |
| RLS habilitado | **SÍ** |
| Rol `anon` sin permisos directos de escritura | **SÍ** |
| `notificacion_clinica_enviada` con default `false` | **SÍ** |
| `confirmacion_paciente_enviada` con default `false` | **SÍ** |
| Estado de la tabla | **vacía** |

Que la tabla esté vacía es una ventaja para la validación: los dos leads
sintéticos serán las dos únicas filas, sin ambigüedad sobre cuál produjo
cada request.

## P7 — Production público y sin deployment protection ✅

Verificado por sondeo directo, sin autenticación:

| Sonda | Resultado |
|---|---|
| `GET https://gi-clinicadental.vercel.app/` | **200** |
| Redirección a `vercel.com/sso-api` | **ninguna** |
| `GET /api/leads` | **404** |
| `GET /politica-privacidad.html` | **404** |

Los dos 404 son el **estado esperado antes del release** y quedan
registrados como **línea de base**. Después del merge a `main` deben pasar
a:

- `GET /api/leads` → **405 `metodo_no_permitido`**
- `GET /politica-privacidad.html` → **200**

Si tras el deployment siguieran en 404, el release no llegó a Production y
la validación no puede continuar.

Contraste verificado: los deployments Preview
(`…-git-develop-gi26.vercel.app`) devuelven `302 → vercel.com/sso-api`.
**Production es el único origen público del proyecto**, y por eso la
validación funcional se hace ahí y no en un Preview.

## P8 — Documentación y release candidate ✅

### Limitación de entorno resuelta contractualmente

**GitHub Pages no está disponible en este repositorio**: es privado y el
plan actual no lo incluye. Settings → Pages muestra *"Upgrade or make this
repository public to enable Pages"*, y `GET /repos/.../pages` devuelve
**404**. Decisión del proyecto: no se cambia la visibilidad ni el plan.
**Pages no bloquea el MVP.**

Lo que sí se exige, y está verificado:

| Verificación | Resultado |
|---|---|
| `mkdocs build --strict` obligatorio, sin condición, en el job `build` | ✅ sin `if:` |
| Pasos de Pages dentro del job `build` | ✅ **ninguno** |
| `deploy` condicionado a `needs.build.outputs.pages_disponible == 'true'` | ✅ |
| El deploy omitido **no** produce fallo | ✅ **verificado empíricamente** |
| Artefacto `mkdocs-site` conservado | ✅ 5.379.313 bytes |

**Verificación empírica sobre el candidato exacto** — corrida
**`33994642948`**, disparada con `workflow_dispatch` sobre `develop`
(`headSha = 26e2a68`):

- Resultado: **`success`**
- `build`: **`success`**
- `deploy`: **`skipped`** — omitido por condición, no fallado
- Artefacto: **`mkdocs-site`, 5.379.313 bytes**

Un job `skipped` no pone la corrida en rojo. El release a `main` no puede
fallar por este motivo.

### Contenido público del candidato

| Verificación | Resultado |
|---|---|
| `Savia Dental` en `index.html` / `404.html` / `politica-privacidad.html` | **0 / 0 / 0** |
| Marca visible `Sonríe más` | **14 / 5 / 5** — intacta |
| `contacto@sonrimas.com` (dominio que no resuelve) | **0 / 0** |
| `sonriamas-contactos@nextgia.io` (buzón real) | **1 en `index.html`, 3 en la política** |
| Placeholders `[A COMPLETAR POR EL CLIENTE]` visibles | **0** |
| Aviso de demostración técnica sobre el formulario | **presente** |

**Marca**: se confirmó con el humano que la marca visible es **`Sonríe
más`**, y que `sonriamas` es el **identificador técnico** de las cuentas
de correo, no la marca. Había tres grafías en circulación (`Sonríe más` en
el sitio, `sonrimas` en dominio y redes, `sonriamas` en las cuentas SMTP
nuevas); se resolvió explícitamente antes de auditar en lugar de asumir.

**Condición de demo**: `Sonríe más` es hoy una demostración técnica y de
portfolio, y NextGIA no es una persona jurídica constituida. Por
instrucción del humano **no se inventó razón social, CUIT ni domicilio**,
y **no se publicaron datos personales del desarrollador** como responsable
legal. La política declara explícitamente que no existe una entidad
responsable, y el aviso se repite sobre el formulario y en el texto del
consentimiento. Queda documentado como **condición actual de la demo, no
como deuda bloqueante de Production**.

### Estado del repositorio

| Verificación | Resultado |
|---|---|
| `ROADMAP.md` ítem 16 en `origin/develop` | ✅ `- [ ] 16-validacion-mvp-produccion` |
| `git ls-remote --tags origin` | ✅ **0 tags** |
| `main` | ✅ `a034703` — **no contiene el candidato** |
| CI de `develop` | ✅ `33994570282` sobre `26e2a68`, `success` |
| Workflow `Docs` | ✅ `33994642948`, `success` con `deploy: skipped` |
| `post-merge-close-feature.yml` en las tres PRs de preparación | ✅ `success` (rama fuera del patrón → se salta sin fallar) |

### Workflows aplicables al release

| Workflow | Se dispara en el release | Estado esperado |
|---|---|---|
| `ci.yml` | PR hacia `main` y push a `main` | verde — ya verde en `develop` con el mismo árbol |
| `docs.yml` | push a `main` (trae `docs/` por primera vez) | verde con `deploy: skipped` — verificado |
| `post-merge-close-feature.yml` | **no se dispara**: sólo escucha base `develop` | n/a |

## Observaciones registradas (no bloqueantes)

1. **`favicon.ico` y `apple-touch-icon.png` no existen en el repositorio**,
   pese a estar referenciados en `index.html`. Producirán dos 404 en
   Production. Verificado: los tres `.webp` de `static/images/` sí
   existen. Defecto preexistente de la feature 11, fuera del alcance
   aprobado en HITL 1.
2. **El mensaje de éxito del formulario dice *"Solicitud recibida. La
   clínica se comunicará para confirmar el turno"***, lo que contrasta con
   el nuevo aviso de demostración técnica. **No se modificó**: es un
   criterio de aceptación explícito de V4 en esta misma validación.
   Candidato a revisión después del cierre del MVP.
3. **Deprecación de Node.js 20 en GitHub Actions.** `actions/checkout@v4`,
   `actions/setup-node@v4`, `actions/setup-python@v5` y
   `actions/upload-artifact@v4` emiten el aviso de que se fuerzan a
   Node.js 24. Es un `warning`; no falla nada. Mantenimiento futuro.
4. **No existe `<link rel="canonical">`.** Registrado en `decision.md`; no
   se agrega en este release.
5. **`sonrimas.com` no resuelve** (sin registro A). Es el dominio
   institucional que declaraba la feature 10; por eso `og:url` apunta al
   alias de Vercel. Al conectarlo habrá que mover juntos `og:url`,
   `og:image`, `twitter:image` y `SITE_URL`, o el formulario empezará a
   devolver `403 origen_no_permitido`.
6. **Cambio local sin commitear en el checkout principal**: `ROADMAP.md`
   tiene 13 líneas en blanco finales eliminadas en el working tree. Es
   cosmético, no afecta al ítem 16 ni forma parte del candidato. Se dejó
   intacto y todas las verificaciones de `ROADMAP.md` se hicieron contra
   `origin/develop`, no contra el working tree.

## Conclusión

**Preflight aprobado: P1-P8 completos sobre `26e2a68`.**

El candidato está listo en todo lo que depende del repositorio y de la
configuración de Production: suites verdes en CI y en local, documentación
que compila en modo estricto, workflows que no pueden dejar `main` en
rojo, marca y contacto público corregidos, ningún placeholder legal
visible, ninguna entidad legal inventada, versión alineada en ambos
archivos npm, sin tags, `main` intacto y `ROADMAP.md` sin tocar.

**Próximo paso**: `audit-1` de OpenCode en modo estrictamente solo
lectura sobre `26e2a68`. Sólo con veredicto aprobado y sin deriva de SHA
se crea la PR `develop → main`.
