# Spec: Inicialización del esquema Supabase (tabla `leads`)

## Alcance

Crear una migración SQL declarativa y versionada (convención Supabase
CLI: `supabase/migrations/<timestamp>_<nombre>.sql`) que defina la
tabla `leads` con exactamente los campos pedidos, sus valores por
defecto, la restricción de valores válidos para `estado`, y Row Level
Security (RLS) habilitado de forma que el rol `anon` no pueda hacer
ninguna operación directa sobre la tabla.

Columnas:

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | PK, autogenerada |
| `nombre` | `text` | NOT NULL |
| `email` | `text` | NOT NULL |
| `telefono` | `text` | nullable |
| `servicio` | `text` | nullable |
| `mensaje` | `text` | nullable |
| `estado` | `text` | NOT NULL, default `'nuevo'`, CHECK IN (`nuevo`,`contactado`,`confirmado`,`descartado`) |
| `origen` | `text` | NOT NULL, default `'formulario_web'` |
| `consentimiento_privacidad` | `boolean` | NOT NULL |
| `version_politica_privacidad` | `text` | NOT NULL |
| `notificacion_clinica_enviada` | `boolean` | NOT NULL, default `false` |
| `confirmacion_paciente_enviada` | `boolean` | NOT NULL, default `false` |
| `fecha_creacion` | `timestamptz` | default `now()` |
| `fecha_actualizacion` | `timestamptz` | default `now()` |

RLS: `ALTER TABLE leads ENABLE ROW LEVEL SECURITY;` sin ninguna policy
para `anon`/`authenticated` → con RLS habilitado y cero policies,
Postgres deniega todo acceso a esos roles por defecto (comportamiento
estándar de Postgres/Supabase). `service_role` tiene `BYPASSRLS` a
nivel de Postgres y sigue pudiendo escribir desde el backend
(`SUPABASE_SERVICE_ROLE_KEY`, ya documentada en la feature `01`) sin
necesidad de policies. Se agrega además un `REVOKE ALL` explícito sobre
`anon`/`authenticated` como defensa en profundidad, no solo confiar en
la ausencia de policies.

## Fuera de alcance

- No se crea ninguna policy permitiendo lectura/escritura a `anon` ni
  `authenticated` (eso rompería el requisito explícito del ítem).
- No se agrega trigger para autoactualizar `fecha_actualizacion` en
  cada `UPDATE` — el spec no lo pide; queda como nota en "Riesgos" para
  que la feature que actualice leads (ej. desde el panel de Supabase)
  decida si lo necesita.
- No se conecta ningún código de aplicación a esta tabla (eso es la
  feature `03-endpoint-recepcion-leads`).
- No se ejecuta la migración contra el proyecto Supabase real de
  producción/preview — es responsabilidad del humano aplicarla ahí
  (`supabase db push` o SQL Editor del dashboard) cuando decida
  hacerlo; esta feature entrega el archivo versionado y su
  verificación local.
- No se agrega el CLI de Supabase (`supabase init` completo) al repo —
  solo la carpeta `supabase/migrations/` con el archivo SQL, que es lo
  mínimo que el CLI espera para reconocer una migración si en el
  futuro se inicializa el proyecto completo.

## Contexto

`AGENTS.md` define Supabase Postgres como base de datos objetivo, con
"migraciones SQL declarativas y versionadas dentro del repositorio" y
acceso de escritura exclusivo desde el backend vía
`SUPABASE_SERVICE_ROLE_KEY` (ya documentada en la feature `01`). Esta
es la primera pieza real de esquema: sin esta tabla, ninguna feature de
backend (endpoint, notificaciones) tiene dónde persistir un lead.

## Criterios de aceptación

1. Existe `supabase/migrations/<timestamp>_create_leads_table.sql`
   (nombre con timestamp real, formato `YYYYMMDDHHMMSS`, convención
   del CLI de Supabase para ordenar migraciones).
2. El SQL crea la tabla `leads` con exactamente las 14 columnas, tipos
   y defaults de la tabla de arriba.
3. `estado` tiene un `CHECK` que solo permite
   `nuevo`/`contactado`/`confirmado`/`descartado`.
4. `id` usa `uuid` con generación automática (`gen_random_uuid()` de la
   extensión `pgcrypto`, disponible por defecto en proyectos Supabase).
5. RLS habilitado (`ENABLE ROW LEVEL SECURITY`) y sin policies que
   habiliten a `anon`; `REVOKE ALL ... FROM anon, authenticated`
   explícito.
6. **Verificación real, no solo lectura del SQL**: aplicar la
   migración contra una instancia Postgres real (local, vía Docker) y
   confirmar con consultas reales:
   - la tabla y columnas existen con los tipos/defaults correctos;
   - insertar un lead válido funciona y toma los defaults esperados
     (`estado='nuevo'`, `origen='formulario_web'`,
     `notificacion_clinica_enviada=false`,
     `confirmacion_paciente_enviada=false`);
   - insertar con `estado` fuera de la lista permitida falla (viola el
     `CHECK`);
   - insertar sin `nombre`/`email` falla (viola `NOT NULL`);
   - con un rol equivalente a `anon` (sin `BYPASSRLS`), cualquier
     `SELECT`/`INSERT` sobre `leads` es rechazado por RLS.
7. Debe existir `docs/tecnica/inicializacion-supabase-schema.md`, no
   vacío, con el detalle de columnas, constraints y la explicación de
   por qué RLS+cero-policies alcanza para bloquear `anon` (para que
   quien mantenga el código entienda el mecanismo, no solo que "está
   bloqueado").
8. Debe existir `docs/usuario/inicializacion-supabase-schema.md`, no
   vacío, explicando cómo aplicar la migración a un proyecto Supabase
   real (dashboard SQL Editor o `supabase db push`).
9. `runs/02-inicializacion-supabase-schema/decision.md` existe, y hay
   enlaces exactos en `docs/tecnica/index.md` y `docs/usuario/index.md`.

## Casos borde a contemplar

- `email`/`nombre` vacíos (`''`) no violan `NOT NULL` en Postgres (un
  string vacío no es `NULL`) — el spec no pide validar formato de
  email ni longitud mínima a nivel de base de datos; esa validación
  aplicativa es explícitamente de la feature `03`
  (`endpoint-recepcion-leads`), no de esta.
- `telefono`/`servicio`/`mensaje` son opcionales (`NULL` permitido) —
  el formulario actual (`index.html`) ya refleja esto: `telefono` ni
  siquiera es un campo del form hoy, `mensaje` es explícitamente
  opcional.
- Reintentar aplicar la misma migración dos veces debe fallar de forma
  clara (`relation "leads" already exists"`), no corromper nada — es
  el comportamiento estándar esperado de una migración no idempotente;
  se documenta así, no se agrega `IF NOT EXISTS` porque ocultaría
  reejecuciones accidentales en un esquema que después va a tener más
  migraciones incrementales.
- El rol `service_role` de Supabase tiene el atributo `BYPASSRLS` a
  nivel de Postgres — esto significa que RLS **no** protege contra un
  backend mal escrito que use la `service_role` key; la única defensa
  ahí es que esa clave nunca llegue al cliente (ya cubierto por la
  feature `01`). Se documenta esta distinción para que no se asuma que
  RLS por sí sola hace todo el trabajo de seguridad.

## Riesgos / supuestos

- Supuesto: la extensión `pgcrypto` (para `gen_random_uuid()`) está
  habilitada por defecto en proyectos Supabase nuevos — es el caso
  estándar documentado por Supabase; si algún proyecto la tuviera
  deshabilitada, la migración fallaría de forma explícita y visible al
  aplicarla (no en silencio), no es un fallo que esta feature pueda
  prevenir sin acceso al proyecto real.
- Riesgo: no hay proyecto Supabase real conectado en este entorno de
  desarrollo/CI — la verificación del criterio 6 se hace contra
  Postgres genérico vía Docker (mismo motor, mismas garantías de SQL
  estándar y RLS), no contra Supabase específicamente. Queda como
  verificación pendiente en producción/preview cuando el humano aplique
  la migración al proyecto real (ver `docs/usuario/`).
- Riesgo aceptado: sin trigger de `fecha_actualizacion`, esa columna
  solo se actualiza si el código que hace el `UPDATE` la setea
  explícitamente. Se documenta como nota técnica, no se resuelve acá
  (fuera de alcance).
