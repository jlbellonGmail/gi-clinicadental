# Acceso contextual del Core

La aplicación usa el Core para Organizations, Sites, memberships, roles,
permisos y auditoría. Una sesión autenticada debe enviar el JWT de Supabase y
el encabezado `x-organization-id`; para una operación acotada, también
`x-site-id`. Si falta identidad, membership activa, permiso o acceso explícito
al Site, la respuesta es denegada.

La infraestructura Supabase la configura ClínicaDental. El Core usa el schema
`core` y la tabla `public.leads` continúa dedicada al formulario de contacto.
Todavía no hay funciones de pacientes, profesionales, turnos ni historias
clínicas.
