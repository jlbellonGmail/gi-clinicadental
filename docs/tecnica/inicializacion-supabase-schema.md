# Inicialización del esquema Supabase (tabla `leads`) — documentación técnica

Migración SQL declarativa y versionada:
`supabase/migrations/20260819210130_create_leads_table.sql`.

## Columnas

| Columna | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | requiere extensión `pgcrypto` (habilitada por la propia migración con `IF NOT EXISTS`) |
| `nombre` | `text` | `NOT NULL` | sin validación de formato/longitud a nivel DB — eso es responsabilidad del endpoint (feature `03`) |
| `email` | `text` | `NOT NULL` | ídem |
| `telefono` | `text` | nullable | el formulario actual no lo pide todavía |
| `servicio` | `text` | nullable | |
| `mensaje` | `text` | nullable | campo libre; puede contener información sensible que el paciente decida compartir |
| `estado` | `text` | `NOT NULL default 'nuevo'`, `CHECK` | valores permitidos: `nuevo`, `contactado`, `confirmado`, `descartado` |
| `origen` | `text` | `NOT NULL default 'formulario_web'` | deja lugar a otros orígenes futuros (ej. carga manual) sin cambiar el esquema |
| `consentimiento_privacidad` | `boolean` | `NOT NULL` | sin default: cada insert debe declararlo explícitamente |
| `version_politica_privacidad` | `text` | `NOT NULL` | qué versión de la política aceptó el paciente (ver feature `07`) |
| `notificacion_clinica_enviada` | `boolean` | `NOT NULL default false` | lo actualiza el backend tras enviar el email a la clínica (feature `05`) |
| `confirmacion_paciente_enviada` | `boolean` | `NOT NULL default false` | ídem, confirmación al paciente (feature `06`) |
| `fecha_creacion` | `timestamptz` | `NOT NULL default now()` | |
| `fecha_actualizacion` | `timestamptz` | `NOT NULL default now()` | **no tiene trigger de auto-actualización** — ver "Riesgos" abajo |

## RLS: por qué bloquea a `anon` sin necesitar policies explícitas

Postgres deniega todo acceso a una tabla con RLS habilitado si no hay
ninguna policy que lo permita explícitamente — esto aplica a
`SELECT`/`INSERT`/`UPDATE`/`DELETE` por igual. La migración:

```sql
alter table leads enable row level security;
revoke all on leads from anon, authenticated;
```

No crea ninguna policy → `anon` y `authenticated` (los dos roles que
usan las claves `NEXT_PUBLIC_SUPABASE_ANON_KEY`/tokens de usuario) no
pueden hacer nada sobre `leads`, ni siquiera `SELECT`. El `REVOKE` es
una segunda capa explícita (a nivel de privilegios de tabla, no solo
de policies) — redundante con RLS por diseño, no por error.

**`service_role` (la clave `SUPABASE_SERVICE_ROLE_KEY`, feature `01`)
tiene el atributo `BYPASSRLS` en Postgres: ignora RLS por completo,
policies o no.** Es el mecanismo por el que el backend puede escribir
leads sin necesitar ninguna policy. Esto también significa que RLS
**no** protege contra un uso indebido de esa clave — su seguridad
depende enteramente de que nunca llegue al cliente/frontend/logs (ver
`docs/tecnica/configuracion-variables-entorno.md`).

## Verificación real (no solo lectura del SQL)

Se aplicó la migración contra una instancia Postgres real (Docker,
`postgres:16`) y se verificó con consultas reales — ver
`runs/02-inicializacion-supabase-schema/test-report-1.md` para la
evidencia completa (comandos y salida capturada).

## Riesgos / notas técnicas

- **Sin trigger de `fecha_actualizacion`**: la columna solo cambia si
  el código que hace el `UPDATE` la setea explícitamente
  (`fecha_actualizacion = now()`). No hay un trigger `BEFORE UPDATE`
  automático — decisión deliberada, fuera del alcance pedido para esta
  feature. Si una feature futura lo necesita, agregar una función +
  trigger es una migración incremental aparte, no una edición de esta.
- **Migración no idempotente a propósito**: reaplicarla sobre una base
  que ya tiene `leads` falla (`relation "leads" already exists`). Es
  el comportamiento esperado de una migración inicial en un esquema
  versionado — no se agrega `IF NOT EXISTS` en el `CREATE TABLE`
  porque ocultaría reejecuciones accidentales.
- Esta migración se verificó contra Postgres genérico, no contra un
  proyecto Supabase real (no hay uno conectado en este entorno). El
  motor SQL y el mecanismo de RLS son los mismos; falta la aplicación
  real al proyecto de Vercel/Supabase, que le corresponde al humano
  (ver `docs/usuario/inicializacion-supabase-schema.md`).
