# audit-2 — intento 2 (evidencia del punto 16)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada de `runs/` y del árbol liberado
> en **`4e861340d6812b82e6b2b605e5111d2c5b80140a`** (`main`, PR #38,
> desplegado en Production como `6295205198`). Codex no escribe en este
> repositorio: Claude Code persiste el informe **literalmente**, sin
> reinterpretar hallazgos, veredicto ni recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la **evidencia**, no el candidato. Último control antes
>   del HITL 2.
> - **Veredicto**: **NO APROBADA**
>
> Al auditor se le declararon por escrito, antes de auditar, los dos
> pendientes —V12 sin confirmar en teléfono real y las cinco filas
> sintéticas sin descartar— para que los juzgara él en vez de auditarlos
> de oídas.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: rejected
attempt: 2
feedback:
  - `runs/audit-2.md` audita un estado anterior: declara `main` 9ad6874 y deployment 6287860202 (líneas 10–12), mientras el estado verificado es 4e861340 y deployment 6295205198. Por tanto, no existe una auditoría válida del candidato final.
  - El mismo artefacto afirma 4 filas sintéticas pendientes (línea 152), pero el estado actual declara 5. Su conclusión aprobatoria no está respaldada para el árbol liberado.
  - `runs/decision.md` reconoce correctamente que falta `audit-2` sobre el `main` final (líneas 1074–1094), pero ese hueco sigue sin corregirse.

El relato general de `decision.md` es transparente sobre los fallos: diagnóstico equivocado del 500, marca incrustada en píxeles, medición con `innerWidth`, tres guards ineficaces y empeoramiento temporal de `404.html`. También declara correctamente V12 pendiente y las cinco filas sintéticas como acciones humanas pendientes (`decision.md:1065-1094`; `test-report-5.md:425-437`).

La evidencia de las suites finales sí coincide con lo entregado: `test-report-5.md` registra `npm test` 213/213, `pytest` 59/59 y `mkdocs build --strict` OK (`test-report-5.md:399-405`). El estado de `ROADMAP.md` también permanece en `[ ]` (`producto/ROADMAP.md:119`).

No encontré valores de secretos, tokens, cookies, cabeceras con credenciales, claves de Supabase ni passwords SMTP. Los artefactos usan placeholders o valores truncados y describen las credenciales como presentes sin persistirlas (`runs/audit-2.md:110-118`; `runs/test-report-2.md:1311-1322`). Los datos visibles están identificados como pruebas sintéticas/controladas; no hay evidencia de datos clínicos ni de pacientes reales.

El rechazo se debe exclusivamente a que `runs/audit-2.md`, el documento central que debía auditar la evidencia final, está desactualizado y emite un veredicto sobre otro deployment. Debe persistirse una nueva auditoría sobre `main` 4e861340d6812b82e6b2b605e5111d2c5b80140a, manteniendo explícitos V12 pendiente y las cinco filas pendientes.

AUDITORÍA: NO APROBADA