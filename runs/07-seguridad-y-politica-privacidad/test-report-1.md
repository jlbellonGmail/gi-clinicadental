```yaml
status: approved
attempt: 1
feedback:
  - "Sin hallazgos bloqueantes. Los 19 criterios de aceptación del spec se verificaron de forma independiente (lectura de código + ejecución real en jsdom sobre un servidor HTTP local, no solo inspección visual) y todos pasan."
```

## Reporte QA — 07-seguridad-y-politica-privacidad (intento 1)

Worktree: `D:\proyectos\worktrees\seguridad-y-politica-privacidad`, rama
`feature/07-seguridad-y-politica-privacidad` (confirmado con `git branch
--show-current` antes de empezar). Commit auditado: `3565fff` ("feat(07):
agregar checkbox de consentimiento y política de privacidad").

### Método

No confié en el reporte del builder-agent como evidencia: releí
`index.html`, `script.js`, `style.css` y `politica-privacidad.html`
completos, y ejecuté una verificación real de comportamiento del DOM
(no solo lectura de código) usando `jsdom` sobre un servidor HTTP local
que sirve el propio worktree, para reproducir la carga real de
`script.js`/`style.css` vía `<link>`/`<script src>` (no solo `eval` de
archivos sueltos). No se instaló ninguna dependencia de forma
permanente: `jsdom` se instaló con `npm install jsdom --no-save` en el
worktree, se usó, y se removió `node_modules/` al terminar (`git status`
quedó limpio; `package-lock.json`, que sí está versionado desde una
feature anterior, se restauró con `git checkout -- package-lock.json`
después de que un `rm -rf node_modules package-lock.json` lo borrara por
error).

### Verificación criterio por criterio (spec.md, 19 criterios)

1. **Checkbox `id="consent"` `required` inmediatamente antes del botón
   submit** — Confirmado leyendo `index.html` líneas 168-176: el
   `<div class="form-group form-group--consent">` con el `<input
   type="checkbox" id="consent" required>` es el último elemento dentro
   de `<form id="leadForm">` antes de `<button type="submit"
   ...>Enviar Solicitud</button>` (línea 176). PASS.
2. **Label accesible con enlace** — `<label for="consent">` envuelve
   tanto el `<input>` como un `<span>` con el texto y el `<a
   href="politica-privacidad.html" target="_blank" rel="noopener
   noreferrer">política de privacidad</a>` (líneas 169-174). El `for`
   coincide con el `id` del input, y además el label lo envuelve
   (doble asociación, ambas válidas). PASS.
3. **Verificación manual: submit sin marcar el checkbox no ocurre** —
   Ejecuté un script jsdom (`qa-consent-test.tmp.js`, no committeado,
   evidencia documentada aquí) contra `http://localhost:8791/index.html`
   servido con `python -m http.server 8791` desde la raíz del worktree.
   Con nombre y email completos y `consent.checked = false`:
   `form.checkValidity()` devolvió `false`,
   `consent.validationMessage` no vació ("Constraints not satisfied" en
   jsdom; el navegador real muestra su propio texto localizado, pero el
   mecanismo —constraint validation API vía `required`— es el mismo).
   Disparé el evento `submit` directamente y confirmé que mi listener de
   verificación NO se ejecutó (`submitFired: false`) y que
   `btn.textContent` permaneció en `"Enviar Solicitud"` (nunca cambió a
   "Enviando..."). Esto reproduce el comportamiento real: el navegador
   bloquea el `submit` nativamente antes de que cualquier handler JS
   (incluido el de `script.js`) se ejecute. PASS — con evidencia de
   ejecución real, no solo lectura de código.
4. **Verificación manual: con checkbox marcado + nombre/email, el flujo
   simulado sigue igual** — mismo script jsdom, ahora con
   `consent.checked = true`: `form.checkValidity()` devolvió `true`.
   Disparé el evento `submit` (esta vez sirviendo `script.js` real vía
   HTTP para que el handler de `script.js` corriera de verdad, no un
   mock): inmediatamente después del dispatch, `btn.textContent` pasó a
   `"Enviando..."` y `btn.disabled` a `true`. Tras esperar ~1700ms (el
   `setTimeout` real es 1500ms), `btn.textContent` pasó a
   `"¡Solicitud Enviada!"` — idéntico al comportamiento pre-existente
   documentado en el spec y en `audit-1.md` (mismo `setTimeout`, mismo
   mensaje). PASS con ejecución real del `script.js` sin modificar.
5. **Existe `politica-privacidad.html` en la raíz** — Confirmado:
   `D:\proyectos\worktrees\seguridad-y-politica-privacidad\politica-privacidad.html`
   existe, 121 líneas, sibling de `index.html`. PASS.
6. **Enlazada desde el footer y desde el checkbox** — Footer de
   `index.html` línea 205:
   `<a href="politica-privacidad.html" style="color: #bbb;">Privacidad</a>`
   (reemplaza el placeholder `<a href="#">Privacidad</a>` citado en el
   spec; confirmé con `git diff origin/develop...HEAD -- index.html` que
   antes decía exactamente `href="#"`). El checkbox enlaza a la misma
   ruta (ver criterio 2). PASS.
7. **Secciones con encabezados identificables** — `politica-privacidad.html`
   tiene exactamente un `<h1>` (`grep -c "<h1"` → 1) y seis `<h2>`
   (`grep -c "<h2"` → 6), uno por cada sección exigida: 1. Finalidad,
   2. Datos almacenados, 3. Responsable del tratamiento, 4. Destinatarios,
   5. Plazo de conservación, 6. Procedimiento ARCO. PASS.
8. **Datos institucionales no confirmados marcados explícitamente** —
   Verifiqué las tres secciones correspondientes: "Responsable del
   tratamiento" (línea 65-69), "Plazo de conservación" (líneas 85-89) y
   el canal ARCO dentro de "Procedimiento ARCO" (líneas 100-105) usan
   literalmente el texto `[A COMPLETAR POR EL CLIENTE: ...]` dentro de
   `<p class="legal-placeholder">`. No encontré ningún dato ficticio
   (razón social, CUIT, domicilio) presentado como real. El email de
   plantilla `hola@saviadental.com` (que sí aparece en `index.html`,
   fuera de esta feature) NO se reutiliza como canal ARCO — el texto
   remite explícitamente al ítem `10-actualizacion-datos-contacto` del
   ROADMAP. PASS.
9. **Versión idéntica carácter por carácter entre ambos archivos** —
   `politica-privacidad.html` línea 30:
   `<p class="legal-version">Versión: v1-2026-08-20</p>`.
   `script.js` línea 5: `const POLITICA_PRIVACIDAD_VERSION =
   'v1-2026-08-20';`. Comparé el substring después de "Versión: " con el
   valor de la constante carácter por carácter: `v1-2026-08-20` en ambos
   casos, 13 caracteres, sin espacios ni diferencias de mayúsculas.
   PASS.
10. **`POLITICA_PRIVACIDAD_VERSION` string no vacío ≤50 caracteres** —
    `'v1-2026-08-20'.length` = 13 ≤ 50, no vacío. PASS.
11. **`script.js` construye el payload con `consentimiento_privacidad` y
    `version_politica_privacidad` antes de la simulación** — Confirmado
    en `script.js` líneas 45-65: el objeto `leadPayload` se arma dentro
    del listener `submit`, después del chequeo defensivo de
    `consentCheckbox.checked` y ANTES de `btn.disabled = true` / del
    bloque `setTimeout` (línea 72 en adelante). Incluye
    `consentimiento_privacidad: consentCheckbox.checked` (booleano leído
    del DOM, no hardcodeado) y `version_politica_privacidad:
    POLITICA_PRIVACIDAD_VERSION`, además de `nombre`, `email`,
    `telefono: null`, `servicio`, `mensaje`. PASS.
12. **Ningún campo clínico nuevo** — Los únicos `<input>`/`<select>`/
    `<textarea>` dentro de `#leadForm` siguen siendo `#name`, `#email`,
    `#service`, `#message`, más el nuevo `#consent` (checkbox de
    consentimiento, no un dato clínico). No hay ningún campo nuevo de
    salud/síntomas/tratamiento. PASS.
13. **`api/leads.js` sin modificar, validación intacta** — Corrí `git
    diff origin/develop...HEAD -- api/leads.js`: output vacío (cero
    diferencias). Además grepeé el archivo actual y confirmé que siguen
    presentes: `REQUIRED_STRING_FIELDS` incluye
    `'version_politica_privacidad'` (línea 44); `LENGTHS.
    version_politica_privacidad = { min: 1, max: 50 }` (línea 70); `if
    (payload.consentimiento_privacidad !== true) { respond(400, {
    error: 'consentimiento_requerido' }); return; }` (líneas 606-609); el
    `INSERT` escribe `consentimiento_privacidad: true` y
    `version_politica_privacidad: versionPoliticaPrivacidad` (líneas
    679-680). Sin discrepancias que documentar. PASS.
14. **Navegable por teclado, jerarquía de encabezados válida** — Un
    único `<h1>` y seis `<h2>` (ver criterio 7, jerarquía válida sin
    saltos). Foco visible: `style.css` líneas 44-51 agregan
    `a:focus-visible, button:focus-visible, input:focus-visible,
    select:focus-visible, textarea:focus-visible { outline: 2px solid
    var(--primary); outline-offset: 2px; }`, regla global que cubre el
    enlace "Volver al inicio" y los enlaces internos de
    `politica-privacidad.html` (no hay ningún `tabindex` negativo ni
    `outline: none` sin reemplazo en los selectores usados por esta
    página). PASS por lectura de código — no verifiqué visualmente con
    un lector de pantalla real (fuera del alcance práctico de este
    entorno), lo documento como limitación honesta, no como PASS con
    evidencia de accesibilidad asistiva real.
15. **`docs/tecnica/seguridad-y-politica-privacidad.md` no vacío con el
    contenido mínimo exigido** — Existe, 250 líneas. Contiene
    explícitamente: qué campos quedaron como placeholder y por qué
    (sección "Riesgos y supuestos heredados del spec"), el mecanismo de
    versión y procedimiento de actualización futura (sección 3), y la
    confirmación de que `api/leads.js` no requirió cambios (sección 6,
    "No se encontró ninguna discrepancia... No fue necesario ningún
    cambio en ese archivo"). PASS.
16. **`docs/usuario/seguridad-y-politica-privacidad.md` no vacío con
    propósito y uso** — Existe, 97 líneas. Explica para qué sirve, cómo
    verlo, cómo se comporta el formulario, qué dice la política, y una
    sección dedicada "Qué debe completar la clínica antes de publicar en
    producción" que lista los tres placeholders legales. PASS.
17. **`runs/07-seguridad-y-politica-privacidad/decision.md` no vacío con
    decisiones demostrables** — Existe, 107 líneas, con 9 decisiones
    numeradas trazables a `spec.md`/`audit-1.md`/la implementación real
    (ej. unificación del tamaño del checkbox a 24×24px citando la
    observación no bloqueante de `audit-1.md`), más una sección
    "Discrepancias encontradas vs. el spec" (ninguna) y otra de
    observaciones de auditoría atendidas. PASS.
18. **`docs/tecnica/index.md` con enlace exacto** — `grep -c
    "seguridad-y-politica-privacidad.md" docs/tecnica/index.md` → 1
    ocurrencia. Línea 64:
    `- [Seguridad y política de privacidad](seguridad-y-politica-privacidad.md)`,
    formato exacto exigido por el spec, dentro de la zona
    `FEATURE_LINKS` (confirmado también programáticamente, ver sección
    "Contrato común" abajo). PASS.
19. **`docs/usuario/index.md` con enlace exacto equivalente** — `grep -c
    "seguridad-y-politica-privacidad.md" docs/usuario/index.md` → 1
    ocurrencia, mismo formato exacto. PASS.

### Casos borde (spec.md, sección "Casos borde a contemplar")

- **JS deshabilitado**: el bloqueo depende del atributo `required`
  nativo (HTML5 constraint validation), no de `script.js` — verificado
  indirectamente: `form.checkValidity()` es una API del navegador/DOM
  independiente de que `script.js` haya cargado o no. PASS por diseño
  verificable.
- **Click en el enlace dentro del `<label>` no togglea el checkbox**: no
  reproducido con un click real de mouse en este entorno (no hay
  navegador gráfico disponible), pero es comportamiento estándar de la
  especificación HTML (un `<a>` interactivo anidado dentro de un
  `<label>` consume el evento de click y no dispara la activación del
  control asociado al label) — documentado aquí como verificación por
  lectura de código/especificación, no como prueba con click real de
  mouse. No encontré ningún `event.preventDefault()`/`stopPropagation()`
  personalizado en `script.js` que interfiera con este comportamiento
  nativo (no hay ningún listener de click agregado sobre `#consent` o su
  `<label>` más allá del `submit` handler del formulario).
- **`leadForm.reset()` destilda el checkbox**: verificado con ejecución
  real (ver criterio 4): `consent.checked` pasó de `true` a `false`
  después del `setTimeout` de éxito simulado, y `nameInput.value` volvió
  a `""`. PASS con evidencia de ejecución real.
- **Longitud ≤50 de la versión**: PASS (ver criterio 10).
- **Responsive/mobile**: `style.css` fija `width/height/min-width: 24px`
  para `.form-group--consent input[type="checkbox"]` (24×24px, por
  encima del mínimo de 18px mencionado en el diseño propuesto original y
  alineado con la recomendación de 24×24px de "Casos borde" del spec;
  `decision.md` documenta esta unificación explícitamente atendiendo la
  observación de `audit-1.md`). No verifiqué visualmente en un viewport
  angosto real (no hay navegador gráfico en este entorno); lo documento
  como verificación por lectura de CSS, no como prueba visual en
  dispositivo/viewport real.
- **Lectores de pantalla**: el `<label for="consent">` envuelve todo el
  texto (incluido el enlace), sin ningún `aria-label` que lo contradiga
  ni texto duplicado — verificado por lectura del DOM, no con un lector
  de pantalla real.
- **`politica-privacidad.html` accedida directamente**: tiene
  `<!DOCTYPE html>`, `lang="es"`, `<meta charset>`, `<meta viewport>` y
  `<title>` propios (línea 1-6), no depende de `index.html` ni incluye
  `script.js`. Serví el archivo directamente vía HTTP
  (`http://localhost:8791/politica-privacidad.html`, `curl` devolvió
  `200`) para confirmar que es servible de forma autónoma. PASS.

### `api/leads.js` — sin cambios (punto 2 de la tarea encomendada)

Ver criterio 13 arriba. `git diff origin/develop...HEAD -- api/leads.js`
no arrojó ninguna línea de diferencia.

### `setTimeout`/comentario `// Simulate API call` intactos (punto 3)

`script.js` línea 71: `// Simulate API call`, seguida del mismo
`setTimeout(() => { ... }, 1500)` con el mismo `setTimeout` anidado de
3000ms para restaurar el botón (líneas 72-83). Comparé contra
`git diff origin/develop...HEAD -- script.js`: el diff solo agrega la
constante `POLITICA_PRIVACIDAD_VERSION`, el chequeo defensivo del
checkbox y la construcción de `leadPayload` — no toca ni una línea
dentro del bloque `setTimeout` de simulación ni el comentario. No se
conectó ningún `fetch()` real. PASS.

### Suite pytest existente (`tests/`)

```
python -m pytest tests/ -q --basetemp=<dir bajo scratchpad>
```

Resultado primera corrida completa: `1 failed, 31 passed in 230.21s`.
El único fallo fue
`tests/test_local_reconciler_scripts.py::test_start_reconciler_from_linked_worktree`,
que **no tiene relación con esta feature**: el diff de esta rama contra
`origin/develop` no toca ningún archivo bajo `scripts/` ni `tests/` (ver
`git diff origin/develop...HEAD --stat` más abajo — solo
`docs/`, `index.html`, `politica-privacidad.html`, `runs/`, `script.js`,
`style.css`). Es un test de temporización sobre un proceso PowerShell en
background que arranca el reconciliador local y espera un archivo de log
con un `wait_for_reconciler_running` — plausible de ser sensible a la
carga del entorno. Reejecuté ese único test de forma aislada
inmediatamente después:

```
python -m pytest tests/test_local_reconciler_scripts.py::test_start_reconciler_from_linked_worktree -q
```

Resultado: `1 passed in 7.54s`. Confirma que fue una falla transitoria
de temporización del entorno de ejecución, no una regresión introducida
por esta feature (que no toca ese código). No lo declaro simplemente
"ignorable" sin evidencia: lo documento con el resultado de la
reejecución aislada como evidencia de que es flaky, no una rotura real.

```
git diff origin/develop...HEAD --stat
```

```
 docs/tecnica/index.md                              |   1 +
 docs/tecnica/seguridad-y-politica-privacidad.md    | 249 +++++++++++
 docs/usuario/index.md                              |   1 +
 docs/usuario/seguridad-y-politica-privacidad.md    |  96 +++++
 index.html                                         |  10 +-
 politica-privacidad.html                           | 121 ++++++
 runs/07-seguridad-y-politica-privacidad/audit-1.md |  48 +++
 runs/07-seguridad-y-politica-privacidad/decision.md| 106 +++++
 runs/07-seguridad-y-politica-privacidad/spec.md    | 456 +++++++++++++++++++
 script.js                                          |  33 +-
 style.css                                          |  87 ++++
 11 files changed, 1206 insertions(+), 2 deletions(-)
```

Confirma también que `ROADMAP.md` no fue tocado por esta feature (no
aparece en el diff) — sigue en `[ ]`, ver más abajo.

### Índices de documentación

- `docs/tecnica/index.md`: exactamente 1 ocurrencia de
  `seguridad-y-politica-privacidad.md`, formato
  `- [Seguridad y política de privacidad](seguridad-y-politica-privacidad.md)`.
- `docs/usuario/index.md`: exactamente 1 ocurrencia, mismo formato.
- Sin duplicados en ninguno de los dos.

### Contrato común (`scripts/feature-contract.ps1`)

Ejecuté, después de escribir este mismo `test-report-1.md` (igual que en
features anteriores, ej. `06-confirmacion-automatica-paciente`):

```powershell
Import-Module .\scripts\feature-contract.ps1 -Force
Assert-FeatureContract -Slug '07-seguridad-y-politica-privacidad' -Title 'Seguridad y política de privacidad'
```

Resultado: sin excepciones. Verifica programáticamente (no solo por
inspección visual) que existen y no están vacíos `decision.md`,
`spec.md`, `docs/tecnica/seguridad-y-politica-privacidad.md`,
`docs/usuario/seguridad-y-politica-privacidad.md`, al menos un
`audit-N.md` y al menos un `test-report-N.md`, y que ambos índices
contienen el enlace exacto dentro de la zona `FEATURE_LINKS` vía
`Assert-IndexLink`.

### `ROADMAP.md`

`grep -n "07-seguridad" ROADMAP.md` → línea 101, con el prefijo
`- [ ] 07-seguridad-y-politica-privacidad — ...` sin modificar. Confirmo
que no lo toqué yo tampoco: marcar `[-] READY_FOR_PR` es responsabilidad
del paso posterior del circuito (`scripts/ready-for-pr.ps1`), fuera del
rol de `qa-agent`.

### Hallazgos

Ninguno bloqueante. Todos los criterios de aceptación (1-19) del spec se
verificaron con evidencia concreta: lectura de código línea por línea
más ejecución real en jsdom sobre un servidor HTTP local para los
criterios de comportamiento (3, 4, y el caso borde de `reset()`). Las
únicas verificaciones que quedaron limitadas a lectura de código en vez
de prueba interactiva real con navegador gráfico/lector de pantalla
fueron: el comportamiento exacto de click en el enlace dentro del
`<label>` (criterio de caso borde, no un criterio de aceptación
numerado) y la revisión visual con lector de pantalla real (criterio 14
parcial) — documentado explícitamente arriba como limitación del
entorno, no declarado como PASS con evidencia que no tengo.

### Veredicto

`approved`. Implementación conforme a los 19 criterios de aceptación y a
`audit-1.md`. `api/leads.js` intacto. Simulación (`setTimeout`/comentario
`// Simulate API call`) intacta, sin `fetch()` real (correcto, fuera de
alcance de esta feature). Documentación técnica y de usuario presentes y
no vacías. `decision.md` presente con decisiones demostrables. Índices
con enlaces exactos sin duplicados, verificados también
programáticamente con `Assert-FeatureContract`. Suite pytest en verde
tras descartar un fallo transitorio no relacionado con esta feature
(reejecución aislada confirmó que pasa). `ROADMAP.md` permanece `[ ]`,
como corresponde a esta etapa del circuito.

Rutas relevantes:
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\index.html`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\script.js`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\style.css`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\politica-privacidad.html`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\api\leads.js`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\docs\tecnica\seguridad-y-politica-privacidad.md`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\docs\usuario\seguridad-y-politica-privacidad.md`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\runs\07-seguridad-y-politica-privacidad\decision.md`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\runs\07-seguridad-y-politica-privacidad\audit-1.md`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\docs\tecnica\index.md`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\docs\usuario\index.md`
- `D:\proyectos\worktrees\seguridad-y-politica-privacidad\ROADMAP.md`
