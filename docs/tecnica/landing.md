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
