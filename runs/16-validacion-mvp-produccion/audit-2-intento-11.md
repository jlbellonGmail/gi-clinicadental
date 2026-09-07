# audit-2 — intento 11 (evidencia del punto 16) — **APROBADA**

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> el árbol completo del commit
> **`5f0fbe194d4363d8e5b5b1143b96b99740434eb3`** más los artefactos de
> `runs/16-validacion-mvp-produccion/`, en su ruta real. Claude Code lo
> persiste **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **APROBADA**
> - **Intentos previos sobre este árbol**: `audit-2-intento-7` a `-10`,
>   los cuatro `NO APROBADA`. Tres de los cuatro rechazos fueron por
>   errores de Claude Code —`decision.md` desactualizado, dos empaquetados
>   con rutas aplanadas, un conteo de artefactos inventado y una
>   referencia a un archivo aún no persistido—, no por defectos del
>   producto.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: approved
attempt: final-5
feedback:
  - No quedan bloqueantes de fidelidad, secretos, datos de terceros ni estado del repositorio.
  - El conteo actual verificado de artefactos de la feature es 37; las referencias históricas a 35 quedan contextualizadas por el momento en que fueron emitidas.

La evidencia es aprobable.

El directorio real contiene 37 archivos en `runs/16-validacion-mvp-produccion/`, verificado con `dir /b ... | find /c /v ""`. `audit-2-intento-7.md` declara ahora 37 y explica la corrección del conteo anterior. `audit-2-intento-10.md` conserva correctamente el rechazo histórico basado en el estado anterior, cuando el directorio contenía 35 archivos.

La referencia a `test-report-8.md` quedó corregida a `runs/16-validacion-mvp-produccion/test-report-8.md`. La estructura actual confirma que esa ruta existe. La ubicación del documento central también es coherente con la estructura del proyecto: `runs/16-validacion-mvp-produccion/decision.md`.

El estado final está actualizado en `decision.md:977-1034`: SHA `5f0fbe...`, deployment `6312453790`, `npm test` 272/272, `pytest` 79/79, MkDocs correcto, sin tags, `ROADMAP.md` en `[ ]` y feature sin mergear.

Los tres pendientes están declarados explícitamente en `decision.md:1016-1028` y `test-report-8.md:172-203`: verificación de V14 en Supabase y Vercel, descarte de sintéticos y revisión de los dos leads `nuevo + requiere_revision`. No se presentan como resueltos.

Las correcciones de los rechazos anteriores están trazadas en `audit-2-intento-7.md`, `audit-2-intento-8.md`, `audit-2-intento-9.md` y `audit-2-intento-10.md`. Los fallos previos, hipótesis refutadas, errores de empaquetado y cambios de alcance permanecen documentados, sin maquillaje.

No encontré secretos utilizables. Solo aparecen nombres de variables, placeholders, valores truncados o fixtures, por ejemplo `test-report-2.md:915`, `decision.md:494-497` y `runs/15-observabilidad-y-operacion/test-report-1.md:69`.

Los correos y teléfonos visibles corresponden a fixtures o casillas controladas del humano, por ejemplo `test-report-2.md:166,302,325-328,443,614`. `test-report-8.md:199-203` documenta correctamente que los históricos no se reescribieron silenciosamente. No encontré datos personales ni información clínica de terceros.

La información entregada coincide con el estado declarado: sin tag, `ROADMAP.md` en `[ ]` y feature sin mergear. No se ejecutaron tests ni se usó Git.

AUDITORÍA: APROBADA