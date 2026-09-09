# audit-3 — envío del formulario (intento 3) — **APROBADA**

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`3c66c8a83e3fb4d2c6d8b13c3ac60439a2488608`** (PR #41, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la ampliación de alcance del punto 16 — doble submit,
>   feedback, confirmación y confiabilidad de los dos envíos SMTP.
> - **Veredicto**: **APROBADA**
> - **Intentos previos**: `audit-3-envio-formulario.md` (`91f3a70`) y
>   `-intento-2.md` (`36253d7`), los dos `NO APROBADA`.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La lógica es correcta. El guard central bloquea `submit` repetidos antes de tocar el estado (`script.js:220-228`); el estado se libera en éxito y error (`script.js:276-298`). El formulario solo se resetea con `201`, conserva datos ante errores y no lee el cuerpo.

El guard del defecto exacto quedó sólido: el arnés cuenta `json()` (`script.test.js:54-57`, `101-118`) y exige cero invocaciones, incluido frente a `response.json().catch(() => ({}))` (`script.test.js:470-487`, `559-579`).

No encontré filtraciones ni promesas indebidas. El diálogo tiene atributos accesibles en `index.html:267-275`; el foco, Escape y la trampa de Tab están implementados en `script.js:132-208`. El pool y el reintento están acotados correctamente (`mailer.js:57-75`, `257-333`), y ambos envíos usan `enviarConReintento` (`api/leads.js:845-915`).

Verifiqué los conteos con `grep -c`: `script.test.js` contiene 28 casos, `mailer.test.js` 30 en total y los 7 nuevos están en `mailer.test.js:340-443`. El reporte declara correctamente 28 y +7. La mención del prompt a 23 tests está desactualizada. También observé que las referencias de línea del reporte para los `201` quedaron viejas: hoy son `api/leads.js:751` y `:968`, no `:746` y `:959`; la afirmación funcional sí está respaldada.

AUDITORÍA: APROBADA