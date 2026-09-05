-- Migración: crear tabla `leads`
-- Feature: 02-inicializacion-supabase-schema
--
-- Tabla de leads capturados desde el formulario de contacto del sitio.
-- Contiene datos personales de contacto (y potencialmente de salud vía
-- el campo libre `mensaje`) — RLS habilitado sin policies para `anon`/
-- `authenticated`: toda escritura/lectura pasa exclusivamente por el
-- backend server-side usando SUPABASE_SERVICE_ROLE_KEY (bypassea RLS
-- a nivel de Postgres; ver docs/tecnica/inicializacion-supabase-schema.md
-- para el detalle de por qué esto es suficiente y qué NO protege).

-- gen_random_uuid() vive en pgcrypto, habilitada por defecto en
-- proyectos Supabase. IF NOT EXISTS la deja como no-op si ya existe.
create extension if not exists pgcrypto;

create table leads (
    id                              uuid primary key default gen_random_uuid(),
    nombre                          text not null,
    email                           text not null,
    telefono                        text,
    servicio                        text,
    mensaje                         text,
    estado                          text not null default 'nuevo'
                                        check (estado in ('nuevo', 'contactado', 'confirmado', 'descartado')),
    origen                          text not null default 'formulario_web',
    consentimiento_privacidad       boolean not null,
    version_politica_privacidad     text not null,
    notificacion_clinica_enviada    boolean not null default false,
    confirmacion_paciente_enviada   boolean not null default false,
    fecha_creacion                  timestamptz not null default now(),
    fecha_actualizacion             timestamptz not null default now()
);

comment on table leads is 'Leads capturados desde el formulario de contacto. Datos personales de contacto; acceso exclusivo desde el backend (service_role).';
comment on column leads.mensaje is 'Campo libre del formulario: puede contener información sensible que el paciente decida compartir. No exponer sin control de acceso.';
comment on column leads.estado is 'Estado de seguimiento comercial del lead: nuevo, contactado, confirmado o descartado.';

-- RLS: habilitar y NO crear ninguna policy para anon/authenticated.
-- Con RLS habilitado y cero policies, Postgres deniega por defecto
-- todo acceso a esos roles. service_role tiene BYPASSRLS y sigue
-- pudiendo operar desde el backend sin necesidad de policies.
alter table leads enable row level security;

-- Defensa en profundidad explícita: revocar privilegios de tabla
-- directamente, no depender solo de la ausencia de policies.
revoke all on leads from anon, authenticated;
