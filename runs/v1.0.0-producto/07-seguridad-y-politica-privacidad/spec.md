# Spec: Seguridad y política de privacidad

## Alcance

### Incluye

1. Un checkbox de consentimiento **obligatorio** (`required`) dentro de
   `#leadForm` en `index.html`, ubicado inmediatamente antes del botón
   `type="submit"`, con una etiqueta (`<label>`) asociada correctamente
   (`for`/`id`) que incluye un enlace a la política de privacidad.
2. Una página nueva `politica-privacidad.html` en la raíz del repo
   (sibling de `index.html`, sin build, reutilizando `style.css`), con
   el contenido mínimo exigido por el pedido: finalidad, datos
   almacenados, responsable, destinatarios, plazo de conservación y
   procedimiento de acceso/rectificación/eliminación (ARCO). Enlazada
   desde el checkbox del formulario y desde el footer de `index.html`
   (reemplazando el placeholder actual `<a href="#">Privacidad</a>`).
3. Una constante de versión de política (`POLITICA_PRIVACIDAD_VERSION`)
   en `script.js`, visible también en `politica-privacidad.html`, que
   corresponde 1:1 con la columna `version_politica_privacidad` de la
   tabla `leads` (ya existente desde la feature 02).
4. Cambios mínimos en `script.js`: validar el checkbox antes de simular
   el envío, y armar (sin enviar por red todavía) un objeto de payload
   que incluya `consentimiento_privacidad: true` y
   `version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION`, listo
   para que la feature `08-conexion-frontend-api` lo use directamente en
   su `fetch()`.
5. Documentación (`docs/tecnica/seguridad-y-politica-privacidad.md`,
   `docs/usuario/seguridad-y-politica-privacidad.md`), `decision.md` y
   enlaces en ambos índices.

### Explícitamente NO incluye

- **No se modifica `api/leads.js`**: ya valida `consentimiento_privacidad
  === true` (error `consentimiento_requerido`) y
  `version_politica_privacidad` como campo string obligatorio de 1–50
  caracteres (errores `campo_requerido_faltante`/`tipo_invalido`/
  `longitud_excedida`), desde la feature `03-endpoint-recepcion-leads`.
  El único deber de esta feature respecto al backend es **verificar por
  lectura de código** que esa validación sigue vigente tal como está
  documentada (ver criterio de aceptación 16) — si el reviewer o el
  builder detectan una discrepancia con lo aquí descrito, debe
  documentarse explícitamente, no asumirse en silencio ni corregirse
  puertas adentro de esta feature sin dejar rastro.
- **No se conecta `#leadForm` a `POST /api/leads` con `fetch()` real**:
  la simulación con `setTimeout` y el comentario `// Simulate API call`
  siguen existiendo tal cual hasta la feature `08-conexion-frontend-api`.
  Esta feature solo deja el checkbox y el payload construidos y
  correctos para que esa conexión futura sea un cambio mínimo (sustituir
  el bloque `setTimeout` por un `fetch(..., { body:
  JSON.stringify(leadPayload) })`).
- **No se agrega un campo de teléfono al formulario**: `index.html`
  actualmente no tiene ningún `<input>` de teléfono (solo nombre, email,
  servicio, mensaje), aunque `api/leads.js`/la tabla `leads` sí soportan
  `telefono` como opcional. Es una discrepancia preexistente detectada
  durante el análisis, ajena al pedido de esta feature (agregar un
  campo de teléfono sería un cambio de UX/alcance de otra feature, no de
  "seguridad y política de privacidad"). El payload que arma `script.js`
  en esta feature envía `telefono: null`, consistente con el
  comportamiento ya aceptado por `api/leads.js` para el campo ausente.
- **No se redacta una política de privacidad con validez legal
  garantizada**: no hay abogado ni datos institucionales reales
  provistos por el negocio (razón social, CUIT, domicilio, canal oficial
  de contacto). Esos campos se dejan marcados explícitamente como
  pendientes — ver "Riesgos / supuestos".
- **No se agrega ningún dato de negocio inventado** (teléfono real,
  dirección real, email de contacto validado): se reutiliza únicamente
  lo que ya existe en `index.html` como placeholder evidente (regla de
  dominio de `AGENTS.md`), sin presentarlo como dato confirmado.
- **No se rediseña visualmente el formulario ni la landing** (fuera de
  alcance de la feature `09-rediseño-estetico-y-assets`): los cambios de
  CSS se limitan a lo mínimo necesario para que el checkbox sea legible,
  accesible y clickeable.
- **No se agrega ningún backend, base de datos o dependencia de build
  nueva** — no aplica la obligación de `docs/tecnica/arquitectura.md`
  porque no hay ninguna decisión de arquitectura nueva en esta feature
  (es HTML/JS estático adicional, mismo patrón que el resto del sitio).

## Contexto

El sitio es una landing estática de captación de leads para una clínica
dental (`AGENTS.md`). El formulario `#leadForm` (`index.html`) todavía
simula el envío (`script.js`, `setTimeout`), pero el backend real
(`POST /api/leads`, feature `03`) y el esquema de Supabase (feature `02`)
ya esperan explícitamente dos campos que hoy el frontend nunca envía:
`consentimiento_privacidad boolean not null` y
`version_politica_privacidad text not null`
(`supabase/migrations/20260819210130_create_leads_table.sql`, líneas
26-27). Esta feature cierra esa brecha del lado del frontend: agrega el
mecanismo de consentimiento activo (checkbox obligatorio) y la política
de privacidad que el checkbox referencia, y dejar el valor de ambos
campos listo en el frontend para cuando la feature `08` conecte
`fetch()` de verdad.

El pedido original (ROADMAP ítem 07) exige, además, "evitar solicitar
información clínica sensible que no sea indispensable para el primer
contacto". El formulario actual ya cumple esto por diseño: solo pide
nombre, email, servicio de interés y un mensaje libre opcional (el único
campo donde el paciente podría voluntariamente escribir información de
salud, ya señalado como riesgo conocido en el comentario de la columna
`mensaje` de la migración de la feature `02`). Esta feature no agrega
ningún campo nuevo de datos personales o clínicos — solo agrega el
checkbox de consentimiento sobre los datos que el formulario ya
recolecta.

## Diseño propuesto

### 1. Checkbox de consentimiento en `index.html`

Dentro de `<form id="leadForm">`, inmediatamente antes de
`<button type="submit" ...>Enviar Solicitud</button>`:

```html
<div class="form-group form-group--consent">
    <label for="consent">
        <input type="checkbox" id="consent" required>
        He leído y acepto la
        <a href="politica-privacidad.html" target="_blank" rel="noopener noreferrer">
            política de privacidad
        </a>
        y autorizo a la clínica a contactarme para responder mi
        solicitud.
    </label>
</div>
```

Decisiones:

- `id="consent"` (nuevo, no colisiona con `name`/`email`/`service`/
  `message` ya existentes).
- `required` es la primera línea de defensa: un formulario sin
  `novalidate` bloquea nativamente el evento `submit` si un campo
  `required` no es válido, **sin necesitar JavaScript**. Esto ya
  satisface el criterio "el envío no ocurre sin consentimiento" incluso
  si `script.js` fallara en cargar.
- El enlace a la política abre en pestaña nueva (`target="_blank"
  rel="noopener noreferrer"`) para no hacer perder el estado ya
  completado del formulario si el usuario quiere leer la política antes
  de tildar el checkbox.
- El `<label>` envuelve tanto el `<input>` como el texto y el enlace
  (patrón estándar de "checkbox + términos"): un click en cualquier
  parte del texto que NO sea el enlace debe togglear el checkbox (mismo
  comportamiento nativo que cualquier `<label>` que envuelve un
  `<input>`); un click específicamente en el `<a>` debe navegar, sin
  togglear el checkbox (comportamiento estándar de elementos
  interactivos anidados en la mayoría de navegadores modernos — ver
  "Casos borde").
- CSS: el builder-agent debe agregar en `style.css` el mínimo necesario
  (ej. una clase `.form-group--consent` con `display: flex`,
  alineación vertical del checkbox con la primera línea del texto,
  tamaño de checkbox ≥18px) para que sea legible y clickeable en
  mobile — sin rediseñar el resto del formulario.

### 2. `politica-privacidad.html` (archivo nuevo, raíz del repo)

Documento HTML propio (no una sección dentro de `index.html`), con:

- `<!DOCTYPE html>`, `lang="es"`, `<meta charset>` y `<meta viewport>`
  iguales a `index.html`.
- `<link rel="stylesheet" href="style.css">` (reutiliza estilos
  existentes; no se crea una hoja de estilos nueva).
- Un header simple con enlace de vuelta a `index.html` (ej. reutilizando
  `.logo` y un link "Volver al inicio").
- Contenido con encabezados semánticos (`<h1>Política de Privacidad</h1>`
  y `<h2>` por sección), cubriendo como mínimo estas secciones (mapeo
  exigido por el pedido original):
  1. **Finalidad**: para qué se recolectan los datos del formulario
     (contactar al paciente para responder su consulta y, si corresponde,
     coordinar un turno). Contenido factual, no inventado: es
     exactamente lo que hace el sistema hoy.
  2. **Datos almacenados**: nombre, email, teléfono (si se recolectara
     en el futuro), servicio de interés, mensaje, fecha de creación,
     estado de seguimiento comercial, y el propio registro de
     consentimiento/versión de política — mapea 1:1 con las columnas
     reales de la tabla `leads` (factual, no inventado).
  3. **Responsable del tratamiento**: marcado explícitamente como
     `[A COMPLETAR POR EL CLIENTE: razón social, CUIT/identificación
     fiscal y domicilio legal de la clínica]` — no se inventa un nombre
     de empresa ni un CUIT ficticio.
  4. **Destinatarios**: descripción factual de la arquitectura real
     (personal administrativo de la clínica que gestiona los leads;
     Supabase como proveedor de base de datos donde se almacenan los
     datos; el proveedor SMTP de Ferozo como intermediario técnico para
     el envío de las notificaciones por email) — basado en el stack ya
     documentado en `AGENTS.md`/`docs/tecnica/arquitectura.md`, no
     inventado.
  5. **Plazo de conservación**: marcado explícitamente como
     `[A COMPLETAR POR EL CLIENTE: plazo de conservación de los leads,
     ej. "X meses desde el último contacto" o "hasta que el paciente
     solicite su eliminación"]` — no se fija un plazo arbitrario como si
     fuera una política ya decidida por el negocio.
  6. **Procedimiento ARCO** (acceso, rectificación, eliminación):
     explica el derecho en términos genéricos (el paciente puede
     solicitar acceder a sus datos, corregirlos o pedir su eliminación)
     y marca el canal de contacto para ejercerlo como
     `[A COMPLETAR POR EL CLIENTE: email o canal oficial dedicado a
     solicitudes de privacidad — puede coincidir con el email de
     contacto general del sitio una vez validado en el ítem
     10-actualizacion-datos-contacto del ROADMAP]`. No se reutiliza el
     email de plantilla `hola@saviadental.com` como si fuera un canal
     real confirmado.
  7. **Versión de la política**: texto visible, ej. "Versión:
     `v1-2026-08-20`" — debe coincidir carácter por carácter con la
     constante `POLITICA_PRIVACIDAD_VERSION` de `script.js` (ver punto
     3).
- Footer simple con el mismo bloque "Legal" que `index.html` (o un
  link de vuelta), sin duplicar contenido de negocio no verificado.

### 3. Versión de la política

En `script.js`, cerca del inicio del archivo (fuera del handler de
submit, para que sea fácil de ubicar y actualizar):

```js
// Debe coincidir exactamente con el texto "Versión: ..." mostrado en
// politica-privacidad.html. Actualizar ambos valores juntos cada vez
// que cambie el contenido de la política (ver
// docs/tecnica/seguridad-y-politica-privacidad.md).
const POLITICA_PRIVACIDAD_VERSION = 'v1-2026-08-20';
```

Límite: string no vacío, ≤50 caracteres — coherente con
`LENGTHS.version_politica_privacidad` ya validado en `api/leads.js`
(`{ min: 1, max: 50 }`).

### 4. Cambios en `script.js` (handler de `#leadForm`)

Dentro del listener `submit` existente, **antes** del bloque
`setTimeout` que simula el envío:

1. Lectura defensiva del checkbox: si
   `document.getElementById('consent').checked` es `false`, no proceder
   (en la práctica esto ya está cubierto por el atributo `required`
   nativo, que impide que el evento `submit` llegue a dispararse; este
   chequeo es una segunda capa explícita, documentada como tal, no un
   reemplazo de la validación nativa).
2. Armar un objeto de payload con los valores actuales del formulario,
   listo para la feature `08`:

```js
const leadPayload = {
    nombre: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefono: null, // el formulario actual no tiene campo de teléfono
    servicio: document.getElementById('service').value,
    mensaje: document.getElementById('message').value.trim() || null,
    consentimiento_privacidad: document.getElementById('consent').checked,
    version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
};
```

   Este objeto **no se envía por red en esta feature** (sigue existiendo
   el `setTimeout` de simulación tal cual); su único propósito es que la
   feature `08` pueda reemplazar el bloque de simulación por
   `fetch('/api/leads', { method: 'POST', headers: {...}, body:
   JSON.stringify(leadPayload) })` con un diff mínimo, sin tener que
   diseñar la estructura del payload en ese momento.
3. `leadForm.reset()` (ya existente tras el éxito simulado) también
   destilda el checkbox de forma nativa — no requiere código adicional.

### 5. Footer de `index.html`

Reemplazar:

```html
<li style="margin-bottom: 10px;"><a href="#" style="color: #bbb;">Privacidad</a></li>
```

por:

```html
<li style="margin-bottom: 10px;"><a href="politica-privacidad.html" style="color: #bbb;">Privacidad</a></li>
```

No se tocan los enlaces "Términos" ni "Cookies" (siguen siendo `#`,
fuera de alcance — no hay pedido de crear esas páginas en esta feature).

### 6. `api/leads.js` — verificación, sin cambios de código

Evidencia de que la validación ya existe (líneas actuales del archivo,
sujetas a cambiar de número si el archivo se edita, pero el contenido
debe seguir presente):

- `REQUIRED_STRING_FIELDS` incluye `'version_politica_privacidad'`.
- `LENGTHS.version_politica_privacidad = { min: 1, max: 50 }`.
- Verificación explícita: `if (payload.consentimiento_privacidad !==
  true) { respond(400, { error: 'consentimiento_requerido' }); return;
  }`.
- El `INSERT` a Supabase ya escribe `consentimiento_privacidad: true` y
  `version_politica_privacidad: versionPoliticaPrivacidad` en la fila
  insertada.

El builder-agent debe confirmar (no volver a implementar) que esto
sigue así al momento de construir esta feature, y dejar constancia en
`docs/tecnica/seguridad-y-politica-privacidad.md`. Si por algún motivo
la validación ya no estuviera presente, es un hallazgo que debe
reportarse explícitamente (posible regresión de una feature anterior),
no corregirse en silencio dentro de esta feature sin documentarlo.

## Criterios de aceptación

1. `index.html` contiene un `<input type="checkbox" id="consent"
   required>` dentro de `<form id="leadForm">`, ubicado inmediatamente
   antes del botón `type="submit"`.
2. El checkbox tiene una etiqueta asociada accesible (`<label
   for="consent">` envolviendo el input, o `for`/`id` explícitos) cuyo
   texto incluye un enlace `<a href="politica-privacidad.html">` (o ruta
   relativa equivalente).
3. Verificación manual en navegador: al intentar enviar `#leadForm` con
   el checkbox sin marcar (incluso con nombre/email completos), el
   envío no se produce — el navegador muestra su mensaje de validación
   nativo y el botón nunca cambia a "Enviando...".
4. Verificación manual: al marcar el checkbox y completar los campos
   obligatorios existentes (nombre, email), el flujo de envío simulado
   sigue funcionando exactamente igual que antes de esta feature (mismo
   `setTimeout`, mismo mensaje "¡Solicitud Enviada!").
5. Existe `politica-privacidad.html` en la raíz del repo.
6. `politica-privacidad.html` está enlazada desde el `<footer>` de
   `index.html` (reemplazando el placeholder `<a href="#">Privacidad</a>`)
   y desde el checkbox del formulario.
7. `politica-privacidad.html` contiene, con encabezados identificables,
   las secciones: finalidad, datos almacenados, responsable,
   destinatarios, plazo de conservación y procedimiento ARCO.
8. Los datos institucionales no confirmados (responsable/razón social,
   identificación fiscal, domicilio legal, canal oficial de contacto
   ARCO, plazo de conservación) aparecen marcados explícitamente como
   pendientes de completar por el cliente (ej. `[A COMPLETAR POR EL
   CLIENTE: ...]`), nunca como datos ficticios que parezcan reales.
9. `politica-privacidad.html` muestra un texto de versión (ej.
   "Versión: v1-2026-08-20") idéntico carácter por carácter al valor de
   la constante `POLITICA_PRIVACIDAD_VERSION` en `script.js`.
10. `script.js` define `POLITICA_PRIVACIDAD_VERSION` como un string no
    vacío de máximo 50 caracteres.
11. `script.js`, dentro del handler de `submit` de `#leadForm` y antes
    de la simulación de envío, construye un objeto (verificable leyendo
    el código) que incluye `consentimiento_privacidad` (booleano, leído
    del estado real del checkbox) y `version_politica_privacidad`
    (igual a `POLITICA_PRIVACIDAD_VERSION`), además de los campos ya
    existentes del formulario.
12. El formulario `#leadForm` no incorpora ningún campo nuevo de
    información clínica/de salud: los únicos inputs siguen siendo
    nombre, email, servicio y mensaje (más el checkbox de consentimiento
    agregado por esta feature).
13. Revisión de código confirma que `api/leads.js` sigue validando
    `consentimiento_privacidad === true` y `version_politica_privacidad`
    como campo string obligatorio (1–50 caracteres) sin haber sido
    modificado por esta feature; si se detecta una discrepancia, queda
    documentada explícitamente en `docs/tecnica/
    seguridad-y-politica-privacidad.md` en vez de corregirse en
    silencio.
14. `politica-privacidad.html` es navegable por teclado (foco visible en
    el enlace de vuelta y en cualquier enlace interno) y usa jerarquía
    de encabezados válida (`<h1>` único, `<h2>` por sección).
15. Debe existir `docs/tecnica/seguridad-y-politica-privacidad.md`, no
    vacío, con las decisiones de diseño/implementación relevantes
    (incluyendo, como mínimo: qué campos de la política quedaron como
    placeholder y por qué, el mecanismo de versión, y la confirmación
    de que `api/leads.js` no requirió cambios).
16. Debe existir `docs/usuario/seguridad-y-politica-privacidad.md`, no
    vacío, con el propósito de la feature y cómo verla/usarla (incluyendo
    qué debe completar la clínica —los placeholders legales— antes de
    publicar en producción).
17. Debe existir `runs/07-seguridad-y-politica-privacidad/decision.md`,
    no vacío, con decisiones demostrables desde spec/auditoría/
    implementación.
18. `docs/tecnica/index.md` debe incluir un enlace exacto a
    `seguridad-y-politica-privacidad.md` dentro de la zona
    `FEATURE_LINKS` (ej.
    `- [Seguridad y política de privacidad](seguridad-y-politica-privacidad.md)`).
19. `docs/usuario/index.md` debe incluir un enlace exacto equivalente.

## Casos borde a contemplar

- **JavaScript deshabilitado**: el atributo `required` nativo del
  checkbox debe seguir bloqueando el envío del formulario sin depender
  de `script.js` (validación HTML5 nativa del navegador).
- **Click en el enlace "política de privacidad" dentro del `<label>`**:
  no debe togglear el estado del checkbox — verificar manualmente en al
  menos un navegador de escritorio y uno mobile (comportamiento estándar
  de elementos interactivos anidados, pero conviene confirmarlo dado que
  el checkbox está envuelto por el mismo `<label>` que el enlace).
- **`leadForm.reset()` tras un envío simulado exitoso**: el checkbox
  debe volver a quedar sin marcar (comportamiento nativo de
  `form.reset()`), de modo que un segundo envío en la misma sesión
  vuelva a exigir el consentimiento.
- **Longitud de `POLITICA_PRIVACIDAD_VERSION`**: debe mantenerse ≤50
  caracteres si en el futuro se actualiza el string de versión, para
  seguir siendo compatible con el límite ya validado en `api/leads.js`.
- **Responsive/mobile**: el checkbox y su etiqueta deben mantenerse
  legibles y con área clickeable suficiente (mínimo recomendado ~24×24px
  para el propio input) en viewports angostos, sin romper el layout
  existente de `.form-group`.
- **Lectores de pantalla**: el `<label>` debe anunciar el texto completo
  (incluyendo que contiene un enlace) al enfocar el checkbox; no debe
  haber texto duplicado ni un `aria-label` que contradiga el texto
  visible.
- **`politica-privacidad.html` accedida directamente (sin pasar por
  `index.html`)**: debe funcionar como página autónoma (título propio,
  `<meta charset>`/`viewport`, sin depender de que `index.html` se haya
  cargado antes).
- **Actualización futura de la política**: si el contenido cambia, hay
  que actualizar simultáneamente el texto de la página y
  `POLITICA_PRIVACIDAD_VERSION` en `script.js` — el procedimiento debe
  quedar documentado en `docs/tecnica/seguridad-y-politica-privacidad.md`
  para que no se actualice uno sin el otro.
- **Formulario enviado con `mensaje` conteniendo información de salud
  voluntaria**: sigue siendo responsabilidad ya aceptada del campo libre
  `mensaje` (documentada desde la feature `02`); esta feature no agrega
  ninguna advertencia ni validación nueva sobre el contenido de ese
  campo — fuera de alcance.

## Riesgos / supuestos

- **Contenido legal sin validación jurídica real**: no existe un
  responsable de tratamiento de datos real, ni CUIT, ni domicilio, ni
  canal ARCO confirmado por el negocio. Esta spec decide redactar una
  política de privacidad con estructura y lenguaje genérico razonable
  para un formulario de captación de leads de una clínica dental,
  dejando explícitamente marcados como `[A COMPLETAR POR EL CLIENTE]`
  todos los campos que requieren un dato institucional real. Se prioriza
  cumplir el requisito técnico verificable (checkbox obligatorio,
  página accesible con las secciones exigidas, versión trazable) por
  sobre bloquear la feature hasta tener datos reales del cliente — el
  reviewer-agent puede objetar esta decisión si prefiere un umbral más
  estricto de "no publicable sin revisión legal humana explícita" antes
  del HITL final.
- **No se reutiliza el email de plantilla `hola@saviadental.com` como
  canal ARCO confirmado**: aunque ya aparece en `index.html`, es un dato
  de plantilla no verificado (ver ROADMAP ítem `10-actualizacion-
  datos-contacto`); presentarlo como el canal oficial de privacidad
  podría inducir a error. Se decide marcarlo como placeholder también,
  en vez de asumir que es válido para este propósito legal.
- **Branding inconsistente en el repo**: `index.html` usa "Savia Dental"
  como marca visible, mientras que `ROADMAP.md`/`AGENTS.md` usan
  "Sonríe más" como nombre real del negocio. Esta spec no resuelve esa
  inconsistencia (corresponde a la feature `10`): `politica-privacidad.html`
  debe usar el mismo nombre de marca que hoy aparece en `index.html`
  (consistencia visual dentro del sitio actual), no inventar cuál de los
  dos nombres es el "correcto".
- **Redacción exacta del texto de consentimiento**: el texto propuesto
  ("He leído y acepto la política de privacidad y autorizo a la clínica
  a contactarme...") es una redacción razonable pero no revisada por un
  profesional legal — el negocio real podría preferir otra formulación.
  Se documenta como decisión editable de bajo riesgo, no bloqueante.
- **Checkbox con JS habilitado vs. deshabilitado**: se asume (sin
  verificarlo con datos de analítica reales) que la gran mayoría de los
  visitantes navega con JavaScript habilitado; aun así, el diseño
  garantiza bloqueo del envío incluso sin JS gracias al atributo
  `required` nativo, por lo que este supuesto no es crítico para el
  cumplimiento del requisito de consentimiento obligatorio.
- **Objeto `leadPayload` construido pero no transmitido**: es código
  "inerte" en esta feature (no se usa para ningún `fetch()` todavía).
  Se documenta explícitamente como preparación intencional para la
  feature `08`, no como una integración parcial olvidada — el
  reviewer-agent no debería rechazar la spec por "código sin uso
  aparente" sin considerar este propósito documentado.
