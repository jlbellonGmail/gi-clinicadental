# Configuración de variables de entorno — documentación técnica

`.env.example` (raíz del repo) documenta las 9 variables que el stack
objetivo (Node.js serverless en Vercel + Supabase + Nodemailer/SMTP
Ferozo, ver `AGENTS.md`) va a consumir. No hay código todavía que las
lea — eso lo agregan las features `03` (endpoint) y `05`/`06`
(notificaciones).

## Variables

| Variable | Consumidor previsto | Sensibilidad | Formato |
|---|---|---|---|
| `SMTP_HOST` | `api/leads` (Nodemailer) | Server-only | hostname (Ferozo) |
| `SMTP_PORT` | `api/leads` (Nodemailer) | Server-only | numérico, `465` (TLS) |
| `SMTP_USER` | `api/leads` (Nodemailer) | Server-only, credencial | string |
| `SMTP_PASS` | `api/leads` (Nodemailer) | Server-only, credencial | string |
| `SMTP_FROM` | `api/leads` (Nodemailer) | Server-only | email remitente |
| `LEADS_NOTIFICATION_EMAIL` | `api/leads` (Nodemailer) | Server-only | email destino (clínica) |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase (frontend y backend) | **Pública** | URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (frontend y backend) | **Pública** (protegida por RLS) | string (JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/leads` (inserción server-side) | **Estrictamente server-only** | string (JWT), bypassea RLS |
| `SITE_URL` | Backend (links en emails, CORS si aplica) | No sensible | URL, distinta por entorno Vercel |

## Por qué `NEXT_PUBLIC_*` es pública y `SUPABASE_SERVICE_ROLE_KEY` no

Es la distinción de seguridad más importante de este archivo:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están
  pensadas para viajar al navegador (prefijo `NEXT_PUBLIC_` es la
  convención de Next.js para variables expuestas al cliente). Su
  seguridad depende de Row Level Security (RLS) en Supabase, no de
  mantenerlas en secreto (ver feature `02-inicializacion-supabase-schema`,
  que habilita RLS y bloquea `anon` para escritura directa).
- `SUPABASE_SERVICE_ROLE_KEY` bypassea RLS por completo. Si se filtra
  al cliente o a un log, cualquiera puede leer/escribir toda la tabla
  `leads` sin restricción. Debe usarse **exclusivamente** en código
  server-side (`api/leads`).

## `.gitignore`

```gitignore
# Environment / secrets
.env
.env.*
!.env.example
```

`.env.*` cubre `.env.local`, `.env.development`, `.env.production`,
`.env.development.local`, etc. La excepción `!.env.example` es
necesaria porque, sin ella, el patrón `.env.*` también ignoraría el
propio archivo de ejemplo.

## Nota sobre `NEXT_PUBLIC_*` sin Next.js todavía

El repo hoy es HTML/CSS/JS estático — no hay Next.js instalado. El
prefijo `NEXT_PUBLIC_` solo tiene efecto real (inyección en build time)
dentro de un proyecto Next.js. Se documentan las variables tal como las
pide el roadmap; si una feature futura elige un framework distinto a
Next.js para el frontend, debe revisarse si ese prefijo sigue teniendo
sentido o si corresponde otra convención de ese framework.

## Verificación de que `.gitignore` funciona

```powershell
"prueba=1" | Out-File -Encoding utf8 .env
git status --short          # .env no debe aparecer
git check-ignore -v .env    # debe reportar la regla que lo ignora
git status --short .env.example  # SI debe poder trackearse
Remove-Item .env
```
