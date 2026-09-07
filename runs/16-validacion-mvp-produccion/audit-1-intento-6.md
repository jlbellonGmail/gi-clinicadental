# audit-1 — intento 6 (calidad visual del móvil)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`5492cd4e58a317ecf1c6ceab9cfb289a92694f6b`** (PR #34, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: `style.css`, `index.html`, `politica-privacidad.html`,
>   `404.html`, `script.js`, los dos módulos de tests, el reporte de
>   mediciones, el diff desde el rechazo anterior y su propio
>   `audit-1-intento-5.md`.
> - **Veredicto**: **NO APROBADA**
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La corrección visual principal está aplicada: `.hero` usa `--gradient-hero` en `style.css:209-213`; el título, párrafo y CTA están correctamente scopeados en `style.css:238-282`. `.hero-content p` sin scope es una decisión válida: conserva el color para el reuso sobre fondo claro y la regla del hero lo sobrescribe en `style.css:251-260`.

`404.html` también queda legible: pertenece a `.hero` en `404.html:24` y ya no declara colores inline ilegibles en sus párrafos (`404.html:28-29`). La navegación móvil se conserva porque no declara `has-mobile-nav` y `.nav-links` no queda oculto por las reglas scopeadas.

La grilla y el header están corregidos en `style.css:305-312` y `style.css:628-639`. No hay máscara global actual sobre `html` o `body`; los únicos `overflow: hidden` están en `.hero` y `.hero-image` (`style.css:216`, `style.css:295`).

Los guards sí pueden fallar ante los defectos principales: el scopeado del hero (`test_contraste_visual.py:260-294`), el gradiente general (`:296-309`), el 404 (`:311-350`), el desborde global (`test_responsive_movil.py:150-179`) y la grilla (`:251-276`). No encontré un selector o regex de esos casos que sea completamente inalcanzable.

Persisten huecos relevantes:

- El guard de scope solo analiza selectores que empiezan por `.hero-content` (`test_contraste_visual.py:276`). No detectaría un selector global como `.equipo .hero-content h1`, aunque tampoco esté scopeado a `.hero`.
- El guard de `--gradient-primary` verifica únicamente que aparezcan `var(--primary)` y `var(--primary-dark)` (`test_contraste_visual.py:304-307`). Permitiría invertir paradas, cambiar ángulo o alterar posiciones, pese a que el reporte afirma conservar el valor.
- Los guards de overflow son sensibles a mayúsculas y no recorren correctamente reglas dentro de at-rules anidados (`test_responsive_movil.py:70-115`, `:170-189`). Por tanto, no pueden garantizar la detección “en cualquier posición” del archivo.
- El reporte afirma que hay “8 casos” de contraste (`evidencia/test-report-5.md:219`), pero el archivo contiene seis funciones `test_` (`test_contraste_visual.py:128`, `:163`, `:190`, `:238`, `:260`, `:296`). En realidad agrupa varias comprobaciones dentro de una función y luego documenta 11 mutaciones negativas. Esa afirmación no es coherente.
- El reporte dice “Todas las reglas de color van scopeadas a `.hero`” (`evidencia/test-report-5.md:80`), pero `.hero-content p` sigue siendo deliberadamente global en `style.css:251`. La decisión de CSS es correcta; la afirmación del reporte es demasiado amplia.

La evidencia local respalda los ratios y mediciones declarados, pero no alcanza para cerrar V12: el propio reporte reconoce que faltan release, deployment y validación visual en teléfono real (`evidencia/test-report-5.md:306-315`). Además, los huecos de los guards impiden considerar completamente resueltos los hallazgos de robustez de auditoría.

AUDITORÍA: NO APROBADA