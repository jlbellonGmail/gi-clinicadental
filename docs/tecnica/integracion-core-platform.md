# Integración con GI-PLATFORM-CORE

ClínicaDental consume el contrato público `0.1.0` mediante
`api/_lib/core-supabase.js`. La aplicación anfitriona es responsable de
configurar el cliente Supabase server-side con `NEXT_PUBLIC_SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`; el módulo selecciona el schema `core` y no
expone ni modifica `public.leads`.

La identidad se resuelve desde el Bearer JWT de Supabase Auth. La solicitud
debe aportar `x-organization-id` y puede aportar `x-site-id`. El módulo
construye `TenantContext`, consulta memberships, roles, permisos y `site_access`
con deny-by-default, y registra cada decisión en `core.audit_events`.

La migración fuente de las tablas `core.*` vive en GI-PLATFORM-CORE:
`supabase/migrations/20260918000000_core_schema.sql`. Debe aplicarse antes de
activar estas funciones en el entorno de ClínicaDental. La tabla de negocio
`public.leads` continúa siendo propiedad exclusiva de ClínicaDental.

No se implementan aún pacientes, profesionales, turnos, historias clínicas,
CRM, facturación, chatbot, Voice ni GI-OT. Un futuro `gi-vertical-dental`
deberá depender del Core y recibir infraestructura de su anfitrión; no debe
duplicar este cliente ni contener UI de SONRÍE+.
