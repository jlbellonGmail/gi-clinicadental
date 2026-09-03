```yaml
status: approved
attempt: 2
feedback:
  - "Intento 1 se dio por cerrado sin que la implementacion estuviera realmente verificada: deploy.yml fallo en las 3 corridas registradas y ningun test lo cubria."
  - "vercel.json describia un stack (Vite) que no existe en el repo; ningun test comparaba la configuracion de despliegue contra el codigo real."
  - "Corregido en este intento: deploy.yml eliminado, vercel.json reescrito, .vercelignore agregado, ready-for-pr.ps1 arreglado y cubierto por test."
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

### 2.2 `vercel.json` — describía un stack inexistente

| Defecto | Verificación | Corrección |
|---|---|---|
| `"framework": "vite"` | `grep -rn "vite\|VITE_"` sobre el repo: **0 coincidencias** fuera del propio `vercel.json`; `package.json` no tiene script `build` | `framework: null`, `buildCommand: null` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `api/` lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; `.env.example` no documenta ninguna `VITE_*` | bloque `build.env` eliminado |
| `"runtime": "nodejs20"` | Vercel exige el sufijo `.x` | `nodejs20.x` sobre `api/leads.js` |
| rewrite `/api/:path*` → `/api/$1` | Destino con sintaxis incorrecta (`$1` en lugar de `:path*`) y redundante frente al ruteo nativo | `rewrites` eliminado |
| Install deshabilitado en la doc (`echo 'No install required'`) | `package.json` declara `@supabase/supabase-js` y `nodemailer`, requeridos por `api/leads.js` | `installCommand: null` (default `npm install`) |

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

## 4. Criterios de aceptación del spec

| Criterio | Estado | Evidencia |
|---|---|---|
| `develop` → Preview, `main` → Production | ✅ | Integración Git nativa; `docs/tecnica/pipeline-despliegue-vercel.md` |
| Cada PR genera URL Preview para HITL | ✅ | Integración nativa, comentario automático en la PR |
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
