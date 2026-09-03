# Decision: 14-pipeline-despliegue-vercel - Pipeline de despliegue Vercel

## Estado
READY_FOR_PR. Falta la decisión HITL sobre la PR que lleva esta corrección
a `develop`.

## Evidencias revisadas
- `runs/14-pipeline-despliegue-vercel/spec.md`
- `runs/14-pipeline-despliegue-vercel/audit-1.md`
- `runs/14-pipeline-despliegue-vercel/test-report-1.md`
- `runs/14-pipeline-despliegue-vercel/test-report-2.md`

## Corrección de la ejecución fuera de orden (PR #18)

La primera ejecución de esta feature rompió el circuito de `AGENTS.md`: el
commit `888d972` (`vercel.json` + `deploy.yml`) se mergeó a `develop` en la
PR #18 (2026-08-27) **antes** de que existieran spec, docs, `decision.md` y
el estado `[-]` en `ROADMAP.md`. Consecuencias verificadas:

- `post-merge-close-feature.yml` falló correctamente (run `33106828811`):
  `ROADMAP.md` tenía `[ ]`, no `[-]`, y el script sólo convierte `[-]` → `[x]`.
- Los commits posteriores (`22a00f0`, `59d4983`, `1939ea1`), que aportaron
  toda la documentación, quedaron sin PR: #18 ya estaba mergeada.
- El código mergeado quedó **contradiciendo su propia documentación**: este
  archivo afirmaba "no se creó `deploy.yml`" mientras `deploy.yml` estaba en
  `develop`.

## Decisiones de la corrección

- **`.github/workflows/deploy.yml` eliminado**: el workflow nunca funcionó —
  falló en las 3 corridas registradas (`33075819771`, `33106828473`,
  `33220326722`), todas con duración 0s y el diagnóstico de GitHub "workflow
  file issue". Referenciaba la action `peter-evans/review-wait@v2`, que no
  existe (HTTP 404), la clave inválida `environment.implicit`, y comandos que
  no son de la CLI de Vercel (`vercel preview`, `vercel prod`, `--project`).
  Además duplicaba lo que ya hace la integración Git nativa, contra el
  criterio explícito del spec. Su eliminación alinea el repo con la decisión
  que este mismo documento ya declaraba.

- **`vercel.json` reescrito**: la versión mergeada declaraba `"framework":
  "vite"` (el repo no tiene Vite ni bundler alguno), inyectaba
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` —variables que ningún archivo
  del proyecto lee; `api/` usa `NEXT_PUBLIC_SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY`, según `.env.example`—, fijaba el runtime
  inválido `nodejs20` (debe ser `nodejs20.x`) y definía un rewrite
  `/api/:path*` → `/api/$1` con sintaxis de destino incorrecta y redundante
  frente al ruteo nativo de Vercel.

- **`installCommand` queda en el default (`null`), no deshabilitado**: la
  documentación previa indicaba `echo 'No install required'`. Eso habría roto
  las funciones de `api/`, que dependen de `@supabase/supabase-js` y
  `nodemailer` declaradas en `package.json`. No hay build, pero sí install.

- **`.vercelignore` agregado**: Vercel publica como Serverless Function todo
  `.js` bajo `api/`, así que `api/leads.test.js` habría quedado expuesto como
  endpoint público `/api/leads.test`. Se excluye `*.test.js` y el material del
  circuito agéntico (`runs/`, `scripts/`, `tests/`, `docs/`), ajeno al sitio.

- **`scripts/ready-for-pr.ps1` corregido**: `gh pr view <rama>` devuelve
  también PRs ya `MERGED`, y el script reutilizaba esa PR y salía con éxito
  sin crear ninguna nueva — dejando los commits nuevos sin PR. Ahora sólo se
  reutiliza una PR en estado `OPEN`. Cubierto por el test
  `test_ready_for_pr_creates_new_pr_when_previous_pr_is_merged`.

- **Enlaces de índice corregidos**: `docs/tecnica/index.md` y
  `docs/usuario/index.md` tenían `- [pipeline-despliegue-vercel](...)`, que
  `Assert-FeatureContract` rechaza. Ahora usan el título exacto
  `Pipeline de despliegue Vercel`.

## Decisiones demostrables

- **Integración Git nativa de Vercel utilizada (sin workflow custom)**: La integración nativa de Vercel (Settings → Git → Connected Repository) cubre completamente los requisitos: Preview deployments automáticos en PRs hacia `develop`, Production deployment automático en merges a `main`, comentarios automáticos en PRs con Preview URLs. `.github/workflows/deploy.yml` no debe existir porque no hay necesidad no cubierta (no hay build steps, no hay notificaciones custom, variables de entorno se gestionan en Vercel UI). Ver "Corrección de la ejecución fuera de orden": el archivo llegó a mergearse y fue eliminado.

- **Configuración del proyecto versionada en `vercel.json`**: `framework: null`, `buildCommand: null`, `installCommand: null` (default `npm install`, necesario para las dependencias de `api/`), `outputDirectory: "."`, runtime `nodejs20.x` para `api/leads.js` y cabeceras de seguridad. Esto refleja que el proyecto es sitio estático + API serverless sin proceso de build.

- **Variables de entorno separadas por ambiente (Preview/Production)**: Configuradas en Vercel UI (Settings → Environment Variables) para ambos ambientes. Variables comunes (SMTP, Supabase) replicadas; `SITE_URL` diferencial por ambiente (Preview URL dinámica vs dominio Production). Secrets (`SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`) marcados como Encrypted. Claves públicas (`NEXT_PUBLIC_*`) expuestas al cliente protegidas por RLS en Supabase.

- **Rollback documentado**: Procedimiento principal: `git revert <commit> en main && git push origin main` → Vercel redeploya automáticamente versión anterior. Alternativa: Vercel UI → Deployments → Promote to Production. Preview deployments no requieren rollback manual (son efímeros).

- **Troubleshooting cubierto**: Casos documentados: Preview URL no generada, API `/api/leads` falla en Preview, emails no se envían, build falla. Incluye pasos de verificación en Vercel Dashboard, logs de Functions, variables de entorno, conectividad SMTP.

- **Seguridad validada**: Ninguna credencial en repo (`.env*` en `.gitignore`). Secrets solo en Vercel encrypted. RLS en Supabase: `anon` bloqueado para writes, solo `service_role` desde backend. Rate limiting activo en `/api/leads` en ambos ambientes.

- **Documentación técnica y de usuario creadas**: `docs/tecnica/pipeline-despliegue-vercel.md` (arquitectura, variables, rollback, troubleshooting, seguridad) y `docs/usuario/pipeline-despliegue-vercel.md` (flujo de trabajo equipo, checklist verificación Preview, HITL, FAQ). Índices actualizados via `scripts/update-doc-indexes.ps1`.

- **Rama feature**: `feature/14-pipeline-despliegue-vercel`. La corrección se
  ejecutó en el checkout principal (`D:/proyectos/gi-clinicadental`), no en un
  worktree dedicado: la rama ya existía con commits previos y `git worktree
  list` muestra un único checkout.

- **PR hacia `develop`**: PR #18 quedó mergeada con la implementación
  incompleta. Esta corrección requiere una PR nueva desde la misma rama, que
  es exactamente lo que habilita el arreglo de `ready-for-pr.ps1`.

## Resultado
La feature queda apta para integrarse/cerrarse cuando GitHub confirme merge contra `develop` y el cierre automático marque `ROADMAP.md`. Al mergear esa PR, `ROADMAP.md` ya llevará `[-] 14-pipeline-despliegue-vercel`, de modo que `close-feature.ps1` podrá marcar `[x]` — lo que falló en el intento anterior.