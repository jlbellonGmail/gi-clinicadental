# audit-2 — intento 6 (evidencia del punto 16) — **APROBADA**

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada de `runs/` y del árbol liberado
> en **`109d0afe75803f0e6f8e3e7ae40127d66cee04ef`** (`main`, PR #42,
> desplegado en Production como `6298664005`). Codex no escribe en este
> repositorio: Claude Code persiste el informe **literalmente**, sin
> reinterpretar hallazgos, veredicto ni recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la evidencia completa del punto 16, incluida la
>   ampliación del envío del formulario. Último control antes del HITL 2.
> - **Veredicto**: **APROBADA**
> - **Intentos previos sobre este árbol**: `audit-2-intento-4.md`
>   (`decision.md` congelado en el árbol anterior) y `-intento-5.md`
>   (conteo de rechazos de `audit-1` equivocado), los dos `NO APROBADA`.
>
> Al auditor se le declararon por escrito, antes de auditar, los tres
> pendientes humanos, para que los juzgara él en vez de auditarlos de
> oídas.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: approved
attempt: 6
feedback:
  - La evidencia final coincide con `main` `109d0afe...`, deployment `6298664005`, suites `248/248` y `60/60` (`runs/decision.md:876-910`).
  - V12, los flags SMTP/reintento y las seis filas sintéticas están declarados explícitamente como pendientes; no se presentan como validados (`runs/decision.md:922-935`, `runs/test-report-6.md:448-459`).
  - No encontré secretos utilizables, credenciales, cookies ni datos de pacientes reales en `runs/` o `producto/`.

La auditoría previa `runs/audit-2.md` tiene un aviso suficiente: identifica el SHA y deployment obsoletos, explica que el veredicto no aplica y conserva el informe original sin sobrescribirlo (`runs/audit-2.md:1-18`).

La actualización vigente de `decision.md` incorpora la ampliación completa: doble submit, feedback, confirmación, SMTP consecutivo, envío real en Production y la incertidumbre sobre el reintento. El envío se describe como validado funcionalmente, sin afirmar que los correos o el reintento estén confirmados cuando no hay acceso a logs o flags (`runs/test-report-6.md:381-459`).

Los fallos propios están expuestos con suficiente detalle: diagnóstico equivocado del 500, marca dibujada en píxeles, guards ineficaces, medición falsa de viewport, empeoramiento temporal de `404.html`, fallo del arnés de tests y los dos rechazos de `audit-3` (`runs/decision.md:494-621`, `runs/test-report-6.md:299-378`). La corrección del hallazgo que no correspondía está razonada y respaldada, no simplemente descartada.

Las auditorías previas están persistidas literalmente. La tabla final distingue los nueve intentos numerados, la contingencia y sus SHA/veredictos (`runs/decision.md:895-910`). Los rechazos y la aprobación final de `audit-3` también están conservados en sus tres artefactos (`runs/test-report-6.md:299-378`).

El estado del repositorio es coherente: no hay tags, `producto/ROADMAP.md` mantiene `[ ] 16-validacion-mvp-produccion`, y la feature sigue sin mergear (`runs/decision.md:884-895`, `producto/ROADMAP.md:119`). El MVP no se declara cerrado; quedan expresamente las tres decisiones humanas del HITL 2.

AUDITORÍA: APROBADA