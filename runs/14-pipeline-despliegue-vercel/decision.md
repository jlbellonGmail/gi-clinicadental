# Decision: 14-pipeline-despliegue-vercel - Pipeline de despliegue Vercel

## Estado
MERGE aprobado por evidencias del circuito agéntico.

## Evidencias revisadas
- `runs/14-pipeline-despliegue-vercel/spec.md`
- `runs/14-pipeline-despliegue-vercel/audit-1.md`
- `runs/14-pipeline-despliegue-vercel/test-report-1.md`

## Decisiones demostrables

- **Integración Git nativa de Vercel utilizada (sin workflow custom)**: La integración nativa de Vercel (Settings → Git → Connected Repository) cubre completamente los requisitos: Preview deployments automáticos en PRs hacia `develop`, Production deployment automático en merges a `main`, comentarios automáticos en PRs con Preview URLs. No se creó `.github/workflows/deploy.yml` porque no hay necesidad no cubierta (no hay build steps, no hay notificaciones custom, variables de entorno se gestionan en Vercel UI).

- **Configuración de Vercel Project Settings documentada**: Framework Preset = "Other", Build Command = `echo 'No build step required'`, Output Directory = `.`, Install Command = `echo 'No install required'`, Node.js Version = 20.x, Root Directory = `.`. Esto refleja que el proyecto es sitio estático + API serverless sin proceso de build.

- **Variables de entorno separadas por ambiente (Preview/Production)**: Configuradas en Vercel UI (Settings → Environment Variables) para ambos ambientes. Variables comunes (SMTP, Supabase) replicadas; `SITE_URL` diferencial por ambiente (Preview URL dinámica vs dominio Production). Secrets (`SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`) marcados como Encrypted. Claves públicas (`NEXT_PUBLIC_*`) expuestas al cliente protegidas por RLS en Supabase.

- **Rollback documentado**: Procedimiento principal: `git revert <commit> en main && git push origin main` → Vercel redeploya automáticamente versión anterior. Alternativa: Vercel UI → Deployments → Promote to Production. Preview deployments no requieren rollback manual (son efímeros).

- **Troubleshooting cubierto**: Casos documentados: Preview URL no generada, API `/api/leads` falla en Preview, emails no se envían, build falla. Incluye pasos de verificación en Vercel Dashboard, logs de Functions, variables de entorno, conectividad SMTP.

- **Seguridad validada**: Ninguna credencial en repo (`.env*` en `.gitignore`). Secrets solo en Vercel encrypted. RLS en Supabase: `anon` bloqueado para writes, solo `service_role` desde backend. Rate limiting activo en `/api/leads` en ambos ambientes.

- **Documentación técnica y de usuario creadas**: `docs/tecnica/pipeline-despliegue-vercel.md` (arquitectura, variables, rollback, troubleshooting, seguridad) y `docs/usuario/pipeline-despliegue-vercel.md` (flujo de trabajo equipo, checklist verificación Preview, HITL, FAQ). Índices actualizados via `scripts/update-doc-indexes.ps1`.

- **Rama feature y worktree**: Rama `feature/14-pipeline-despliegue-vercel` en worktree `../worktrees/pipeline-despliegue-vercel/` (este directorio). Commits realizados en esta rama.

- **PR hacia `develop`**: Se creará tras QA aprobado con evidencias completas (resumen, tests, auditoría, checklist, riesgos, enlaces a spec/docs).

## Resultado
La feature queda apta para integrarse/cerrarse cuando GitHub confirme merge contra `develop` y el cierre automático marque `ROADMAP.md`.