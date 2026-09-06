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
diálogo (`#modalExito`) con `role="dialog"`, `aria-modal="true"` y
`aria-labelledby`. Se abre **solo tras un 201 confirmado**, el foco entra
al botón de cierre, `Escape` lo cierra, y al cerrarse el foco vuelve a
donde estaba. No redirige: el usuario se queda en la misma página.

**El texto no afirma que se haya enviado ningún correo.** El frontend no
puede saberlo: la respuesta del endpoint es `201 { id }`, y los dos
envíos SMTP ocurren después y pueden fallar sin afectar ese 201. Decir
"te enviamos un correo" sería afirmar algo que el sistema no confirmó.
Hay un test que lo impide.

### Éxito y error

| | Éxito (201) | Error |
|---|---|---|
| Formulario | se resetea | **se conserva todo** lo escrito |
| Botón | vuelve a estado normal | vuelve a habilitarse, permite reintentar |
| Mensaje | diálogo de confirmación | `#formError` con `role="alert"` |

El reset ocurre **solo** con `status === 201`. Los dos caminos de éxito
del endpoint —incluido el de idempotencia, que devuelve el lead ya
existente— responden 201, así que la condición no deja fuera ningún caso
legítimo. Cualquier otro status se trata como fallo y no descarta lo que
la persona escribió.

El mensaje de error nunca muestra detalle técnico: ni `request_id`, ni
códigos internos, ni errores de SMTP o Supabase. Hay un test que verifica
que ninguna de esas cadenas llegue al texto visible.

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
