# Decision: 02-inicializacion-supabase-schema - Inicialización del esquema Supabase

## Estado

MERGE aprobado por evidencias del circuito agéntico.

## Evidencias revisadas

- `runs/02-inicializacion-supabase-schema/spec.md`
- `runs/02-inicializacion-supabase-schema/audit-1.md`
- `runs/02-inicializacion-supabase-schema/test-report-1.md`

## Decisiones demostrables

- Migracion supabase/migrations/20260819210130_create_leads_table.sql: 14 columnas exactas segun el item del roadmap, CHECK de estado, defaults correctos.
- RLS habilitado sin policies para anon/authenticated + REVOKE ALL explicito (defensa en profundidad); service_role sigue operando via BYPASSRLS + default privileges de la plataforma Supabase (no declarados en la migracion, son responsabilidad de Supabase).
- Verificacion real contra Postgres genuino (pglite/WASM, PostgreSQL 18.3) ya que Docker no esta disponible (WSL deshabilitado a nivel de Windows, fuera de alcance modificarlo): 22 verificaciones, incluyendo que el rol anon real es bloqueado por RLS y service_role si puede operar.
- Hallazgo documentado: BYPASSRLS no equivale a privilegios de tabla completos; requiere GRANT ademas, que en Supabase real lo aporta un default privilege de plataforma.
- No se agrega codigo Node.js ni trigger de fecha_actualizacion: declarado fuera de alcance en el spec.

## Resultado

La feature queda apta para integrarse/cerrarse cuando GitHub confirme merge contra `develop` y el cierre automatico marque `ROADMAP.md`.
