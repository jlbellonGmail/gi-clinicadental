# audit-1 — intento 9 (calidad visual del móvil) — **APROBADA**

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`5c94dcfec55b183a57bebe3f56cfe33825e9a060`** (PR #37, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: el CSS, las tres páginas, el JS, los dos módulos de
>   tests, el reporte de mediciones, el diff desde el rechazo anterior y
>   su propio `audit-1-intento-8.md`.
> - **Veredicto**: **APROBADA**
> - **Rondas previas**: `audit-1-intento-5` (`6d4f90d`),
>   `-6` (`5492cd4`), `-7` (`653c0ce`) y `-8` (`8451815`), las cuatro
>   `NO APROBADA`.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La revisión queda aprobada.

- `_es_ancestro` distingue correctamente los 9 selectores scopeados y los 8 no scopeados de la tabla, incluyendo `.hero .foo + .hero-content` y excluyendo `.hero + .hero-content` (`tests/test_contraste_visual.py:457-501`).
- `_partes_del_gradiente` conserva la sensibilidad de `--PRIMARY` frente a `--primary`, pero tolera espacios, mayúsculas de función/unidades y formato equivalente. Las 3 filas equivalentes y 4 distintas están correctamente ubicadas (`tests/test_contraste_visual.py:504-535`).
- Los guards son alcanzables: el parser recursivo se usa desde `reglas_css()` (`tests/test_responsive_movil.py:86-130`), y ambos clasificadores se ejercitan directamente en tests.
- El producto mantiene el gradiente oscuro propio del hero y los colores scopeados (`style.css:16-20`, `style.css:238-282`). Los desbordes globales siguen prohibidos y el `overflow: hidden` queda limitado a componentes (`style.css:33-40`, `style.css:209-218`, `style.css:292-295`).
- El formulario tiene el padding trasladado al CSS y reducido en móvil (`style.css:153-160`, `style.css:618-621`; `index.html:165`).
- La excepción de `.hero-content p`, el `h1` grande y el `404` inline coinciden con el contexto declarado (`style.css:251-260`; `404.html:27-28`).
- Las suites y el build se toman como resultados verificados entregados en el contexto; no se ejecutaron comandos de tests.

AUDITORÍA: APROBADA