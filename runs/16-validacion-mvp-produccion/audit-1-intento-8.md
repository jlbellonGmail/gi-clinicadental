# audit-1 — intento 8 (calidad visual del móvil)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`8451815c943121381f4af7754391ff0234d56c72`** (PR #36, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: el CSS, las tres páginas, el JS, los dos módulos de
>   tests, el reporte de mediciones, el diff desde el rechazo anterior y
>   su propio `audit-1-intento-7.md`. El CSS, el HTML y el JS son
>   idénticos a los que este mismo auditor ya dio por correctos.
> - **Veredicto**: **NO APROBADA**
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La auditoría no queda aprobada.

El cierre del scope sigue teniendo un defecto en `tests/test_contraste_visual.py:282-294`. El selector `.hero .foo + .hero-content p` sí está dentro de `.hero`, pero `_sin_scope_de_hero` devuelve `True` porque encuentra `+` entre `.hero` y `.hero-content`. Rechazaría un cambio legítimo. Lo mismo ocurre con `~`.

El guard del gradiente ya tolera espacios y mayúsculas de formato en `tests/test_contraste_visual.py:360-363`, pero al pasar todo a minúsculas también considera equivalente `var(--PRIMARY)` y `var(--primary)`. Las variables CSS personalizadas distinguen mayúsculas; por tanto, puede aceptar un valor roto. Además, no tolera comentarios CSS inocuos dentro del valor.

La recursión de `reglas_css` y los guards de `overflow` conservan el comportamiento esperado, incluido `overflow: hidden` en `.hero` y `.hero-image`. Los conteos de tests sí están respaldados: `grep -c ^def.test_` devuelve 8 para contraste y 10 para responsive; el reporte lo declara en `evidencia/test-report-5.md:293`.

AUDITORÍA: NO APROBADA