# audit-3 — envío del formulario (intento 2)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`36253d732d4735c4b9dcf82295667a300adf9c17`** (PR #40, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la ampliación de alcance del punto 16.
> - **Veredicto**: **NO APROBADA**
> - **Intento anterior**: `audit-3-envio-formulario.md`, `NO APROBADA`.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La lógica de envío, reset, filtraciones, accesibilidad, pool y reintento es correcta.

Hay un defecto concreto en la cobertura: `script.test.js:99-107` define un `json()` ilegible, pero `script.test.js:459-486` nunca verifica que no se invoque. Si se reintrodujera `response.json().catch(() => ({}))`, los dos tests seguirían pasando. El guard no detecta el defecto que motivó el rechazo anterior.

Además, el reporte es inconsistente: `evidencia/test-report-6.md:26` afirma 27 casos, mientras `:152` afirma 23. `rg -c "test\(" script.test.js` devuelve 27.

AUDITORÍA: NO APROBADA