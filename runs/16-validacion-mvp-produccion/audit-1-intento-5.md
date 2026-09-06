# audit-1 — intento 5 (calidad visual del móvil)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`6d4f90df506455744dc9f537857d9d10b311aa17`** (PR #33, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano tras
>   seis fallos consecutivos de OpenCode)
> - **Alcance**: `style.css`, `index.html`, `politica-privacidad.html`,
>   `404.html`, `script.js`, `tests/test_responsive_movil.py`,
>   `tests/test_contraste_visual.py`, más el reporte de mediciones y el
>   diff exacto.
> - **Veredicto**: **NO APROBADA**
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La auditoría detecta un incumplimiento de scope.

En `style.css:226`, `.hero-content h1` declara `color: var(--white)` sin `.hero`. En `style.css:243`, `.hero-content p` también declara color sin scope. El contenido de equipo reutiliza `.hero-content`; hoy no queda blanco sobre blanco porque usa `h2`, pero la regla sigue siendo global y contradice el criterio solicitado. Además, `test_contraste_visual.py:128-133` valida precisamente el selector sin scope, por lo que no detectaría esta regresión.

El resto es consistente:

- `--gradient-primary` permanece sin cambios en `style.css:16`; el hero usa `--gradient-hero` en `style.css:213`.
- Los ratios declarados en el reporte son coherentes con los colores de `style.css:20`, `style.css:239`, `style.css:252` y los CTA scopeados.
- Los cinco tests cubren los contrastes principales y verifican el tamaño mínimo del título. Tienen huecos: no prueban el scope del hero ni que `--gradient-primary` conserve su valor. El parser corregido sí considera reglas después de `@import` y dentro de `@media` (`test_responsive_movil.py:74-105`).
- No hay máscara global `overflow` en `html` o `body`; los `overflow: hidden` existentes están scopeados a componentes (`style.css:216`, `style.css:287`).
- `404.html` no declara `has-mobile-nav`, como comprueba `test_responsive_movil.py:220-233`; la compactación general del header sí le aplica.
- El tope `max-width: 420px` de `style.css:590-603` no afecta a los anchos telefónicos indicados.
- La evidencia reconoce correctamente que falta release, deployment y validación en teléfono real. Además, reporta 75 px para el header legal a 320 px (`evidencia/test-report-5.md`, tabla de otras páginas), aunque la corrección se presenta como unificación a 68 px.

La implementación mejora el contraste y el responsive, pero no cumple completamente el requisito de scope del color ni cuenta con tests que lo garanticen.

AUDITORÍA: NO APROBADA