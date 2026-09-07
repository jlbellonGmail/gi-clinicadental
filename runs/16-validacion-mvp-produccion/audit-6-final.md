# audit-6 — auditoría final del punto 16 (intento 1)

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> una copia aislada del commit **`571e999b707ae662fb5b4d46bf7ee89fe18dfd62`**
> (`main`, PR #47, desplegado como `6311816765`). Claude Code lo persiste
> **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **NO APROBADA**
>
> **Nota sobre el primer hallazgo.** El auditor reporta que
> `tests/test_migracion_estado_comunicacion.py` no encuentra
> `docs/tecnica/estado-comunicacion-leads.md`. Eso es correcto **dentro
> del directorio de auditoría**, y es un error de Claude Code al
> empaquetarlo: la doc se copió a `docs/estado-comunicacion-leads.md`,
> aplanando la ruta. En el árbol real el archivo existe en su ruta y el
> módulo pasa 10/10, comprobado. El auditor razonó correctamente sobre un
> árbol mal armado; la corrección va en el empaquetado, no en el código.
> Los otros dos hallazgos sí son reales y están corregidos.
>
>
> **ALCANCE DE ESTE INFORME — leer antes que su texto.** El auditor vio el
> árbol del repositorio en ese commit **sin `runs/`**, más una carpeta
> `evidencia/` armada para esa ronda. Dos consecuencias, señaladas por
> `audit-2-intento-7.md`:
>
> - Cuando dice que **no hay direcciones personales literales**, se
>   refiere **solo a los archivos que vio**. Los reportes históricos de
>   `runs/` —por ejemplo `test-report-2.md`— sí contienen la casilla de
>   prueba del propio humano. Esa decisión está declarada y razonada en
>   `test-report-8.md`: no se reescriben artefactos históricos ya
>   auditados en silencio.
> - Las rutas `evidencia/...` que cita son las de **ese** directorio de
>   auditoría. En el repositorio, `evidencia/test-report-8.md` es
>   `runs/16-validacion-mvp-produccion/test-report-8.md`.
>
> El texto del informe **no se modifica**: se precisa su procedencia, que
> es lo que faltaba.
> Lo que sigue es el texto del auditor, sin modificar.

---

La migración es correcta y conservadora: el backfill usa ambos flags, trata `NULL` como revisión y solo actualiza filas `pendiente` (`supabase/migrations/20260907093000_add_estado_comunicacion.sql:76-91`). El `conrelid` está anclado a `public.leads` y el índice excluye `descartado` (`:39-52`, `:119-126`).

Hay un defecto concreto en los guards: `tests/test_migracion_estado_comunicacion.py:198` intenta leer `docs/tecnica/estado-comunicacion-leads.md`, pero el árbol auditado solo contiene `docs/estado-comunicacion-leads.md`. Por tanto, ese test falla con `FileNotFoundError`; la afirmación de `79/79` no es reproducible desde estos archivos.

La estabilización del teardown espera la muerte del PID raíz (`tests/test_local_reconciler_scripts.py:239-255`), pero solo descubre procesos que aún conservan el lock (`:230-236`). Si el lock desaparece antes de que sobreviva un hijo, ese hijo no se detecta. Es una cobertura incompleta, aunque la corrección sí ataca la causa principal y no solo los timeouts.

El reporte es honesto sobre las verificaciones humanas pendientes (`evidencia/test-report-8.md`, bloque inicial y sección “Lo que NO se puede verificar”). No hay secretos visibles, pero sí se expone una dirección personal controlada en la evidencia (`evidencia/test-report-8.md:89`), que convendría anonimizar.

AUDITORÍA: NO APROBADA