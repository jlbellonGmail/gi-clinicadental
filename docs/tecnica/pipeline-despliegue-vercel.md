# Pipeline de Despliegue Vercel — Documentación Técnica

## Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL                                    │
│  ┌─────────────────────┐         ┌─────────────────────────┐   │
│  │   Preview (develop) │         │    Production (main)    │   │
│  │  ┌───────────────┐  │         │  ┌───────────────────┐  │   │
│  │  │ Static Files  │  │         │  │ Static Files      │  │   │
│  │  │ (HTML/CSS/JS) │  │         │  │ (HTML/CSS/JS)     │  │   │
│  │  └───────────────┘  │         │  └───────────────────┘  │   │
│  │  ┌───────────────┐  │         │  ┌───────────────────┐  │   │
│  │  │ Serverless    │  │         │  │ Serverless        │  │   │
│  │  │ Functions     │  │         │  │ Functions         │  │   │
│  │  │ /api/leads    │  │         │  │ /api/leads        │  │   │
│  │  └───────────────┘  │         │  └───────────────────┘  │   │
│  └──────────┬──────────┘         └───────────┬─────────────┘   │
│             │                                 │                │
│             ▼                                 ▼                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Environment Variables (por ambiente)        │   │
│  │  Preview: SMTP_*, SUPABASE_*, SITE_URL=preview-url      │   │
│  │  Production: SMTP_*, SUPABASE_*, SITE_URL=prod-url      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Despliegue

1. **Push a `develop` / PR hacia `develop`** → Vercel detecta cambio → Build + Deploy Preview → Genera URL única (`https://gi-clinicadental-git-develop-<user>.vercel.app`)
2. **Merge a `main`** (tras aprobación HITL) → Vercel detecta cambio en `main` → Build + Deploy Production → Actualiza `https://gi-clinicadental.vercel.app` (o dominio custom)

### Integración Git Nativa

- **Sin workflow custom**: Se utiliza la integración Git nativa de Vercel (Settings → Git → Connected Repository).
- **Detección automática**: Vercel detecta pushes a `develop` y `main` y despliega automáticamente.
- **Preview Deployments**: Cada PR hacia `develop` genera un deployment Preview con URL única y comentario automático en la PR.
- **Production Deployment**: Solo merges a `main` disparan deployment Production.

### Configuración versionada: `vercel.json`

**Regla de esta feature: `vercel.json` sólo declara lo que la detección
zero-config de Vercel no puede inferir.** Está verificado que sin
`vercel.json` el proyecto desplegaba correctamente (deployment del commit
`f606c75`, estado `success`), y que la primera versión del archivo rompió
todos los deployments posteriores. Cada clave agregada es una oportunidad de
contradecir al repo, así que el archivo se mantiene mínimo:

| Clave | Motivo |
|-------|--------|
| `headers` | Cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) para todas las rutas. Es lo único que zero-config no aporta. |

Lo que **no** se declara, y por qué:

- **`framework` / `buildCommand` / `outputDirectory`**: Vercel ya detecta un
  sitio estático sin build (`package.json` no define script `build`) y sirve
  la raíz del repo.
- **`installCommand`**: debe quedar en el default. Las funciones de `api/`
  dependen de `@supabase/supabase-js` y `nodemailer`; deshabilitar el install
  las rompería. No hay build, pero sí install.
- **`functions` / `runtime`**: la versión de Node se controla con
  `engines.node` en `package.json`, no con `functions.runtime`.
- **`rewrites`**: Vercel enruta `api/leads.js` a `/api/leads` de forma nativa.
- **Variables de entorno**: viven en Vercel (Settings → Environment
  Variables), nunca en `vercel.json`. La primera versión del archivo las
  declaraba con la sintaxis de secretos `@supabase_url`, lo que hizo fallar
  todos los deployments con `Environment Variable "VITE_SUPABASE_URL"
  references Secret "supabase_url", which does not exist`.

### Qué se excluye del deployment: `.vercelignore`

Vercel convierte en Serverless Function **todo** archivo `.js` dentro de
`api/`. Sin exclusión explícita, `api/leads.test.js` quedaría publicado
como el endpoint `/api/leads.test`. `.vercelignore` excluye `*.test.js` y,
además, el material del circuito agéntico (`runs/`, `scripts/`, `tests/`,
`docs/`, `ROADMAP.md`, `AGENTS.md`), que no forma parte del sitio público.

### Por qué no hay `.github/workflows/deploy.yml`

La integración Git nativa cubre los tres requisitos del spec (Preview por
PR, Production sólo desde `main`, URL de Preview para la auditoría HITL),
así que la condición del spec para crear un workflow propio —"solo si hay
una necesidad no cubierta"— no se cumple. Un `deploy.yml` que invocara la
CLI de Vercel además duplicaría cada deployment: uno disparado por la
integración nativa y otro por el workflow.

La aprobación HITL no se implementa como job de CI: es la revisión humana
de la PR descrita en `AGENTS.md` (paso 8), y el gate de Production es que
sólo `main` despliega a producción.

## Variables de Entorno por Ambiente

### Variables Comunes (configuradas en ambos ambientes)

| Variable | Descripción | Ejemplo Preview | Ejemplo Production |
|----------|-------------|-----------------|-------------------|
| `SMTP_HOST` | Host SMTP Ferozo | `smtp.ferozo.com` | `smtp.ferozo.com` |
| `SMTP_PORT` | Puerto SMTP TLS | `465` | `465` |
| `SMTP_USER` | Usuario SMTP | `notificaciones@sonriemas.com` | `notificaciones@sonriemas.com` |
| `SMTP_PASS` | Contraseña SMTP | `***` (secreto) | `***` (secreto) |
| `SMTP_FROM` | Remitente emails | `Sonríe más <noreply@sonriemas.com>` | `Sonríe más <noreply@sonriemas.com>` |
| `LEADS_NOTIFICATION_EMAIL` | Email clínica para notificaciones | `clinica@sonriemas.com` | `clinica@sonriemas.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública Supabase | `https://xxx.supabase.co` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima Supabase | `eyJ...` (pública) | `eyJ...` (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role (solo backend) | `eyJ...` (secreto) | `eyJ...` (secreto) |

### Variables Diferenciales por Ambiente

| Variable | Preview | Production |
|----------|---------|------------|
| `SITE_URL` | `https://gi-clinicadental-git-develop-<user>.vercel.app` | `https://gi-clinicadental.vercel.app` (o dominio custom) |

**Nota**: `SITE_URL` se usa en los emails transaccionales (features 5 y 6) para generar enlaces correctos. En Preview apunta a la URL Preview dinámica; en Production al dominio final.

### Configuración en Vercel UI

1. Ir a **Settings → Environment Variables**
2. Para cada variable: agregar valor para **Preview** y **Production** por separado
3. Marcar secrets (`SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`) como **Encrypted**
4. `NEXT_PUBLIC_*` son públicas (expuestas al cliente), el resto solo servidor

## Procedimiento de Rollback

### Rollback en Production (main)

```bash
# Opción 1: Revert del commit en main (recomendado)
git checkout main
git revert <commit-hash>  # Crea commit de revert
git push origin main      # Despliega automáticamente versión anterior

# Opción 2: Redeploy anterior en Vercel UI
# Vercel Dashboard → Deployments → Seleccionar deployment anterior → "Promote to Production"
```

### Rollback en Preview (develop)

- Los Preview deployments son efímeros; no requieren rollback manual.
- Si un cambio en `develop` rompe Preview: hacer commit fix en `develop` o revert en `develop` → nuevo Preview deployment automático.

### Consideraciones de Rollback

- **Base de datos (Supabase)**: Los rollbacks de código no revierten datos en Supabase. Los leads insertados permanecen.
- **Emails ya enviados**: No se pueden "desenviar". El rollback de código previene futuros envíos con lógica incorrecta.
- **Variables de entorno**: Cambios en Vercel UI son inmediatos; no requieren redeploy a menos que el código cachee valores al startup (no es el caso aquí).

## Troubleshooting

### Preview URL no se genera en PR
1. Verificar que la PR sea hacia `develop` (no hacia `main`)
2. Verificar en Vercel Dashboard → Deployments que el deployment Preview se creó
3. Verificar que el repositorio esté conectado en Vercel Settings → Git
4. Revisar logs de build en Vercel por errores

### API `/api/leads` falla en Preview
1. Verificar variables de entorno Supabase en Preview (service_role key, URL)
2. Verificar RLS en Supabase: `service_role` bypassea RLS, `anon` está bloqueado para writes
3. Verificar logs de función serverless en Vercel Dashboard → Functions → `/api/leads`

### Emails no se envían en Preview
1. Verificar `SMTP_*` variables en Preview environment
2. Verificar `SITE_URL` apunta a Preview URL correcta
3. Verificar conectividad SMTP desde Vercel (puerto 465 TLS)
4. Revisar logs de función `/api/leads` para errores de Nodemailer

### Build falla en Vercel
- Este proyecto no tiene build step (sitio estático + API serverless)
- Si falla: revisar que `package.json` no tenga scripts de build requeridos
- Verificar Node.js version 20.x en Project Settings

## Seguridad

- **Ninguna credencial en el repo**: `.env`, `.env.local`, `.env.*` en `.gitignore`
- **Secrets solo en Vercel**: `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY` marcados como encrypted
- **Claves públicas en frontend**: Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (protegidas por RLS)
- **RLS en Supabase**: `anon` role bloqueado para writes; solo `service_role` desde backend puede insertar leads
- **Rate limiting**: Activo en `/api/leads` (feature 4) en ambos ambientes

## Referencias

- Spec: `runs/v1.0.0-producto/14-pipeline-despliegue-vercel/spec.md`
- Auditoría: `runs/v1.0.0-producto/14-pipeline-despliegue-vercel/audit-1.md`
- Decisiones: `runs/v1.0.0-producto/14-pipeline-despliegue-vercel/decision.md`
- Documentación de usuario: `docs/usuario/14-pipeline-despliegue-vercel.md`
- AGENTS.md: Secciones Stack, Hosting, CI/CD, Git, Variables de entorno
