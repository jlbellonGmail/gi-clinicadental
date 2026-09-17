# Spec: 14-pipeline-despliegue-vercel

## Resumen
Configurar el pipeline de despliegue en Vercel para que `develop` sea la rama de integración con despliegues Preview y `main` sea la rama estable con despliegue Production. Cada Pull Request debe generar una URL Preview para auditoría técnica y aprobación HITL. Solo después de aprobación humana y merge autorizado hacia `main` se actualiza el sitio público.

## Contexto
- El repositorio ya tiene `main` (baseline de la landing page) y `develop` (creada en la migración inicial).
- Vercel está configurado como hosting objetivo según `AGENTS.md`.
- La integración Git nativa de Vercel debe ser la opción principal; `.github/workflows/deploy.yml` solo si hay necesidad no cubierta.
- No hay workflows de despliegue existentes.

## Alcance
### Incluye
1. Conectar el repositorio a Vercel (si no está conectado) y configurar:
   - `develop` → Preview deployments (cada push/PR genera URL única)
   - `main` → Production deployment
2. Verificar que la integración Git nativa de Vercel genera Preview URLs automáticamente en PRs hacia `develop`.
3. Crear `.github/workflows/deploy.yml` **solo si** la integración nativa no cubre algún requisito (ej. variables de entorno específicas por ambiente, pasos de build personalizados, notificaciones custom).
4. Documentar en `docs/tecnica/14-pipeline-despliegue-vercel.md` la arquitectura de despliegue, variables de entorno por ambiente, y procedimiento de rollback.
5. Documentar en `docs/usuario/14-pipeline-despliegue-vercel.md` cómo el equipo usa Preview URLs para auditoría y aprobación HITL.
6. Actualizar índices de documentación via `scripts/update-doc-indexes.ps1`.
7. Crear `runs/14-pipeline-despliegue-vercel/decision.md` con decisiones demostrables.

### Excluye
- Configuración de dominio personalizado (fuera de alcance, se hace en Vercel UI).
- Configuración de Vercel Edge Functions / Middleware (no requerido para esta landing estática + API serverless).
- Monitoreo/alertas de despliegue (parte de feature 15-observabilidad-y-operacion).

## Criterios de aceptación
1. **Despliegue Preview funcional**: Al abrir una PR hacia `develop`, Vercel genera una URL Preview accesible y el sitio carga correctamente (HTML/CSS/JS + API `/api/leads`).
2. **Despliegue Production funcional**: Al mergear a `main`, Vercel despliega a Production y el sitio público se actualiza.
3. **Variables de entorno separadas**: Preview y Production usan variables de entorno distintas configuradas en Vercel (SMTP, Supabase, etc.), sin credenciales en el repo.
4. **Integración Git nativa verificada**: No se requiere workflow custom a menos que haya necesidad demostrada; si se crea `deploy.yml`, debe ser mínimo y justificado.
5. **Documentación técnica creada**: `docs/tecnica/14-pipeline-despliegue-vercel.md` existe y cubre arquitectura, variables, rollback, troubleshooting.
6. **Documentación de usuario creada**: `docs/usuario/14-pipeline-despliegue-vercel.md` existe y explica uso de Preview URLs para HITL.
7. **Índices actualizados**: `docs/tecnica/index.md` y `docs/usuario/index.md` tienen enlaces exactos a los nuevos docs (via script).
8. **Decision.md creado**: `runs/14-pipeline-despliegue-vercel/decision.md` registra decisiones clave (ej. por qué no se creó workflow custom, configuración de Vercel project settings).
9. **PR hacia `develop` creada**: Con evidencias completas (resumen, tests, auditoría, checklist, riesgos, enlaces a spec/docs).
10. **CI verde**: GitHub Actions CI pasa en la PR antes de solicitar decisión HITL.

## Riesgos y consideraciones
- **Credenciales en Vercel**: Verificar que todas las secrets (SMTP, Supabase service_role, etc.) estén configuradas en Vercel para ambos ambientes (Preview y Production) y **nunca** en el repo.
- **API Serverless en Preview**: Las funciones `/api/leads` deben funcionar en Preview deployments; validar que Supabase RLS y service_role key funcionan correctamente en ambiente Preview.
- **Dominio de confirmación de correo**: Los emails transaccionales (features 5 y 6) deben usar `SITE_URL` correcto por ambiente (Preview URL vs Production URL) para enlaces en correos.
- **Rate limiting en Preview**: El rate limiting (feature 4) debe estar activo en Preview para pruebas realistas.
- **Rollback**: Documentar procedimiento rápido de rollback en Production (revert en `main` + redeploy automático).

## Decisiones técnicas previas (referencia)
- `AGENTS.md`: Hosting en Vercel, `develop` para Preview, `main` para Production.
- Features 01-13 ya implementadas: variables de entorno, Supabase schema, API leads, antispam, SMTP Ferozo, confirmación paciente, seguridad/privacidad, conexión frontend, rediseño, datos contacto, SEO/accesibilidad, entregabilidad correo, pruebas integrales.
- `.env.example` ya existe con variables documentadas (feature 01).
- No hay proceso de build (sitio estático + API serverless Node.js).

## Entregables
- `runs/14-pipeline-despliegue-vercel/spec.md` (este archivo)
- `runs/14-pipeline-despliegue-vercel/audit-1.md` (por reviewer-agent)
- `runs/14-pipeline-despliegue-vercel/test-report-1.md` (por qa-agent)
- `runs/14-pipeline-despliegue-vercel/decision.md` (por builder-agent)
- `docs/tecnica/14-pipeline-despliegue-vercel.md` (por builder-agent)
- `docs/usuario/14-pipeline-despliegue-vercel.md` (por builder-agent)
- Índices actualizados via `scripts/update-doc-indexes.ps1 14-pipeline-despliegue-vercel "Pipeline de despliegue Vercel"`
- Rama `feature/14-pipeline-despliegue-vercel` en worktree `../worktrees/pipeline-despliegue-vercel/`
- PR hacia `develop` con CI verde