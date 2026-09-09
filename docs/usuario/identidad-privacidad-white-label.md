# Cómo configurar una nueva clínica sin programar

Todo el contenido visible del sitio vive en **un solo archivo**:
`config/clinic.json`. Para instalar el sitio para otra clínica no hace
falta tocar HTML, CSS ni JavaScript.

## Los tres pasos

1. **Editar `config/clinic.json`.**
2. **Dejar las imágenes** en `static/images/` con los nombres que
   declaraste en ese archivo.
3. **Regenerar el sitio:**

   ```bash
   npm run build:site
   ```

   Reescribe `index.html`, `politica-de-privacidad.html` y `404.html`.
   Después, commitear esos archivos junto con la configuración.

Si te olvidás del paso 3, la suite avisa: hay un test que compara el HTML
publicado con la configuración y falla si se separaron.

Para comprobar sin escribir nada:

```bash
npm run check:site
```

## Qué se puede cambiar

### Marca — `brand`

| Campo | Qué es |
|---|---|
| `name` | El nombre visible. Aparece en el título, el header, el footer, los metadatos y **los dos correos** |
| `tagline` | La frase que acompaña al nombre en el título de la pestaña |
| `description` | Descripción para buscadores y redes (Open Graph) |
| `shortDescription` | Versión corta, para Twitter |
| `footerText` | La frase del pie de página |
| `logoIcon` | El ícono del logo, un nombre de [Font Awesome](https://fontawesome.com/icons) (ej. `fa-tooth`) |
| `favicon` | El ícono de la pestaña del navegador |
| `appleTouchIcon` | El ícono al agregar el sitio a la pantalla de inicio en iOS |

!!! warning "`name`, `description` y `shortDescription` son campos distintos"
    Cambiar `name` **no** cambia los otros dos. Si la descripción menciona
    a la clínica, hay que editarla también.

### Contacto — `contact`

Teléfono, WhatsApp, correo y dirección. Cada uno tiene dos partes:

- `display`: lo que **se ve** (ej. `+54 9 11 4123-4567`);
- `href`: **a dónde lleva** al tocarlo (ej. `tel:+5491141234567`).

Se separan porque el formato legible y el formato que entiende el
teléfono no son el mismo. La dirección tiene `display` y `mapsUrl`.

### Negocio — `business`

| Campo | Qué es |
|---|---|
| `siteUrl` | La dirección pública del sitio, **sin barra final** |
| `locale` | El idioma y país para redes sociales (ej. `es_AR`) |
| `copyrightYear` | El año del aviso del pie |
| `openingHours` | Los horarios, como texto libre |
| `socialNetworks` | Una lista: `name`, `icon` (Font Awesome) y `url` |

Para quitar una red social, se borra su entrada de la lista. Para no
mostrar ninguna, se deja la lista vacía: `[]`.

### Servicios — `services`

Una lista. Cada servicio tiene:

| Campo | Qué es |
|---|---|
| `id` | Identificador interno. **No se traduce y no debería cambiar**: es el valor que queda guardado en cada solicitud |
| `name` | El título de la tarjeta |
| `formName` | El texto en el desplegable del formulario, si querés que sea distinto |
| `description` | El párrafo de la tarjeta |
| `icon` | El ícono, de Font Awesome |
| `order` | El orden de aparición. Manda este número, no la posición en el archivo |
| `visible` | Si aparece en la sección de servicios |
| `inForm` | Si aparece en el desplegable del formulario |

`visible` e `inForm` son independientes a propósito: un servicio puede
mostrarse en la página sin ser una opción del formulario, y al revés.

La opción **"Otros"** del formulario existe siempre, no se configura: es
la salida de escape para quien no encuentra su caso.

### Legal — `legal`

| Campo | Qué es |
|---|---|
| `demoMode` | `true` para un sitio de demostración, `false` para una clínica real |
| `privacyPolicyVersion` | La versión de la política, con la forma `vN-AAAA-MM-DD` |
| `updatedAt` | La fecha de última actualización, `AAAA-MM-DD` |
| `privacyContactEmail` | El buzón al que se escribe para acceder, corregir o eliminar datos |
| `controller` | Los datos del responsable: `legalName`, `tradeName`, `taxId`, `address` |
| `purpose` | Para qué se usan los datos. Completa la frase "Usaremos tus datos únicamente para…" |
| `retention` | Cuánto se conservan. Completa "Los registros se conservan…" |
| `providers` | Los proveedores que acceden a los datos: `name` y `role` |

!!! danger "Cada vez que cambia el texto de la política, subí `privacyPolicyVersion`"
    Ese valor queda guardado junto al consentimiento de cada persona. Si
    no cambia, no hay forma de saber qué texto aceptó.

#### `demoMode`

- **`true`** — el sitio se presenta como demostración técnica: aparece el
  aviso fuerte en el formulario y la política dice que no hay una clínica
  ni una empresa responsable.
- **`false`** — desaparecen esos avisos y la política declara al
  responsable real. `controller.legalName` y `controller.address` pasan a
  ser **obligatorios**: si faltan, `npm run build:site` falla en vez de
  publicar una política que dice tener responsable sin nombrarlo.

## Las imágenes

### Las que están hoy

Las cuatro son fotografía generada con IA, integradas en la v1.0.1.
Comparten una misma estética -luz natural, blancos y acentos verde
azulado- para que se lean como una sola sesión.

| Clave | Archivo | Proporción | Dimensiones | Peso | Dónde aparece |
|---|---|---|---|---|---|
| `hero` | `static/images/paciente-sonrisa.webp` | 4:3 | 1448 × 1086 | 75 KB | Portada, arriba a la derecha |
| `team` | `static/images/equipo-dental.webp` | 4:3 | 1448 × 1086 | 92 KB | Sección "Tecnología de Punta, Trato Humano" |
| `interior` | `static/images/interior-clinica.webp` | 4:3 | 1448 × 1086 | 92 KB | Junto a los datos de contacto |
| `social` | `static/images/og-social.webp` | **1.91:1** | 1731 × 909 | 63 KB | La miniatura al compartir el link |

Si las reemplazás: formato **WebP**, calidad 80–85, por debajo de
**250 KB** las tres de 4:3 y de **300 KB** la social. Después hay que
actualizar `width` y `height` en la configuración con las dimensiones
reales del archivo nuevo.

La imagen social **no es un recorte del hero**: se compone para 1.91:1, con
el sujeto en un tercio y nada importante en los bordes, porque cada
plataforma recorta distinto y algunas muestran un cuadrado central.

## El favicon y el ícono de la app

Son los dos íconos de marca: el de la pestaña del navegador y el que
queda al guardar el sitio en la pantalla de inicio de un teléfono.

| Clave | Archivo | Formato | Tamaños | Dónde se ve |
|---|---|---|---|---|
| `brand.favicon` | `favicon.ico` | ICO multi-tamaño | **16, 32 y 48 px** | Pestaña, favoritos, historial |
| `brand.appleTouchIcon` | `apple-touch-icon.png` | PNG cuadrado, **sin transparencia** | **180 × 180 px** | Pantalla de inicio en iOS |

El `.ico` lleva los tres tamaños dentro de un solo archivo: con uno solo,
el navegador escala y se ve borroso. El PNG de iOS va sin transparencia
porque el sistema compone sobre negro y las esquinas quedarían con un
halo oscuro.

### Dos formas de cambiarlos

**Si ya tenés los archivos**: dejalos donde quieras dentro del proyecto y
apuntá `brand.favicon` y `brand.appleTouchIcon` a esas rutas. El tipo del
`<link>` se deduce solo de la extensión, así que también sirve un `.png`
o un `.svg` como favicon.

**Si querés el mismo isotipo con otros colores**: cambiá
`brand.iconColors` y regeneralos:

```bash
python scripts/build-branding-icons.py
```

```json
"iconColors": {
  "background": "#076e6e",
  "foreground": "#ffffff"
}
```

Escribe `favicon.ico`, `apple-touch-icon.png` y el favicon del sitio de
documentación. Con `--preview` deja además una tira con el ícono a los
cuatro tamaños, para revisarlo sin abrir el `.ico`.

!!! warning "El ícono no puede ser un glifo de Font Awesome"
    El logo del encabezado sí lo es, y se resuelve en el navegador. Un
    favicon no: el navegador lo pide **antes** de ejecutar nada, así que
    tiene que ser un archivo de verdad. Por eso hay un script que lo
    dibuja en vez de una referencia al ícono del logo.

Ninguno de los dos caminos toca HTML, CSS ni JavaScript.

### Reglas que no se negocian

- **Ningún texto dentro de la imagen**, y mucho menos el nombre de la
  clínica. Un nombre rasterizado dentro de un `.webp` es invisible para
  cualquier verificación automática y no se puede corregir sin regenerar
  la imagen. Ya pasó una vez: la marca de la plantilla original llegó a
  estar publicada así.
- **Nada que dependa del nombre de la clínica**: ni carteles, ni logos,
  ni uniformes con marca. Las mismas fotos tienen que servir para otra
  instalación.
- **Cada imagen necesita su `alt`**, y describe lo que se ve, no lo que
  se vende.

### Prompts para generar las fotografías

Estilo común para las tres, de modo que se vean como una misma sesión:

> Fotografía profesional de clínica odontológica moderna. Luz natural
> suave y difusa, tonos claros con acentos verde azulado (teal).
> Profundidad de campo media, sensación documental y cálida, sin aspecto
> de banco de imágenes. Sin texto, sin logos, sin carteles, sin marcas
> visibles.

**`hero` — paciente**

> Retrato en plano medio de una persona adulta sonriendo con naturalidad,
> mirando ligeramente fuera de cámara, sentada en un sillón odontológico
> moderno y limpio. Expresión de alivio y confianza, no de posado
> comercial. Fondo desenfocado con equipamiento clínico apenas sugerido.
> Piel y dientes con textura real, sin retoque excesivo. 4:3 horizontal.

**`team` — equipo**

> Dos o tres profesionales de la odontología con ambo clínico trabajando
> juntos frente a una pantalla con una radiografía o un escaneo dental 3D.
> Actitud concentrada y colaborativa, gesto de conversación profesional.
> Ambos sin identificación visible en la ropa. Consultorio moderno con
> superficies claras. 4:3 horizontal.

**`interior` — instalaciones**

> Interior de un consultorio odontológico moderno y vacío, visto en
> perspectiva de tres cuartos: sillón, lámpara, monitor y muebles de
> líneas limpias. Sensación de orden y calma clínica, luz de ventana
> lateral. Sin personas, sin carteles, sin marcas. 4:3 horizontal.

### Cómo se cambian, una vez que existen los archivos

1. Copiarlos a `static/images/`.
2. En `config/clinic.json`, ajustar `src`, `alt`, `width` y `height` de
   cada entrada de `brand.images`.
3. `npm run build:site`.

No hay que tocar HTML.

## Qué es un secreto y qué no

**`config/clinic.json` es público.** Se sirve como un archivo más del
sitio, igual que el HTML. Cualquiera puede abrirlo.

!!! danger "Nunca pongas una credencial ahí"
    Ni claves de Supabase, ni contraseñas de correo, ni tokens. Hay un
    test que lo revisa, pero la regla es previa al test.

Los secretos viven **solo** en Vercel → *Settings → Environment
Variables*:

| Variable | Qué es |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | El servidor de correo saliente |
| `LEADS_NOTIFICATION_EMAIL` | El buzón interno que recibe cada solicitud |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave con permisos totales sobre la base. **Nunca** puede llegar al navegador |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Se exponen al navegador a propósito; están protegidas por las reglas de la base, no por ser secretas |
| `SITE_URL`, `ALLOWED_ORIGINS` | Configuración por entorno |

`.env.example` documenta **los nombres**, nunca los valores.

### Qué NO se commitea

- `.env`, `.env.local` y cualquier variante con valores reales.
- Cualquier archivo con una clave, contraseña o token.
- `node_modules/`.

## A dónde va esto después

Hoy la configuración es un archivo en el repositorio, y cambiarla
requiere regenerar y commitear. Es lo correcto para una instalación: es
versionado, revisable y no necesita infraestructura.

El paso siguiente natural —**no implementado, y fuera del alcance de esta
versión**— es mover ese contenido a Supabase o a un CMS con un panel de
administración, para que se edite sin pasar por Git. La estructura de
`config/clinic.json` está pensada para ser ese contrato: los mismos
campos, cargados desde otro lado.

Eso pertenece a la v2.0.0 y posteriores, junto con la agenda, los
profesionales y el panel administrativo.

## La política de privacidad desde el formulario

Para quien completa el formulario, tocar **"Política de privacidad"**
abre la política **sin salir del formulario**: se lee, se cierra con la
**X**, con `Escape` o con **Volver al formulario**, y todo lo que estaba
escrito sigue ahí.

La política completa también sigue teniendo su propia dirección,
**`/politica-de-privacidad`**, enlazada desde el pie y accesible
directamente. La dirección anterior redirige sola.
