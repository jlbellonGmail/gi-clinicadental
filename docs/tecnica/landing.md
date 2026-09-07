# Landing page — documentación técnica

Sitio 100% estático: `index.html` + `style.css` + `script.js` en la raíz
del repo, sin build ni framework, sin backend.

## Estructura de la página

Secciones (`index.html`, anclas de navegación): `#inicio` (hero),
stats (`+15k`/`20+`/`24h`/`100%`), `#servicios` (6 tarjetas: implantes
24h, ortodoncia invisible, diseño de sonrisa digital, blanqueamiento,
odontología infantil, armonización orofacial), `#equipo` (factor humano),
`#contacto` (info + formulario de leads), footer.

## JavaScript (`script.js`)

- Efecto de header al hacer scroll (padding/background).
- Scroll suave a anclas internas (`a[href^="#"]`).
- `IntersectionObserver` para animaciones de aparición
  (`.section`, `.hero`, `.service-card`).
- **Formulario de leads (`#leadForm`): simulado.** El `submit` hace
  `preventDefault()` y usa `setTimeout` para mostrar un estado de éxito
  falso — no hay `fetch`/`XMLHttpRequest` a ningún backend. Comentario
  literal en el código: `// Simulate API call`. Ver "Riesgos" abajo.

## Dependencias externas

Font Awesome vía CDN (`cdnjs.cloudflare.com`) para íconos. Sin otras
dependencias de terceros.

## Riesgos / gaps conocidos (verificados, no corregidos en esta migración)

- **El formulario de contacto no envía datos a ningún lado.** Cualquier
  lead que complete el formulario cree que se envió, pero no queda
  registrado en ningún sistema. Es el hueco más importante para un
  "MVP operable" real (ver `ROADMAP.md`).
- **Tres imágenes referenciadas no existen en el repo**:
  `happy_patient_smile_1772417255516.png`,
  `friendly_dentist_team_1772417304402.png`,
  `dental_clinic_interior_1772417241656.png` (verificado: no están en el
  directorio). Se muestran rotas en el navegador. No se generan
  imágenes placeholder en esta migración — requiere asset real del
  negocio.
- Enlaces de footer (`Privacidad`, `Términos`, `Cookies`, redes sociales)
  son `href="#"` (placeholders sin destino real).
- Teléfono/dirección/email en el HTML (`+123 456 789`,
  `Av. Principal 123, Ciudad Dental`, `hola@saviadental.com`) son
  genéricos de plantilla, no verificados como datos reales del negocio.

## Envío del formulario (punto 16)

Tres problemas observados usando el sitio en pruebas reales. Los tres
afectaban al uso correcto del formulario, así que se corrigieron antes de
cerrar el MVP en vez de diferirse.

### 1. El guard de doble envío estaba invertido

El código anterior ponía `disabled = true` **antes** de comprobar
`dataset.submitting` y, al detectar un segundo submit, **rehabilitaba el
botón** y restauraba el texto con la request todavía en vuelo. Es decir:
el mecanismo pensado para impedir el doble envío lo facilitaba.

Ahora el estado vive en una variable explícita, `enviando`, dentro del
closure del handler. `disabled`, `aria-busy` y `aria-disabled` son su
**reflejo** en el DOM, no el estado en sí. El guard sale sin tocar nada:

```js
if (enviando) {
    return;
}
```

Cubre el click, el Enter y cualquier submit programático, porque los tres
producen el mismo evento `submit`. Hay una segunda barrera en el `click`
del botón, por si algún navegador dejara pasar un click sobre un botón ya
deshabilitado.

### 2. No había feedback durante la espera

El envío tarda varios segundos: INSERT en Supabase, correo a la clínica,
`UPDATE` del flag, correo al paciente, `UPDATE` final. El único feedback
era reescribir el `textContent` del botón, así que la página parecía
trabada.

Ahora, al primer submit válido y de forma inmediata:

- el botón se deshabilita y expone `aria-busy="true"` y
  `aria-disabled="true"`;
- la etiqueta pasa a **"Enviando solicitud..."**;
- aparece un spinner (`.form-submit__spinner`), decorativo y marcado con
  `aria-hidden`, porque el estado ya se anuncia por `aria-busy`.

El spinner respeta `prefers-reduced-motion`: sigue indicando trabajo en
curso, sin girar.

### 3. La confirmación pasaba desapercibida

El mensaje de éxito también se escribía dentro del botón. Ahora hay un
diálogo (`#modalResultado`) con `role="dialog"`, `aria-modal="true"` y
`aria-labelledby`. El foco entra al botón de cierre, `Escape` lo cierra,
el `Tab` queda atrapado dentro, y al cerrarse el foco vuelve a donde
estaba. No redirige.

### 4. El diálogo se veía al entrar al sitio

**Este fue un defecto que llegó a Production.** El atributo `hidden`
estaba puesto en el HTML y `modal.hidden` era `true`, pero el diálogo se
mostraba igual al cargar la página, sin haber enviado nada.

La causa es de cascada, no de JavaScript:

```
[hidden] { display: none }   <- hoja del NAVEGADOR (user agent)
.modal   { display: flex }   <- hoja del SITIO (autor)
```

**Cualquier regla de autor le gana a la del agente de usuario**, sin
importar la especificidad. El `display: flex` anulaba el `hidden`.

La corrección es la red de seguridad idiomática, en `style.css`:

```css
[hidden] {
    display: none !important;
}
```

Protege a cualquier elemento futuro que use `hidden`, no solo al diálogo.

**Los tests de jsdom no podían verlo**: con el mismo HTML y el mismo CSS,
jsdom devuelve `display: none`, porque su cascada no modela esa
precedencia. Los tests comprobaban `modal.hidden === true` —que era
cierto— mientras el navegador lo mostraba. El guard vive por eso en
`tests/test_dialogo_resultado.py`, sobre el CSS, y la comprobación final
se hizo en un navegador real.

### Tres resultados terminales, un solo diálogo

Un `201` significa "el lead quedó registrado", **no** que las dos
notificaciones hayan salido. El backend lo informa en
`comunicacion_completa`, y el frontend lo traduce a tres mensajes:

| Resultado | Título | Formulario | Invita a reintentar |
|---|---|---|---|
| Éxito completo | Solicitud enviada | se limpia | no |
| Éxito parcial | Solicitud registrada | se limpia | **no**, dice explícitamente que no hace falta |
| Fallo de registro | No pudimos registrar tu solicitud | **se conserva** | sí |

La diferencia crítica está en el éxito parcial: **el lead ya existe**, así
que invitar a reenviar generaría un duplicado. Hay tests que lo prohíben
en el HTML y en el comportamiento.

Ante la duda se elige lo conservador: un `201` sin el campo, o con el
cuerpo ilegible, se trata como **parcial**. El lead está registrado
igual, y el mensaje que no invita a reenviar es el seguro.

Los textos viven en el HTML, en tres `.modal__variante` que arrancan
`hidden`; el script solo decide cuál se muestra y ajusta
`aria-labelledby` al título de esa variante. Una sola infraestructura de
diálogo para los tres casos: tres modales serían tres implementaciones de
foco, `Escape` y cierre para mantener en paralelo.

**Ningún mensaje afirma que se haya enviado un correo.** El frontend no
puede saberlo: la respuesta dice si el envío salió, y eso no es lo mismo
que haber llegado o haber sido leído.

### El mensaje de error ya no vive en el botón

Se eliminó la caja `#formError`. Los tres resultados terminales pasan por
el mismo diálogo, que además captura el foco y se anuncia como tal.

### Bloqueo de scroll del fondo

`body.con-modal { overflow: hidden }` mientras el diálogo está abierto.
**No es una máscara de desborde**: va sobre `body.con-modal` —no sobre
`body` a secas—, solo existe mientras el modal está visible y `script.js`
la quita al cerrarlo. El guard `test_el_desborde_no_se_tapa_con_overflow_hidden`
sigue prohibiendo la máscara global y no se dispara con esta regla, lo
que está verificado en las dos direcciones.

### Cobertura

`script.test.js`, 23 casos sobre DOM real (jsdom) construido con el
`index.html` del repositorio. Es la primera cobertura automática que tiene
`script.js`. Ver `docs/tecnica/arquitectura.md` para la decisión de sumar
`jsdom` como dependencia de desarrollo.
