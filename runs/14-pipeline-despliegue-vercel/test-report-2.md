```yaml
status: approved
attempt: 2
feedback:
  - "Intento 1 se dio por cerrado sin que la implementacion estuviera realmente verificada: deploy.yml fallo en las 3 corridas registradas y ningun test lo cubria."
  - "vercel.json describia un stack (Vite) que no existe en el repo; ningun test comparaba la configuracion de despliegue contra el codigo real."
  - "El defecto mas grave fue no verificar ningun deployment: vercel.json rompio TODOS los deployments de Vercel desde el merge de la PR #18."
  - "Corregido en este intento: deploy.yml eliminado, vercel.json reducido al minimo (deployment success), .vercelignore agregado, ready-for-pr.ps1 arreglado y cubierto por test."
```

# Test report 2 — 14-pipeline-despliegue-vercel

Segundo intento de QA, motivado por el cierre defectuoso del primero: la PR
#18 se mergeó a `develop` antes de que existieran documentación, `decision.md`
y el estado `[-]` en `ROADMAP.md`, y el `test-report-1.md` aprobó la feature
declarando que "no se requirió workflow custom" mientras
`.github/workflows/deploy.yml` estaba efectivamente commiteado y mergeado.

## 1. Estado de partida verificado

| Verificación | Comando / fuente | Resultado |
|---|---|---|
| PR #18 mergeada a `develop` | `gh pr view 18` | `MERGED`, base `develop`, merge commit `887e0c0` |
| Commits sin mergear en la rama | `git log origin/develop..HEAD` | `22a00f0`, `59d4983`, `1939ea1` (toda la documentación) |
| Cierre post-merge | `gh run view 33106828811` | `failure` — `'14-pipeline-despliegue-vercel' existe en ROADMAP.md pero no esta en READY_FOR_PR` |
| `ROADMAP.md` en `origin/develop` | `git show origin/develop:ROADMAP.md` | `[ ] 14-...` (nunca pasó a `[-]`) |

## 2. Defectos encontrados y corregidos

### 2.1 `.github/workflows/deploy.yml` — nunca funcionó

| Evidencia | Resultado |
|---|---|
| `gh run list --workflow=deploy.yml` | 3 corridas, **3 fallidas**, duración 0s |
| `gh run view 33220326722` | "This run likely failed because of a workflow file issue" |
| `gh api repos/peter-evans/review-wait` | HTTP 404 — la action referenciada no existe |

Defectos adicionales por lectura del archivo: `environment.implicit` no es una
clave válida, y `vercel preview` / `vercel prod` / `--project` no son comandos
ni flags de la CLI de Vercel. Además, el workflow duplicaba lo que ya hace la
integración Git nativa, contra el criterio del spec.

**Corrección**: archivo eliminado. Ver `decision.md`.

### 2.2 `vercel.json` — rompía **todos** los deployments de Vercel

Éste resultó ser el defecto más grave, y no lo detectó el intento 1. Estado de
los deployments según la API de GitHub:

| Commit | Deployment | Detalle |
|---|---|---|
| `f606c75` (previo a `vercel.json`) | ✅ `success` | Zero-config de Vercel ya funcionaba |
| `888d972` (introduce `vercel.json`) | ❌ `failure` | `Environment Variable "VITE_SUPABASE_URL" references Secret "supabase_url", which does not exist` |
| `887e0c0` (merge de #18 a `develop`) | ❌ `failure` | Mismo error |
| `1939ea1` (head previo de la rama) | ❌ `failure` | Mismo error |

Es decir: **desde que la PR #18 se mergeó, `develop` no desplegaba.** La feature
cuyo objetivo era montar el pipeline de despliegue lo dejó roto, y el
`test-report-1.md` la aprobó sin comprobar ni un solo deployment.

Defectos del archivo original, verificados contra el repo:

| Defecto | Verificación |
|---|---|
| `build.env` con `@supabase_url` / `@supabase_anon_key` | Sintaxis de secretos de Vercel; esos secretos no existen → **causa del fallo** |
| `"framework": "vite"` | `grep -rn "vite\|VITE_"` sobre el repo: 0 coincidencias fuera del propio `vercel.json`; `package.json` no tiene script `build` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `api/` lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; `.env.example` no documenta ninguna `VITE_*` |
| `"runtime": "nodejs20"` | Falta el sufijo `.x`; además la versión de Node se controla con `engines.node` |
| rewrite `/api/:path*` → `/api/$1` | Destino con sintaxis incorrecta y redundante frente al ruteo nativo |
| Doc: `installCommand` = `echo 'No install required'` | Habría roto `api/`, que depende de `@supabase/supabase-js` y `nodemailer` |

**Corrección aplicada en dos pasos, guiada por el resultado real del CI:**

1. Primer intento: `vercel.json` reescrito con `framework: null`,
   `buildCommand: null`, `installCommand: null`, `outputDirectory: "."`,
   `functions.api/leads.js.runtime = nodejs20.x` y `headers`. El error de
   secretos desapareció, **pero el deployment siguió fallando** (commit
   `583677e`).
2. Corrección definitiva (commit `f203fbf`): dado que sin `vercel.json` el
   deployment era exitoso, el archivo se redujo a **sólo `headers`**, que es lo
   único que zero-config no aporta. **Deployment `success`.**

Regla derivada, ahora documentada en la doc técnica: `vercel.json` sólo declara
lo que la detección zero-config no puede inferir.

`vercel.json` validado como JSON: `python -c "json.load(open('vercel.json'))"` → OK.

### 2.3 `api/leads.test.js` se habría publicado como endpoint

Vercel convierte en Serverless Function todo `.js` bajo `api/`, de modo que
`api/leads.test.js` quedaría accesible como `/api/leads.test`.

**Corrección**: `.vercelignore` nuevo, excluyendo `*.test.js` y el material del
circuito agéntico (`runs/`, `scripts/`, `tests/`, `docs/`, `ROADMAP.md`, ...).

### 2.4 `scripts/ready-for-pr.ps1` reutilizaba PRs ya mergeadas

`Get-ExistingPr` usa `gh pr view <rama>`, que también devuelve PRs `MERGED`.
El script pedía el campo `state` pero no lo evaluaba, así que con la PR #18
mergeada habría salido con éxito sin crear ninguna PR nueva, dejando los
commits de corrección sin PR.

**Corrección**: sólo se reutiliza una PR en estado `OPEN`. Test nuevo
`test_ready_for_pr_creates_new_pr_when_previous_pr_is_merged`.

### 2.5 Enlaces de índice con formato inválido

`Assert-FeatureContract` rechazaba `- [pipeline-despliegue-vercel](...)`; el
commit `1939ea1` había reemplazado el título por el slug crudo. Corregido a
`- [Pipeline de despliegue Vercel](pipeline-despliegue-vercel.md)` en
`docs/tecnica/index.md` y `docs/usuario/index.md`.

## 3. Resultados de tests

| Suite | Comando | Resultado |
|---|---|---|
| Producto (API) | `npm test` | **158 pass / 0 fail** |
| Circuito | `python -m pytest tests/ --basetemp=<dir escribible>` | **33 pass / 0 fail** (32 previos + 1 nuevo) |
| Contrato de feature | `Assert-FeatureContract -Slug 14-pipeline-despliegue-vercel -Title 'Pipeline de despliegue Vercel' -RequireReadyRoadmap` | **CONTRATO OK** |

**Nota de entorno (no es un defecto del código)**: en este equipo `pytest`
aborta 31 tests en *setup* con `PermissionError: [WinError 5] Acceso denegado:
'C:\\Users\\<user>\\AppData\\Local\\Temp\\pytest-of-<user>'`. Es un problema de
permisos sobre el directorio temporal base de pytest. Con `--basetemp` apuntando
a un directorio escribible la suite corre completa. El CI de GitHub Actions
corre sobre Linux y no está afectado.

## 3.1 Verificación del pipeline real (PR #19)

A diferencia del intento 1, esta vez el pipeline se verificó ejecutándolo:

| Check | Commit `583677e` | Commit `f203fbf` |
|---|---|---|
| `test` (GitHub Actions) | ✅ pass | ✅ pass |
| `Vercel` (deployment Preview) | ❌ fail | ✅ **pass — "Deployment has completed"** |

El primer commit corrigió el error de secretos pero el deployment seguía
fallando; eso fue lo que motivó reducir `vercel.json` al mínimo. El resultado
es el **primer deployment exitoso desde que se mergeó la PR #18**.

Preview generada: `https://gi-clinicadental-r6c8iedyx-gi26.vercel.app`

Verificación por HTTP sobre esa URL: todas las rutas responden `302` hacia
`https://vercel.com/sso-api?...`. Es la **Deployment Protection (SSO) de
Vercel**, activa para Preview a nivel de proyecto — no un defecto del sitio.
La cabecera `X-Frame-Options: DENY` sí viaja en esa respuesta, lo que confirma
que el bloque `headers` de `vercel.json` está aplicándose.

**Límite de esta verificación**: por la protección SSO no se pudo ejercitar
anónimamente `GET /api/leads` (esperado `405`) ni comprobar que
`/api/leads.test` no exista. Quien apruebe la PR, con sesión de Vercel, debería
abrir la Preview y probar el formulario end-to-end antes de decidir `MERGE`.

## 4. Criterios de aceptación del spec

| Criterio | Estado | Evidencia |
|---|---|---|
| `develop` → Preview, `main` → Production | ✅ | Integración Git nativa; deployment Preview de la PR #19 en `success` |
| Cada PR genera URL Preview para HITL | ✅ | `https://gi-clinicadental-r6c8iedyx-gi26.vercel.app`, comentario automático en la PR #19 |
| Production sólo tras aprobación humana y merge a `main` | ✅ | `AGENTS.md` paso 8 + `main` como única rama de Production |
| Integración nativa priorizada; `deploy.yml` sólo si hay necesidad no cubierta | ✅ | Workflow eliminado; justificación en `decision.md` y doc técnica |
| `docs/tecnica/<slug>.md` y `docs/usuario/<slug>.md` | ✅ | Ambos presentes y actualizados |
| `decision.md` con decisiones demostrables | ✅ | Incluye la corrección de la ejecución fuera de orden |
| Enlaces exactos en ambos índices | ✅ | `Assert-FeatureContract` OK |
| `ROADMAP.md` en `[-]`, no `[x]` | ✅ | Línea 115 |

## 5. Veredicto

Aprobado. Queda pendiente la PR hacia `develop`, el CI en verde y la decisión
HITL. Al mergear, `ROADMAP.md` llevará `[-]`, condición que faltó en el intento
anterior para que `close-feature.ps1` pudiera marcar `[x]`.
