# audit-1, intento 4 — RECHAZADA

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **OpenCode** |
> | **Modo** | **Solo lectura** — copia aislada del árbol, sin `.git`, fuera del repositorio |
> | **Motor** | `opencode 1.18.27`, agente `plan`, modelo `opencode/nemotron-3-ultra-free` |
> | **SHA auditado** | `689f4807e1e0bdc9cbedd5eea60240fd787cee93` |
> | **Fecha** | 2026-09-06 |
> | **Veredicto** | **`rejected`** |
> | **Persistido por** | **Claude Code**, literalmente |
>
> **Este artefacto se conserva precisamente por haber sido rechazado.**
> El auditor encontró un bloqueante real que a Claude Code se le había
> pasado —un `overflow-x: hidden` global en `body`, heredado del commit
> baseline— y, peor, detectó que **el test escrito para prohibir esa
> misma regla tenía un fallo que la dejaba pasar**. Borrarlo o
> reemplazarlo por la versión aprobada ocultaría que el circuito
> funcionó.
>
> La corrección y su verificación están en `audit-1-intento-5.md` y en
> `decision.md`.
>
> El informe que sigue es la salida **íntegra y sin editar** de OpenCode.

---

Now I have a thorough understanding of the codebase. Let me produce the audit report.

```yaml
status: rejected
attempt: 4
feedback:
  - Existe `overflow-x: hidden` global en `body` (style.css:30) que viola el criterio explícito del punto 16: "no aparezca ni en el breakpoint ni global". El test `test_el_desborde_no_se_tapa_con_overflow_hidden` no lo detecta por un bug en su lógica de búsqueda (busca `body{overflow-x:hidden` como subcadena contigua, pero en el CSS minificado hay propiedades entre `body{` y `overflow-x:hidden`).
  - El test `test_el_desborde_no_se_tapa_con_overflow_hidden` da falso positivo: pasa aunque exista `overflow-x: hidden` global en `body`.
```

**Informe detallado**

### 1. Reglas móviles acotadas a `@media (max-width: 768px)` sin degradar desktop ✅
- El breakpoint móvil está en `style.css:479-555` exclusivamente dentro de `@media (max-width: 768px)`.
- No se han tocado reglas de escritorio fuera de este bloque.
- Las reglas de desktop previas (`@media (max-width: 968px)` en línea 446, `@media (max-width: 576px)` en línea 458) permanecen intactas.

### 2. Desborde corregido en su causa, NO tapado con `overflow-x: hidden` ❌ **BLOQUEANTE**
- **Hallazgo crítico**: `style.css:30` tiene `overflow-x: hidden;` en el selector `body` global (fuera de cualquier media query).
- Criterio explícito del punto 16: *"no aparezca ni en el breakpoint ni global"*.
- El test `test_el_desborde_no_se_tapa_con_overflow_hidden` (líneas 82-97) **no detecta esto** por un bug en su implementación:
  - Busca `body{overflow-x:hidden` y `html{overflow-x:hidden` como subcadenas contiguas en el CSS minificado (`replace(" ", "").replace("\n", "")`).
  - Pero en el CSS minificado real, el bloque `body` es `body{font-family:...;line-height:1.6;overflow-x:hidden;}` — la subcadena `body{overflow-x:hidden` **no existe** porque hay otras propiedades entre `body{` y `overflow-x:hidden`.
  - Resultado: el test pasa (falso positivo) aunque exista `overflow-x: hidden` global.
- El breakpoint móvil (líneas 479-555) **no** contiene `overflow-x: hidden` — correcto.
- Comentario en `style.css:477` confirma la intención: *"El desborde se corrige en su causa... y NO con overflow-x:hidden"*.

### 3. Accesibilidad del menú ✅
- `index.html:34`: botón `.nav-toggle` tiene:
  - `aria-label="Abrir menú de navegación"` (nombre accesible)
  - `aria-expanded="false"` (estado inicial)
  - `aria-controls="navPrincipal"` (apunta al `<nav id="navPrincipal">`)
- `script.js:48-54`: `aria-expanded` se actualiza a `'true'/'false'` al abrir/cerrar.
- `script.js:51-54`: `aria-label` cambia entre "Abrir menú de navegación" / "Cerrar menú de navegación".
- `script.js:64-69`: Tecla `Escape` cierra el menú y devuelve foco al botón.

### 4. Scoping a `.has-mobile-nav` y `404.html` sin menú ✅
- Todas las reglas del breakpoint móvil (líneas 484-520) están prefijadas con `.has-mobile-nav`.
- `index.html:28`: `<header class="has-mobile-nav">` — lo declara.
- `404.html:11`: `<header>` **sin** `has-mobile-nav` — correcto, tiene un solo enlace.
- Test `test_el_menu_movil_no_afecta_a_paginas_sin_el` (líneas 137-154) verifica:
  - `404.html` no tiene `has-mobile-nav`.
  - No hay reglas `.nav-links` o `.header-cta` sin scopear en el breakpoint móvil.

### 5. Padding del formulario movido de inline a CSS ✅
- `index.html:165`: `<div class="lead-form-container">` **sin** atributo `style`.
- `style.css:143-148`: `.lead-form-container` definido en CSS con `padding: 50px`.
- `style.css:547-550`: En breakpoint móvil, `.lead-form-container` reduce a `padding: 24px 20px`.
- Test `test_el_formulario_no_pierde_el_ancho_en_padding` (líneas 107-127) verifica ambos puntos.

### 6. 8 tests nuevos en `tests/test_responsive_movil.py` ✅ (con salvedad)
- **Todos los 8 tests pasan** (verificado con `pytest tests/test_responsive_movil.py -v`).
- **Límite declarado honesto**: docstring (líneas 17-22) aclara que son **estructurales, no visuales** — verifican presencia de piezas, no layout real.
- **Defecto en test #3 (`test_el_desborde_no_se_tapa_con_overflow_hidden`)**: no detecta `overflow-x: hidden` global en `body` por bug en la búsqueda de subcadena (ver punto 2).

### 7. JS no rompe si el botón no existe ✅
- `script.js:38-40`: `navToggle` y `headerConNav` se obtienen con `querySelector`.
- `script.js:41`: `if (navToggle && headerConNav) { ... }` — bloque completo solo ejecuta si ambos existen.
- `404.html` no tiene `.nav-toggle` ni `.has-mobile-nav` → el bloque no hace nada → sin errores.

### 8. Sin tags y `ROADMAP.md` en `[ ]` ✅
- No hay tags en el repositorio (verificado en spec y decision.md previos).
- `ROADMAP.md:119`: `- [ ] 16-validacion-mvp-produccion` — correcto, sin `[-]` ni `[x]`.

### 9. Artefactos `runs/` sin credenciales/tokens/PII ✅
- Revisados `audit-1.md`, `audit-1-intento-2.md`, `audit-1-intento-3.md`, `audit-2.md`, `test-report-1.md`, `test-report-2.md`, `test-report-3.md`, `decision.md`, `spec.md`.
- Discuten **formas/categorías** (ej. "termina en .supabase.co", "formato JWT", "variable presente/ausente"), nunca valores reales.
- `test-report-2.md` Anexo C.5 usa placeholder `<SUPABASE_SERVICE_ROLE_KEY>`.
- `decision.md` Anexo D.5: *"Reportar únicamente esas dos líneas [ref y role]. Ninguna de las dos es secreta."*

### 10. Preparación real para `develop → main` ⚠️ (condicionado a corregir punto 2)
- Candidato técnico listo: marca unificada a "Sonríe más", OG URL corregida, `docs.yml` seguro, npm version 1.0.0.
- `docs/tecnica/index.md:71` y `docs/usuario/index.md:69` tienen enlace exacto "Validación del MVP en producción".
- `docs/tecnica/validacion-mvp-produccion.md` y `docs/usuario/validacion-mvp-produccion.md` existen.
- **Bloqueante**: el `overflow-x: hidden` global en `body` debe eliminarse o justificarse/documentarse como excepción deliberada antes del release. Si es estilo legacy necesario para otro propósito, debe documentarse en `decision.md` y el test debe corregirse para no dar falso positivo.

---

**Conclusión**: Un hallazgo bloqueante (punto 2) y un test defectuoso que no lo detecta. El resto cumple.
