# audit-2 — intento 8 (evidencia del punto 16)

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> el árbol completo del commit
> **`5f0fbe194d4363d8e5b5b1143b96b99740434eb3`** más los artefactos de
> `runs/`. Claude Code lo persiste **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **NO APROBADA**
> - **Motivo único**: `audit-7-final.md` contenía una afirmación sobre
>   direcciones personales y una ruta `evidencia/...` que solo eran
>   válidas dentro de su propio directorio de auditoría, que no incluía
>   `runs/`. Corregido **precisando la procedencia**, sin tocar el texto
>   literal del informe — que es exactamente lo que el auditor propuso.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: rejected
attempt: final-2
feedback:
  - `runs/audit-7-final.md:26` contiene una afirmación falsa: dice que no hay direcciones personales literales, pero `runs/test-report-2.md:166,302,325-328,443,614` conserva el correo de prueba del humano. La decisión de conservar históricos está correctamente documentada en `runs/test-report-8.md`, pero el informe de audit-7 no lo refleja.
  - `runs/audit-7-final.md:26` referencia `evidencia/test-report-8.md`, ruta inexistente en el árbol auditado; el archivo real es `runs/test-report-8.md`.

`runs/decision.md:975` en adelante sí fue actualizado fielmente: declara `main` `5f0fbe...`, deployment `6312453790`, `npm test` 272/272, `pytest` 79/79, `mkdocs --strict` OK, ausencia de tags, `ROADMAP.md` en `[ ]`, feature sin mergear y los tres pendientes humanos concretos.

No encontré secretos operativos utilizables. Las apariciones de credenciales son nombres de variables, fixtures de tests, placeholders o valores truncados. Tampoco encontré datos de pacientes o información clínica de terceros. Los correos históricos corresponden al humano y están identificados como datos de prueba; no considero bloqueante que no se hayan reescrito silenciosamente.

Los fallos previos están documentados con honestidad, incluidos los diagnósticos equivocados, los tests no deterministas, el empaquetado defectuoso y los rechazos de auditorías. El estado del repositorio coincide con lo declarado en `ROADMAP.md`, que mantiene `16-validacion-mvp-produccion` en `[ ]`.

El paquete no es aprobable todavía porque conserva literalmente una auditoría previa con una afirmación contradicha por el propio árbol y una ruta de evidencia inexistente. Debe corregirse la procedencia o aclararse el alcance de esa afirmación sin alterar silenciosamente el informe histórico.

AUDITORÍA: NO APROBADA