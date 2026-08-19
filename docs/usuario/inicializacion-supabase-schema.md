# Inicialización del esquema Supabase (tabla `leads`) — documentación de usuario

Cómo aplicar la migración de la tabla `leads` a un proyecto Supabase
real (Preview o Production).

## Opción A — SQL Editor del dashboard (más simple, manual)

1. Entrá al proyecto en [supabase.com](https://supabase.com) → **SQL
   Editor**.
2. Pegá el contenido completo de
   `supabase/migrations/20260819210130_create_leads_table.sql`.
3. Ejecutar. Si la tabla `leads` no existía todavía, se crea con RLS
   habilitado y sin acceso para `anon`.

## Opción B — Supabase CLI (recomendado si ya usás el CLI para el proyecto)

```powershell
supabase link --project-ref <tu-project-ref>
supabase db push
```

Esto aplica cualquier migración en `supabase/migrations/` que todavía
no esté aplicada al proyecto vinculado, en orden por timestamp.

## Cómo confirmar que quedó bien

En el SQL Editor:

```sql
-- La tabla existe con las columnas esperadas
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'leads';

-- RLS está habilitado
select relrowsecurity from pg_class where relname = 'leads';
-- debe devolver "t" (true)
```

## Importante

Esta migración **no inserta ni borra datos**, solo crea la tabla. No
hay riesgo de pérdida de datos existentes salvo que ya exista una
tabla `leads` con otra estructura (en ese caso la migración falla en
vez de sobrescribir nada — ver
`docs/tecnica/inicializacion-supabase-schema.md`).
