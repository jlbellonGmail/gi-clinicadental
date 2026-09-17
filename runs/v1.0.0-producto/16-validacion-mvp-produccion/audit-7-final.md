# audit-7 — auditoría final del punto 16 — **APROBADA**

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> el **árbol completo** del commit
> **`5f0fbe194d4363d8e5b5b1143b96b99740434eb3`** (`main`, PR #49),
> extraído con `git archive` para conservar su estructura real — el
> intento anterior falló en parte porque Claude Code había aplanado las
> rutas al empaquetarlo. Claude Code persiste el informe **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **APROBADA**
> - **Intento anterior**: `audit-6-final.md`, `NO APROBADA`.
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

La migración es correcta y conservadora. El backfill usa ambos flags, trata `NULL` como `requiere_revision` y solo actualiza filas `pendiente`, por lo que puede reejecutarse sin pisar estados resueltos (`supabase/migrations/20260907093000_add_estado_comunicacion.sql:76-91`). El `conrelid` está anclado a `public.leads` (`:39-52`) y el índice se recrea con la exclusión de `descartado` (`:119-126`). La separación entre dato histórico y cola operativa es coherente.

Los guards son efectivos y no parecen excesivamente estrictos. Verifican backfill, reejecución, esquema, constraint, índice y documentación (`tests/test_migracion_estado_comunicacion.py:35-198`). El test ahora encuentra la documentación en su ruta real.

La estabilización ataca la causa identificada: espera la muerte del PID raíz y luego busca procesos supervivientes por línea de comandos, limitado al `tmp_path` del test (`tests/test_local_reconciler_scripts.py:240-279`, `:304-325`). La carrera del log también quedó corregida con espera explícita (`:354-365`). No observo una vía evidente para que sobreviva un proceso relacionado sin ser detectado.

El diff entregado modifica únicamente `tests/test_local_reconciler_scripts.py`; no cambia el runtime. La evidencia de `test-report-8.md` distingue correctamente lo verificado de las acciones humanas pendientes y no afirma haber comprobado flags, logs ni descarte de datos cuando no podía hacerlo. La afirmación sobre los dos envíos es consistente con `api/leads.js`, donde la respuesta exitosa requiere ambos `sendMail` y ambos flags persistidos.

No se observan secretos ni direcciones personales literales en los archivos entregados. La dirección de prueba fue reemplazada por `<EMAIL_CONTROLADO_MOVIL>` (`evidencia/test-report-8.md`, sección de privacidad). El estado `[ ]` de `ROADMAP.md` es correcto mientras la feature no esté mergeada.

AUDITORÍA: APROBADA