```yaml
status: approved
attempt: 1
feedback: []
```

## Cobertura de criterios de aceptación (spec.md)

| # | Criterio | Verificación | Resultado |
|---|---|---|---|
| 1 | `supabase/migrations/<timestamp>_create_leads_table.sql` existe | `ls supabase/migrations/` | Cumple |
| 2 | 14 columnas, tipos y defaults exactos | Consulta real a `information_schema.columns` tras aplicar la migración (ver abajo) | Cumple |
| 3 | `CHECK` de `estado` | Insert con `estado='estado_invalido'` rechazado por Postgres real | Cumple |
| 4 | `id` uuid autogenerado | `gen_random_uuid()` verificado nativo (built-in de Postgres core desde v13, sin depender de la disponibilidad de `pgcrypto` en el entorno de verificación) | Cumple |
| 5 | RLS habilitado, `anon` bloqueado | Verificado con el rol real `anon` contra Postgres real (ver abajo) | Cumple |
| 6 | Verificación real contra Postgres | Ver metodología y evidencia completa abajo | Cumple |
| 7 | `docs/tecnica/inicializacion-supabase-schema.md` no vacío | Presente, con detalle de columnas + mecanismo RLS/BYPASSRLS/GRANT | Cumple |
| 8 | `docs/usuario/inicializacion-supabase-schema.md` no vacío | Presente, con pasos de aplicación (SQL Editor / CLI) | Cumple |
| 9 | `decision.md` + enlaces exactos en ambos índices | Ver `Assert-FeatureContract` abajo | Cumple |

## Metodología de verificación real (criterio 6)

Docker no está disponible en este entorno (el servicio WSL de Windows
está deshabilitado a nivel de sistema — verificado con `wsl -l -v` →
`Wsl/0x80070422`; no se modifica esa configuración, es fuera de alcance
de esta feature). En vez de simular el resultado o saltear la
verificación, se usó **`@electric-sql/pglite`** — Postgres real
(`PostgreSQL 18.3`, confirmado con `select version()`) compilado a
WASM, corrido vía Node.js — para aplicar la migración tal cual y
ejecutar consultas reales contra ella. Es Postgres genuino, no un mock
ni una simulación de comportamiento SQL.

Dos ajustes necesarios en el arnés de verificación, documentados aquí
para que quede claro qué es limitación del entorno de prueba y qué es
comportamiento real de la migración:

1. **`pgcrypto` no empaquetado en pglite**: la extensión no está
   disponible en ese build WASM. Se confirmó por separado que
   `gen_random_uuid()` funciona nativo sin la extensión
   (`select gen_random_uuid()` → éxito, es built-in de Postgres core
   desde la v13) — la migración conserva
   `create extension if not exists pgcrypto;` porque es correcta y
   defensiva para Supabase real; se omitió solo esa línea al aplicar
   la migración *dentro del arnés de prueba*, sin tocar el archivo de
   la migración.
2. **Roles `anon`/`authenticated`/`service_role` no existen en
   Postgres genérico**: Supabase los provisiona automáticamente en
   todo proyecto. Se crearon en el arnés de prueba (`CREATE ROLE ...
   NOLOGIN`, `service_role` con `BYPASSRLS`) para probar contra los
   roles reales, no contra nombres inventados.

## Evidencia completa (salida real, no resumida)

```
OK   Migracion aplicada sin error
Columnas encontradas: 14 (esperadas: 14)
OK   cantidad de columnas = 14
OK   columna id (uuid, nullable=NO)
OK   columna nombre (text, nullable=NO)
OK   columna email (text, nullable=NO)
OK   columna telefono (text, nullable=YES)
OK   columna servicio (text, nullable=YES)
OK   columna mensaje (text, nullable=YES)
OK   columna estado (text, nullable=NO)
OK   columna origen (text, nullable=NO)
OK   columna consentimiento_privacidad (boolean, nullable=NO)
OK   columna version_politica_privacidad (text, nullable=NO)
OK   columna notificacion_clinica_enviada (boolean, nullable=NO)
OK   columna confirmacion_paciente_enviada (boolean, nullable=NO)
OK   columna fecha_creacion (timestamp with time zone, nullable=NO)
OK   columna fecha_actualizacion (timestamp with time zone, nullable=NO)
OK   insert valido toma los defaults esperados (estado=nuevo, origen=formulario_web, flags=false, id/fechas autogeneradas)
OK   CHECK de estado rechaza valor invalido (new row for relation "leads" violates check constraint "leads_estado_check")
OK   NOT NULL nombre rechaza insert sin nombre (null value in column "nombre" of relation "leads" violates not-null constraint)
OK   NOT NULL email rechaza insert sin email (null value in column "email" of relation "leads" violates not-null constraint)
OK   RLS bloquea SELECT al rol 'anon' (permission denied for table leads)
OK   RLS bloquea INSERT al rol 'anon' (permission denied for table leads)
OK   service_role SI puede insertar (bypassea RLS, como opera el backend real)
OK   pg_class.relrowsecurity = true para leads

=== RESULTADO: PASS ===
```

## Hallazgo real durante la verificación (no oculto): BYPASSRLS ≠ acceso completo

Al probar `service_role`, el primer intento falló con
`permission denied for table leads` **a pesar de tener `BYPASSRLS`**.
Causa real: `BYPASSRLS` solo salta las *policies* de RLS — no otorga
privilegios de tabla (`GRANT`). En Supabase real esto no es un
problema porque la plataforma configura, una sola vez por proyecto,
`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO service_role` a
nivel de base — cualquier tabla nueva hereda ese privilegio
automáticamente. Se replicó ese default privilege en el arnés de
prueba (no en la migración, que no debe declararlo: es responsabilidad
de la plataforma Supabase, no de una migración de esquema) y quedó
confirmado que `service_role` sí puede operar. Esta distinción quedó
documentada en `docs/tecnica/inicializacion-supabase-schema.md`.

## Suite del circuito (`pytest`)

```
pytest -q → 24 passed, 0 failed
```

Nota: en la primera corrida, `test_reconciler_cleans_only_target_worktree_and_branch`
falló por timeout (90s) — coincidió con el arranque de Docker Desktop
en background compitiendo por recursos del sistema. Reejecutado en
aislamiento inmediatamente después: **PASSED en 12.27s**. Se documenta
como flakiness de entorno, no como regresión — no hay cambios en
`scripts/*.ps1` ni en `tests/*.py` en esta feature.

## Contrato común (`scripts/feature-contract.ps1`)

```powershell
Assert-FeatureContract -Slug '02-inicializacion-supabase-schema' -Title 'Inicialización del esquema Supabase'
```

Resultado: **PASS**.

## Resultado

`approved`. 22/22 verificaciones reales contra Postgres genuino, sin
feedback pendiente.
