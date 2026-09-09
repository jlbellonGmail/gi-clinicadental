# Seguridad y política de privacidad — documentación técnica

Cierra, del lado del frontend, la brecha detectada en el spec (`runs/07-
seguridad-y-politica-privacidad/spec.md`): `supabase/migrations/20260819210130_create_leads_table.sql`
y `api/leads.js` (feature `03-endpoint-recepcion-leads`) ya esperan
`consentimiento_privacidad boolean not null` y
`version_politica_privacidad text not null`, pero `index.html`/`script.js`
nunca los recolectaban ni construían. Esta feature agrega el mecanismo de
consentimiento activo y la página de política que referencia, y deja el
valor de ambos campos listo en `script.js` para que la feature
`08-conexion-frontend-api` los use directamente en su `fetch()`.

## 1. Checkbox de consentimiento (`index.html`)

Dentro de `<form id="leadForm">`, inmediatamente antes del botón
`type="submit"`:

```html
<div class="form-group form-group--consent">
    <label for="consent">
        <input type="checkbox" id="consent" required>
        <span>He leído y acepto la
            <a href="politica-privacidad.html" target="_blank" rel="noopener noreferrer">política de privacidad</a>
            y autorizo a la clínica a contactarme para responder mi solicitud.</span>
    </label>
</div>
```

- `id="consent"` no colisiona con los ids existentes del formulario
  (`name`, `email`, `service`, `message`).
- `required` es la primera línea de defensa: el navegador bloquea
  nativamente el evento `submit` si el checkbox no está marcado, **sin
  depender de JavaScript**. Esto ya satisface "el envío no ocurre sin
  consentimiento" incluso si `script.js` no cargara.
- El `<label>` envuelve el `<input>` y el texto completo (patrón estándar
  "checkbox + términos"): un click en cualquier parte del texto que no
  sea el `<a>` togglea el checkbox; un click específicamente en el enlace
  navega a `politica-privacidad.html` sin togglear el checkbox
  (comportamiento nativo del navegador ante un elemento interactivo
  anidado dentro de un `<label>`, no requiere JS adicional).
- El enlace abre en pestaña nueva (`target="_blank" rel="noopener
  noreferrer"`) para no perder el estado ya completado del formulario si
  el usuario quiere leer la política antes de tildar el checkbox.
- `leadForm.reset()` (ya existente tras el envío simulado exitoso)
  también destilda el checkbox de forma nativa, sin código adicional: un
  segundo envío en la misma sesión vuelve a exigir el consentimiento.

### Tamaño del checkbox (unificación tras `audit-1.md`)

El spec tenía dos valores distintos para el tamaño recomendado del
checkbox: "≥18px" en el diseño propuesto y "~24×24px" en casos borde. La
auditoría (`audit-1.md`, observación no bloqueante) recomendó unificar en
24×24px, alineado con WCAG 2.2 SC 2.5.8 (Target Size). Se implementó
`width`/`height`/`min-width: 24px` en `.form-group--consent input[type="checkbox"]`
(`style.css`), que además sobreescribe el `padding: 14px` y `width: 100%`
del selector global `input, select, textarea` (si no se sobreescribiera,
el checkbox heredaría ese padding y se vería deforme).

## 2. `politica-privacidad.html` (archivo nuevo, raíz del repo)

Página HTML standalone (no una sección de `index.html`): `<!DOCTYPE
html>`, `lang="es"`, `<meta charset>`/`<meta viewport>` propios,
`<link rel="stylesheet" href="style.css">` (reutiliza la hoja de estilos
existente, no se crea una nueva). Reutiliza el mismo `<header>` fijo con
`.logo` que `index.html`, cambiando el CTA por un enlace "Volver al
inicio" (`btn btn-outline`) — sin agregar CSS nuevo para el header, solo
clases ya existentes.

Secciones exigidas por el pedido original (mapeadas 1:1 con las columnas
reales de la tabla `leads` cuando corresponde, nunca inventadas):

1. **Finalidad**: contactar al paciente para responder su consulta y,
   si corresponde, coordinar un turno — es exactamente lo que hace el
   sistema hoy, sin agregar promesas no verificadas.
2. **Datos almacenados**: nombre, email, teléfono (aclarando que hoy el
   formulario no lo recolecta), servicio, mensaje, fecha de creación,
   estado de seguimiento comercial, y el registro de consentimiento con
   su versión.
3. **Responsable del tratamiento**: `[A COMPLETAR POR EL CLIENTE: razón
   social, CUIT/identificación fiscal y domicilio legal]` — no se inventa
   un nombre de empresa ni CUIT ficticio.
4. **Destinatarios**: personal administrativo de la clínica, Supabase
   (proveedor de base de datos) y el SMTP de Ferozo (intermediario
   técnico de envío de notificaciones) — basado en el stack ya
   documentado en `AGENTS.md`.
5. **Plazo de conservación**: `[A COMPLETAR POR EL CLIENTE: ...]` — no se
   fija un plazo arbitrario.
6. **Procedimiento ARCO**: explica el derecho en términos genéricos y
   marca el canal de contacto como `[A COMPLETAR POR EL CLIENTE: ...]`,
   remitiendo explícitamente al ítem `10-actualizacion-datos-contacto`
   del `ROADMAP.md` en vez de asumir que `hola@saviadental.com` (email de
   plantilla, no validado) sirve como canal oficial de privacidad.
7. **Versión de la política**: texto visible "Versión: v1-2026-08-20",
   idéntico carácter por carácter a `POLITICA_PRIVACIDAD_VERSION` en
   `script.js` (ver siguiente sección).

Jerarquía de encabezados: un único `<h1>Política de Privacidad</h1>` y un
`<h2>` por sección (1 a 6 enumeradas arriba). Los placeholders usan la
clase `.legal-placeholder` (fondo destacado + cursiva) para que sean
visualmente identificables como pendientes, no solo textuales.

Navegación por teclado: se agregó una regla global
`a:focus-visible, button:focus-visible, input:focus-visible,
select:focus-visible, textarea:focus-visible { outline: 2px solid
var(--primary); outline-offset: 2px; }` en `style.css` — antes no existía
ningún estilo de foco visible para enlaces en el sitio (los `<input>` sí
tenían uno vía `:focus`, pero no `:focus-visible`, y los enlaces no
tenían ninguno). Esta regla es global (aplica también a `index.html`) y
no cambia la apariencia con mouse (`:focus-visible` solo se activa con
navegación por teclado en navegadores modernos).

## 3. Versión de la política (`script.js`)

```js
// Debe coincidir exactamente con el texto "Versión: ..." mostrado en
// politica-privacidad.html. Actualizar ambos valores juntos cada vez
// que cambie el contenido de la política (ver
// docs/tecnica/seguridad-y-politica-privacidad.md).
const POLITICA_PRIVACIDAD_VERSION = 'v1-2026-08-20';
```

Declarada al inicio del archivo, fuera del handler de submit, para que
sea fácil de ubicar. String de 14 caracteres, muy por debajo del límite
de 50 que valida `api/leads.js` (`LENGTHS.version_politica_privacidad =
{ min: 1, max: 50 }`).

**Procedimiento de actualización futura**: si cambia el contenido de
`politica-privacidad.html`, hay que actualizar en el mismo commit (a)
el texto "Versión: ..." dentro de esa página y (b)
`POLITICA_PRIVACIDAD_VERSION` en `script.js`, manteniendo el string
resultante en 50 caracteres o menos. No hay ningún mecanismo automático
que sincronice ambos valores — es responsabilidad manual de quien edite
la política, documentada aquí para que no se actualice uno sin el otro.

## 4. Cambios en el handler de `submit` de `#leadForm` (`script.js`)

Antes del bloque `setTimeout` que simula el envío (que **no se modifica ni
elimina** — sigue existiendo tal cual, con el comentario `// Simulate API
call`):

```js
const consentCheckbox = document.getElementById('consent');
if (!consentCheckbox || !consentCheckbox.checked) {
    return;
}

const leadPayload = {
    nombre: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefono: null, // el formulario actual no tiene campo de teléfono
    servicio: document.getElementById('service').value,
    mensaje: document.getElementById('message').value.trim() || null,
    consentimiento_privacidad: consentCheckbox.checked,
    version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
};
```

- La comprobación `consentCheckbox.checked` es una **segunda capa
  explícita**, documentada como tal: el atributo `required` nativo ya
  impide que el evento `submit` llegue a dispararse sin el checkbox
  marcado, así que en la práctica este `return` temprano es defensivo
  (cubre, por ejemplo, un `submit` disparado programáticamente que
  saltee la validación nativa), no un reemplazo de esa validación.
- `leadPayload` **no se envía por red en esta feature**: es código
  intencionalmente "inerte", preparado para que la feature `08` sustituya
  el bloque `setTimeout` por `fetch('/api/leads', { method: 'POST',
  headers: {...}, body: JSON.stringify(leadPayload) })` con un diff
  mínimo, sin tener que diseñar la estructura del payload en ese momento.
- `telefono: null` es consistente con que `index.html` no tiene ningún
  `<input>` de teléfono hoy (discrepancia preexistente entre el
  formulario y lo que `api/leads.js`/la tabla `leads` soportan como campo
  opcional, ajena al alcance de esta feature — documentada también en el
  spec).

## 5. Footer de `index.html`

Se reemplazó el placeholder `<a href="#">Privacidad</a>` del bloque
"Legal" por `<a href="politica-privacidad.html">Privacidad</a>`. Los
enlaces "Términos" y "Cookies" siguen apuntando a `#` — no hay pedido de
crear esas páginas en esta feature.

## 6. `api/leads.js` — verificación sin cambios de código

Se confirmó por lectura directa del archivo (sin modificarlo) que la
validación descrita por el spec sigue vigente, línea por línea:

- `REQUIRED_STRING_FIELDS` incluye `'version_politica_privacidad'`.
- `LENGTHS.version_politica_privacidad = { min: 1, max: 50 }`.
- Verificación explícita `if (payload.consentimiento_privacidad !== true)
  { respond(400, { error: 'consentimiento_requerido' }); return; }`.
- El `INSERT` a Supabase escribe `consentimiento_privacidad: true` y
  `version_politica_privacidad: versionPoliticaPrivacidad` en la fila
  insertada.

**No se encontró ninguna discrepancia** entre lo que describe el spec y
el estado real de `api/leads.js` al momento de implementar esta feature.
No fue necesario ningún cambio en ese archivo, y no se hizo ninguno.

## 7. `style.css` — resumen de cambios

- `.form-group--consent label/input[type="checkbox"]/span/a`: layout en
  flexbox (checkbox alineado con la primera línea de texto), checkbox
  24×24px (ver sección "Tamaño del checkbox" arriba), `accent-color:
  var(--primary)` para que el check coincida con el color de marca.
- `.legal-content`, `.legal-content h2/p/li/ul/a`, `.legal-placeholder`:
  estilos mínimos para el cuerpo de texto de `politica-privacidad.html`
  (ancho máximo de lectura 800px, jerarquía tipográfica, viñetas
  restauradas para las listas dentro de esa sección ya que el `ul`
  global usa `list-style: none`).
- `a:focus-visible, button:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible`: foco visible global,
  descrito arriba.

No se rediseñó ningún otro componente visual del sitio existente.

## Casos borde verificados por lectura de código

- **JavaScript deshabilitado**: el atributo `required` bloquea el envío
  sin depender de `script.js` — validación HTML5 nativa del navegador,
  no requiere verificación adicional en este documento porque es
  comportamiento estándar de la especificación HTML.
- **Click en el enlace dentro del `<label>`**: no togglea el checkbox —
  comportamiento estándar de navegadores modernos ante un elemento
  interactivo (`<a>`) anidado dentro de otro (`<label>` que envuelve un
  `<input>`); no requiere JavaScript adicional para lograrlo.
- **`leadForm.reset()` tras envío simulado exitoso**: destilda el
  checkbox de forma nativa (comportamiento estándar de `HTMLFormElement.reset()`
  sobre elementos `<input type="checkbox">`).
- **Acceso directo a `politica-privacidad.html`**: funciona como página
  autónoma (título, `<meta charset>`/`viewport` propios, no depende de
  que `index.html` se haya cargado antes ni de `script.js`, que no se
  incluye en esta página).
- **Formulario sin campo de teléfono**: el `leadPayload` envía
  `telefono: null`, consistente con el manejo ya aceptado de ese campo
  ausente en `api/leads.js`.

## Riesgos y supuestos heredados del spec (sin resolver en esta feature)

- El contenido de `politica-privacidad.html` no tiene validación jurídica
  real: no hay razón social, CUIT, domicilio ni canal ARCO confirmados
  por el negocio. Quedan marcados como `[A COMPLETAR POR EL CLIENTE:
  ...]`, nunca inventados, tal como exige `AGENTS.md`.
- El texto de consentimiento ("He leído y acepto...") es una redacción
  razonable pero no revisada por un profesional legal — editable de bajo
  riesgo si el negocio real prefiere otra formulación.
- La marca visible sigue siendo "Savia Dental" (igual que el resto de
  `index.html`), aunque `ROADMAP.md`/`AGENTS.md` usan "Sonríe más" como
  nombre real del negocio — inconsistencia preexistente fuera de alcance
  de esta feature (corresponde a la feature `10`).

## Cambios de la v1.0.1

- **La version de la politica ya no es una constante de `script.js`.**
  Sale de `legal.privacyPolicyVersion` en `config/clinic.json`, el
  generador la escribe en `<meta name="politica-privacidad-version">`
  y `script.js` la lee. La version enviada con el consentimiento y la
  publicada son el mismo dato, no dos copias que hay que sincronizar a
  mano.
- **La direccion canonica pasa a ser `/politica-de-privacidad`.** Las
  dos anteriores redirigen con 308: estaban enlazadas desde
  consentimientos ya registrados y no pueden quedar en 404.
- **La politica se puede leer sin salir del formulario**, en un dialogo
  accesible. La pagina independiente sigue existiendo y sigue siendo la
  direccion canonica; el dialogo no la reemplaza. Ambas superficies se
  renderizan de la misma plantilla, en el mismo build.
- **El texto legal esta partido** entre plantilla estable
  (`templates/partials/politica-*.html`) y datos variables del cliente
  (`config/clinic.json`), con `legal.demoMode` como interruptor entre
  sitio demostrativo y clinica real.
- **No se persiste nada del formulario** para sostener el dialogo: no
  navega, asi que no hay nada que restaurar. `script.js` no usa
  `localStorage` ni `sessionStorage`, y hay un guard que lo comprueba.
