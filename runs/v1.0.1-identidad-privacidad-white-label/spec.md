# Spec — v1.0.1-identidad-privacidad-white-label (release v1.0.1)

**Etapa**: release de mantenimiento v1.0.1, previa a v2.0.0.
**Base**: `develop` en `b00520b`. La v1.0.0 esta cerrada y no se reabre.

## Problema

Cuatro problemas distintos, todos de la misma familia: **el sitio esta
atado a un cliente concreto y a una marca mal escrita**.

1. **La marca publica esta mal en todas partes.** La correcta es
   `Sonría más`; el sitio dice `Sonríe más` en 40+ lugares, incluidos
   `<title>`, Open Graph, Twitter, `alt`, footer, y los dos correos
   transaccionales.
2. **Las imagenes son marcadores de posicion generados con Pillow**
   (rectangulos y elipses de color), no fotografia.
3. **El enlace a la politica de privacidad navega a otra pagina.** Con el
   formulario a medio completar, eso abre una pestaña nueva y saca al
   visitante del formulario.
4. **Todo el contenido del cliente esta hardcodeado en el HTML**: marca,
   telefono, WhatsApp, email, direccion, horarios, redes, seis servicios y
   los datos variables de la politica. Instalar el sitio para otra clinica
   hoy exige editar HTML.

## Decision de arquitectura: generador + salida commiteada

El sitio es estatico, sin build, y Vercel lo sirve tal cual. Se conserva
esa propiedad.

```
config/clinic.json  ->  scripts/build-site.mjs  ->  index.html
templates/*.html                                   politica-de-privacidad.html
                                                   404.html
```

- El HTML renderizado **se commitea** y es lo que Vercel sirve. **No se
  agrega un paso de build al deploy**: si el generador desapareciera, el
  sitio seguiria funcionando.
- El generador es Node sin dependencias nuevas.
- Un test regenera y compara: si el HTML commiteado no coincide con
  `config/clinic.json`, la suite falla. Es lo que impide que el HTML y la
  configuracion se separen en silencio.

**Alternativas descartadas**:

- *Hidratacion en el cliente* (`fetch` de la config y rellenar el DOM):
  deja `<title>`, `description` y Open Graph fuera del alcance -los
  crawlers no ejecutan este JS-, y muestra la pagina vacia si el JS falla.
- *Build en Vercel*: agrega una dependencia de build al deploy, que
  `AGENTS.md` obliga a justificar y que no hace falta.

La decision queda registrada en `docs/tecnica/arquitectura.md`.

## Alcance

### A. Marca

`Sonría más` en toda superficie publica: HTML, header, footer,
formulario, modales, politica, correos, `title`, `description`, Open
Graph, Twitter y `alt`.

**No se renombran identificadores tecnicos**: `sonriamas-contactos@...`,
`sonriamas` en las URLs de redes y los slugs internos siguen igual. Son
estables y cambiarlos por estetica romperia enlaces reales.

### B. Imagenes

La generacion de fotografia realista no esta disponible en esta sesion.
Se entrega:

- el inventario exacto -archivo, ubicacion, aspect ratio, tamaño, prompt-
  en `docs/usuario/imagenes-del-sitio.md`;
- la integracion **lista para recibir los assets**: cada imagen sale de
  `config/clinic.json`, con `alt` propio, `width`/`height` para reservar
  espacio, y `<picture>` con AVIF/WebP/fallback.

Reemplazar una imagen = dejar el archivo y editar una linea de config. No
se toca HTML.

Las fotografias son **alcance obligatorio de la v1.0.1**: la etapa no se
da por construida ni se audita con los marcadores de posicion actuales.
La integracion puede quedar lista antes; los archivos definitivos los
entrega el humano y son la ultima pieza de la construccion.

### C. Privacidad desde el formulario

Dos capas:

- **Capa 1 — aviso breve** junto al envio, con enlace a la politica.
- **Capa 2 — politica completa**, que sigue viviendo en una pagina propia
  accesible por URL: **`/politica-de-privacidad`**.

Desde el formulario, ese enlace **abre un dialogo** en vez de navegar:

- `preventDefault()`: no navega, no recarga;
- los valores del formulario quedan intactos **por construccion**, no
  porque se guarden y restauren. **No se usa `localStorage`**;
- se preserva la posicion de scroll;
- el foco vuelve **al control exacto que abrio el dialogo**;
- trampa de foco mientras esta abierto; `Escape`; boton de cierre;
  **Volver al formulario**;
- el contenido legal scrollea **dentro** del dialogo;
- responsive, sin scroll horizontal.

La pagina independiente sigue enlazada desde el footer y sigue
funcionando con JavaScript deshabilitado: el `href` real se conserva.

### D. Politica por capas, demo y cliente real

El texto legal se parte en dos:

- **plantilla legal estable** — `templates/partials/politica-*.html`;
- **datos variables del cliente** — `config/clinic.json`.

`legal.demoMode`:

- `true` -> aviso de sitio demostrativo y seccion de responsable que
  declara que **no hay entidad responsable**;
- `false` -> datos reales del responsable tomados de configuracion.

No se afirma cumplimiento legal absoluto en ningun texto.

### E. White-label

`config/clinic.json` cubre `brand`, `contact`, `business`, `services` y
`legal`. Instalar para otra clinica = editar ese archivo, dejar las
imagenes y correr el generador.

### F. Secretos

Los secretos siguen exclusivamente en variables de entorno de Vercel. Se
verifica que ninguna `NEXT_PUBLIC_*` contenga uno, y que `clinic.json` no
contenga credenciales. `clinic.json` es **publico por diseño** -se sirve
como archivo estatico- y el guard lo trata como tal.

### G. Validacion de configuracion

`scripts/lib/clinic-config.mjs` valida campos obligatorios, tipos y
formas. Una configuracion incompleta **falla ruidosamente** en el
generador; nunca produce un sitio roto en silencio. Sin dependencias
nuevas.

## Criterios de aceptacion

1. Ninguna superficie publica dice `Sonríe más` ni otra variante; todas
   dicen `Sonría más`.
2. `/politica-de-privacidad` responde, y `/politica-privacidad` redirige.
3. Con el formulario completado, abrir y cerrar el dialogo de politica
   deja los cuatro valores intactos y devuelve el foco al enlace.
4. `Escape`, el boton de cierre y **Volver al formulario** cierran.
5. El HTML commiteado coincide **byte a byte** con lo que produce el
   generador desde `config/clinic.json`.
6. Servicios, contactos, marca y redes salen de configuracion.
7. `legal.demoMode` cambia el texto legal en ambas superficies.
8. Una configuracion invalida falla con un mensaje que nombra el campo.
9. El formulario, el dialogo de resultado, el guard de doble envio, el
   backend y los correos siguen funcionando: la suite existente pasa sin
   cambios de comportamiento.
10. `docs/tecnica/<slug>.md`, `docs/usuario/<slug>.md`, la guia de
    configuracion, `runs/17-.../decision.md` y los enlaces exactos en
    ambos indices.

## Fuera de alcance

Agenda, calendario, profesionales, chatbot, agente de voz, CMS, panel
administrativo, dashboard y multi-tenant. Todo eso es v2.0.0.

No se crea tag ni release en esta etapa.
