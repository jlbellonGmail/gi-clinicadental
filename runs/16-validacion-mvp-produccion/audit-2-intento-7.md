# audit-2 — intento final (evidencia del punto 16)

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> el árbol completo del commit
> **`5f0fbe194d4363d8e5b5b1143b96b99740434eb3`** más los **35** artefactos de
> `runs/16-validacion-mvp-produccion/`. (Una versión anterior de esta
> cabecera decía "48": era un conteo mío equivocado, señalado por
> `audit-2-intento-10.md`. El texto del auditor no se toca.) Claude Code lo persiste **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **NO APROBADA**
> - **Motivo único**: `decision.md`, el documento central, había quedado
>   congelado en un SHA, un deployment, unas suites y unos pendientes
>   anteriores. Corregido.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: rejected
attempt: final
feedback:
  - runs/decision.md mantiene un estado central obsoleto y contradice la evidencia vigente.
  - La síntesis final no incorpora correctamente el release posterior, sus pendientes ni el SHA auditado por audit-7.

La evidencia no es aprobable como paquete final porque `runs/decision.md` quedó desactualizado:

- En `runs/decision.md:882-895` declara `main` en `109d0afe`, deployment `6298664005`, suites `248/248` y `60/60`, y `audit-2` como auditoría válida. Los datos vigentes son `main` `5f0fbe...`, deployment `6312453790`, `npm test` `272/272`, `pytest` `79/79` y aprobación final en `runs/audit-7-final.md:1-31`.
- En `runs/decision.md:922-935` todavía declara pendientes V12, los flags de `V13-MTQDI8RT` y seis filas sintéticas. La evidencia vigente declara como pendientes los flags, `estado_comunicacion` y logs de `V14-MTREJ5YZ`, el descarte de sintéticos y los dos leads `nuevo + requiere_revision + true/false`; esto sí aparece explícitamente en `runs/test-report-8.md:9-20` y `runs/test-report-8.md:172-208`.
- `runs/test-report-8.md:9` identifica correctamente el SHA de la validación C (`571e999`) y `:57-66` documenta la equivalencia hash a hash de los archivos de producto. El release posterior y su nuevo deployment, sin embargo, no están reflejados en `decision.md`.

No encontré secretos utilizables. Las referencias a credenciales son nombres de variables, valores truncados o placeholders; por ejemplo, `runs/test-report-2.md:915` usa `<SUPABASE_SERVICE_ROLE_KEY>`. El valor `SMTP_PASS=secreta` de `runs/15-observabilidad-y-operacion/test-report-1.md:69` está presentado como fixture de prueba, no como credencial real.

No encontré datos de pacientes ni información clínica de terceros. Los reportes históricos sí contienen el correo controlado del propio humano, por ejemplo `runs/test-report-2.md:166`, `:302` y `:443`. La decisión de no reescribir esos artefactos históricos es correcta y está declarada en `runs/test-report-8.md:202-208`; no constituye un bloqueo de privacidad bajo el criterio indicado.

Las auditorías previas están conservadas y los fallos principales están documentados. También es correcto mantener `ROADMAP.md` en `[ ]` (`ROADMAP.md`, ítem 16) y no crear tags. El problema bloqueante es la falta de actualización fiel del documento central: presenta como estado final otro SHA, otro deployment, otra serie de suites y otros pendientes.

AUDITORÍA: NO APROBADA