# audit-1 — Auditoría independiente de CONTINGENCIA (Codex)

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **Codex CLI 0.151.0** — auditor de **contingencia**, autorizado excepcionalmente por el humano |
> | **Modelo** | `gpt-5.6-luna`, `model_reasoning_effort = high` — distinto del constructor |
> | **Modo** | `-s read-only`: la **sandbox** impide escribir, no una instrucción del prompt |
> | **SHA auditado** | `e783b832114fadac6ae7bb1aad5e4e62a4d469e7` |
> | **Alcance** | Árbol mínimo de 7 archivos: `style.css`, `index.html`, `404.html`, `script.js`, `tests/test_responsive_movil.py`, más `test-report-4.md` y el diff exacto de la corrección |
> | **Fecha** | 2026-09-06 |
> | **Persistido por** | **Claude Code**, literalmente |
>
> **Por qué la auditoría la hace Codex y no OpenCode.** OpenCode no pudo
> producir un artefacto íntegro sobre este candidato tras **seis**
> ejecuciones reales —kill, timeout, un informe truncado que llegó a
> emitir `approved` sin completar el análisis, y dos ejecuciones de 0
> bytes, la última detenida a los 37 minutos—. La desviación completa,
> con los dos diagnósticos equivocados de Claude Code sobre su causa,
> está en `decision.md`. El humano autorizó a Codex como auditor de
> contingencia para no bloquear la etapa por una limitación de
> ejecución del auditor habitual.
>
> **Dos ejecuciones previas de Codex fallaron por errores de
> configuración de Claude Code, no del candidato**: la primera con `401
> Unauthorized`, por fijar `CODEX_HOME` al `.codex/` del repositorio y
> anular el home real donde viven las credenciales; la segunda porque el
> prompt le prohibía el shell, que es su única vía de lectura de
> archivos. En esa segunda Codex respondió *"no emito conclusiones ni
> invento líneas de evidencia"* y devolvió NO APROBADA — la respuesta
> correcta ante la falta de acceso, y **no un veredicto sobre el
> código**. Ambos errores quedan registrados en `decision.md`.
>
> El informe que sigue es la salida **íntegra y sin editar** de Codex.
> Claude Code no resumió, no reinterpretó y no corrigió hallazgos,
> recomendaciones ni veredicto.

---

La corrección cumple el criterio de no enmascarar el desborde. `body` no declara `overflow` en `style.css:25-35`; los únicos `overflow: hidden` están scopeados a `.hero` y `.hero-image` (`style.css:203-245`). El test elimina comentarios, recorre `@media` y detecta `overflow`/`overflow-x` con valores `hidden` o `clip`, incluidos selectores compuestos (`tests/test_responsive_movil.py:53-101`, `149-173`).

El responsive está concentrado en `@media (max-width: 768px)` (`style.css:483-559`). El menú, el hero, los CTA y el formulario se adaptan allí. El estilo base trasladado del inline conserva los valores de escritorio (`style.css:147-152`), coherente con las mediciones de 1024 y 1440 px del reporte (`evidencia/test-report-4.md:156-163`).

El menú tiene nombre accesible, `aria-expanded` y `aria-controls` (`index.html:28-42`). El JavaScript abre, cierra, actualiza el estado ARIA, cierra al navegar y responde a Escape (`script.js:38-75`). La guarda evita errores cuando no existe el botón (`script.js:41-70`).

El scoping está correctamente aplicado: `404.html` conserva su navegación base y no declara `.has-mobile-nav` (`404.html:11-19`; `style.css:187-190`, `488-524`). El padding estructural del formulario ya no está inline (`index.html:165`; `style.css:147-152`, `551-554`). El aviso de demo permanece visible (`index.html:166-173`).

Las mediciones locales son coherentes con el CSS y documentan cero desbordes, también con el menú abierto (`evidencia/test-report-4.md:89-150`). La evidencia no cierra V12 en producción ni sustituye la comprobación visual en un teléfono real, limitación que el propio reporte declara (`evidencia/test-report-4.md:188-201`).

AUDITORÍA: APROBADA