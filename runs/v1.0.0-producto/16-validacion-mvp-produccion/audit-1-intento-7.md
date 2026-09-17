# audit-1 — intento 7 (calidad visual del móvil)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`653c0ce03fbda203ca35a34924a5d9e1fdf8f74e`** (PR #35, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: el CSS, las tres páginas, el JS, los dos módulos de
>   tests, el reporte de mediciones, el diff desde el rechazo anterior y
>   su propio `audit-1-intento-6.md`.
> - **Veredicto**: **NO APROBADA**
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La auditoría no queda aprobada.

Los cuatro huecos indicados están corregidos:

- Scope en cualquier posición: `tests/test_contraste_visual.py:269-273`.
- Gradiente completo: `tests/test_contraste_visual.py:329-337`.
- Mayúsculas en `overflow`: `tests/test_responsive_movil.py:180-185` y `198-200`.
- Recursión de at-rules: `tests/test_responsive_movil.py:107-130`.

El parser recursivo no duplica reglas ni rompe los `@media` simples. El `overflow: hidden` de `.hero` y `.hero-image` queda correctamente permitido porque solo se rechazan `html` y `body`.

Persisten dos debilidades:

1. `_sin_scope_de_hero` clasifica como scopeados selectores que no son descendientes de `.hero`, por ejemplo `.hero + .hero-content p` o `.hero ~ .hero-content p`, porque solo busca texto antes de `.hero-content` (`tests/test_contraste_visual.py:271-273`). También puede interpretar `.foo:not(.hero) .hero-content p` como scopeado.

2. El guard de `--gradient-primary` compara una cadena casi exacta tras normalizar espacios (`tests/test_contraste_visual.py:333-337`). Un cambio inocuo como quitar el espacio después de una coma lo hace fallar, aunque el valor CSS sea equivalente.

Los regex y comparaciones actuales sí pueden coincidir; no encontré guards completamente inalcanzables. El conteo verificado con `grep -c "^def test_"` es 10 para responsive y 8 para contraste. La afirmación de 8 casos en `evidencia/test-report-5.md:257` está respaldada; también lo están los 15 guards negativos de `evidencia/test-report-5.md:22`.

AUDITORÍA: NO APROBADA