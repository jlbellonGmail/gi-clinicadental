# Identidad, privacidad y parametrización white-label

Release **v1.0.1**. Cuatro problemas de la misma familia: el sitio estaba
atado a un cliente concreto y a una marca mal escrita.

## 1. La marca

La marca pública correcta es **Sonría más**. El sitio decía *Sonríe más*
en más de cuarenta lugares: `title`, `description`, Open Graph, Twitter,
header, footer, `alt` y los **dos correos transaccionales**.

Corregida en toda la superficie pública. **No** se renombraron los
identificadores técnicos estables: `sonriamas-contactos@nextgia.io`, las
URLs de redes (`facebook.com/sonrimas`) y los slugs internos siguen
igual. Cambiarlos por estética rompería enlaces y buzones reales.

El guard vive en `tests/test_marca_publica.py` y mira **superficie
pública real**: las tres páginas servidas, la configuración y
`api/_lib/mailer.js`. No mira `docs/` ni `runs/`, donde las variantes
incorrectas se nombran a propósito al explicar el defecto; un guard que
falla con la prosa que lo documenta no comprueba nada.

En los correos el guard es **el inverso**: exige que la marca **no**
aparezca literal y que salga de `api/_lib/clinic.js`. `mailer.js` es
código, no una plantilla generada: si la marca estuviera escrita ahí,
instalar el proyecto para otra clínica dejaría los correos firmados con
el nombre de la anterior.

## 2. La decisión de arquitectura: generador con salida commiteada

El sitio es estático, sin build, y Vercel lo sirve tal cual. Esa
propiedad se conserva.

```
config/clinic.json ─┐
                    ├─> scripts/build-site.js ─> index.html
templates/*.html   ─┘                            politica-de-privacidad.html
                                                 404.html
```

- **El HTML generado se commitea** y es lo que Vercel sirve.
- **No se agrega un paso de build al deploy.** Si el generador
  desapareciera mañana, el sitio seguiría funcionando exactamente igual;
  lo que se perdería es la capacidad de reconfigurarlo sin tocar HTML.

La contrapartida de commitear la salida es que puede quedar
desincronizada de la configuración. Eso lo cubre un test que regenera en
memoria y compara contra el archivo commiteado
(`build-site.test.js`). Sin ese test, editar la configuración podría
dejar de tener efecto sin que nadie se entere.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Hidratación en el cliente** (`fetch` de la config y rellenar el DOM) | Deja `title`, `description` y Open Graph fuera del alcance —los crawlers no ejecutan ese JS— y muestra la página vacía si el JS falla |
| **Build en Vercel** | Agrega una dependencia de build al deploy, que `AGENTS.md` obliga a justificar, para resolver algo que no la necesita |

### El renderizador

Deliberadamente mínimo: `{{ ruta }}` escapado, `{{{ ruta }}}` crudo, y
nada más. Sin condicionales ni bucles en las plantillas: los bloques
repetidos —servicios, redes, secciones legales— los arma el generador en
JavaScript, donde son testeables.

**Un marcador sin resolver es un error, no una cadena vacía.** Publicar
un `<title>` vacío o un `href` roto en silencio es exactamente lo que
este generador tiene que impedir.

### Saltos de línea

El generador normaliza a `\n` para comparar y escribir. En Windows
`core.autocrlf` deja CRLF en el árbol de trabajo mientras el generador
produce LF: sin normalizar, la verificación de drift diría que *todo* el
archivo cambió en Windows y nada en Linux. Sería un test que falla según
el sistema operativo, no según el contenido.

## 3. La política de privacidad, en dos capas

**Capa 1 — aviso breve**, junto al botón de envío, no en el pie: el
visitante tiene que verlo en el momento en que decide enviar sus datos.

**Capa 2 — política completa**, en su propia página:
**`/politica-de-privacidad`**. Sigue siendo la dirección canónica y sigue
enlazada desde el footer.

Desde el formulario, ese enlace **abre un diálogo** en vez de navegar.

### Cómo se garantiza que no se pierden los datos

No guardando y restaurando los valores: **no navegando**. Se cancela la
navegación con `preventDefault()` y el formulario nunca se desmonta, así
que sus valores siguen ahí por construcción.

Es una diferencia que importa: la otra forma de resolverlo habría sido
persistir nombre, correo y mensaje en `localStorage`, y el requisito lo
prohíbe explícitamente. **`script.js` no usa almacenamiento del
navegador**, y hay un test que lo comprueba sobre el código —con
verificación en negativo del propio stripper de comentarios, porque la
primera versión del guard se disparaba con el comentario que explica que
no hay que agregarlo—.

El `href` real se conserva en el HTML: sin JavaScript el enlace lleva a
la página completa. Con Ctrl/Cmd/Shift o botón del medio tampoco se
intercepta: si alguien pide otra pestaña a propósito, se respeta.

### Un solo comportamiento para los dos diálogos

`crearDialogo()` centraliza `hidden` como única fuente de verdad, el
retorno del foco al control exacto que lo abrió, la preservación del
scroll, `Escape`, los disparadores de cierre y la trampa de foco.

Se extrajo en vez de duplicarlo porque dos trampas de foco separadas se
van diferenciando con el tiempo. La refactorización se hizo con las 272
pruebas del diálogo de resultado ya en verde, y siguieron en verde: eso
es lo que la hizo segura.

En el diálogo de la política, el contenido legal scrollea **dentro del
cuerpo**, con encabezado y pie fijos. Si scrolleara la caja entera, el
botón de cerrar se iría de pantalla justo cuando hace falta.

### Una sola fuente para el texto legal

La política se renderiza **una vez** y la misma cadena se inserta en la
página y en el diálogo. No pueden divergir porque no hay dos fuentes, y
hay un test que compara sección por sección.

## 4. Demo y cliente real

El texto legal está partido en dos:

- **plantilla legal estable** — `templates/partials/politica-*.html`;
- **datos variables del cliente** — `config/clinic.json`.

`legal.demoMode`:

- `true` → aviso de sitio demostrativo, y sección de responsable que
  declara que **no hay entidad responsable**, precisamente para no
  afirmar algo que no existe;
- `false` → datos reales del responsable desde configuración.

Con `demoMode: false`, `legal.controller.legalName` y `.address` pasan a
ser **obligatorios**: una política que declara tener un responsable y no
lo nombra es peor que una que se declara demostración. Los datos
opcionales —nombre comercial, identificación fiscal— se omiten sin dejar
la frase colgando.

Ningún texto afirma cumplimiento normativo absoluto, y hay un test que lo
vigila.

## 5. La configuración

`config/clinic.json` cubre `brand`, `contact`, `business`, `services` y
`legal`.

**Es público por diseño**: se sirve como archivo estático, igual que el
HTML que produce. Por eso no puede recibir credenciales, y un test
recorre sus claves y valores buscando nombres tipo `password`/`token` y
valores con forma de JWT o clave larga. Ese test tiene **verificación en
negativo**: sin ella no se sabría si pasa porque no hay secretos o porque
no mira nada.

Los secretos siguen exclusivamente en variables de entorno de Vercel
(`.env.example`).

### La validación

`scripts/lib/clinic-config.js`, sin dependencias nuevas: el stack no
tiene validador de esquemas y no hace falta agregar uno para veinte
campos.

Falla **acumulando todos los problemas**, no el primero, y cada mensaje
nombra el campo: un error que dice "configuración inválida" y nada más
obliga a adivinar. Algunos mensajes explican además por qué importa —el
`alt` faltante menciona al lector de pantalla; la versión de la política
menciona que es el valor que el formulario envía como
`version_politica_privacidad`—.

`business.copyrightYear` es un dato de configuración y no `new Date()` a
propósito: el HTML generado se commitea, y derivarlo del reloj haría que
el build dejara de ser reproducible cada 1 de enero.

## 6. La versión de la política

Antes era una constante en `script.js` que había que mover a mano junto
con el texto publicado. Ahora sale de `config/clinic.json`, el generador
la escribe en un `<meta>` y `script.js` la lee: **la versión enviada y la
versión publicada son el mismo dato**, no dos copias.

El formato lo valida la configuración con el mismo patrón que usa
`api/leads.js`. El valor de reserva —`v0-0000-00-00`— cubre un HTML sin
ese `meta`: enviar una versión equivocada sería peor que enviar una
declaradamente desconocida.

## 7. La URL de la política

`politica-privacidad.html` → **`politica-de-privacidad.html`**.

`vercel.json` declara un `rewrite` explícito de `/politica-de-privacidad`
al archivo. Vercel resuelve solo las rutas sin extensión, pero depender
de ese comportamiento por defecto para una dirección que la propia
política declara como canónica es frágil.

Las dos direcciones anteriores —`/politica-privacidad` y
`/politica-privacidad.html`— **redirigen con 308**. Estaban publicadas y
enlazadas desde consentimientos ya registrados: no pueden quedar en 404.

## 8. El título canónico de la etapa

`Get-FeatureInfo` derivaba el título capitalizando el slug:
`identidad-privacidad-white-label` daba
**Identidad Privacidad White Label**. Los dos índices dicen
**Identidad, privacidad y white-label**, que es el título correcto, y
`Assert-FeatureContract` compara uno contra otro.

El contrato pasaba, entonces, **solo si quien corría el script se
acordaba de pasar `-Title` con el texto exacto**. Si se olvidaba, fallaba
contra índices bien escritos, y el mensaje de error invitaba a
"arreglar" el índice degradándolo al título derivado.

`ready-for-pr.ps1` lo agravaba. Sacaba el título de documentación
recortándole el prefijo al de la PR:

```powershell
$contractTitle = $Title -replace "^Feature [0-9]{2}-", ""
```

Ese patrón solo contempla hitos `NN-`. La v1.0.1 amplió el contrato de
slugs a `vX.Y.Z-slug` **y no amplió este recorte**, así que para una
release de mantenimiento no recortaba nada: el título de documentación
quedaba en `Feature v1.0.1-identidad-privacidad-white-label` y el
contrato no podía pasar por ninguna vía.

**La corrección.** `scripts/feature-titles.json` declara el título
canónico una vez:

```json
{
  "titulos": {
    "v1.0.1-identidad-privacidad-white-label": "Identidad, privacidad y white-label"
  }
}
```

Lo lee `Get-CanonicalTitle`, y a través de `Get-FeatureInfo` lo heredan
`Assert-FeatureContract`, `ready-for-pr.ps1` y `update-doc-indexes.ps1`.
El orden de resolución va de más explícito a menos: `-Title` explícito →
registro → derivado del slug. Una etapa sin entrada se comporta como
antes.

Y las dos cosas que se confundían quedaron separadas: **`-Title` es el
título de la PR**, **`-DocTitle` el de la documentación**. El default
`"Feature <slug>"` se calcula después de resolver el de documentación,
para que no se cuele.

Los índices no se tocaron. Era el título derivado el que estaba peor.

## 9. Las páginas fuera de `nav` de MkDocs

`mkdocs build --strict` termina **en verde, con cero warnings**. Lo que
emite es un mensaje de nivel `INFO` que lista las 38 páginas de
`docs/tecnica/` y `docs/usuario/` como ausentes de `nav`. `--strict`
convierte *warnings* en errores; un `INFO` no lo es.

Están fuera de `nav` por diseño: `nav` tiene tres entradas y **son los
dos índices los que navegan**. `update-doc-indexes.ps1` mantiene sus
enlaces y `Assert-FeatureContract` exige el enlace exacto de cada etapa
en ambos. Duplicar las 38 páginas dentro de `nav` obligaría a mantener la
misma lista en dos lugares que pueden separarse en silencio.

Tampoco se declaró `not_in_nav` para silenciar el `INFO`: ese glob
taparía también las páginas que **de verdad** no son alcanzables, que es
lo único que ese mensaje sirve para detectar.

Lo que sí se hizo fue convertir el `INFO` pasivo en un guard activo.
`tests/test_navegacion_de_documentacion.py` comprueba que cada página
esté enlazada desde el índice de su área — la discoverability real, que
es lo que `nav` daría.

**Reparto exacto de las 38 páginas:**

| | páginas |
|---|---|
| Enlazadas desde su índice, alcanzables | 36 |
| Sin enlace en ningún lado | 2 |

Las dos inalcanzables son `docs/tecnica/landing.md` y
`docs/usuario/landing.md`, **preexistentes y ajenas a esta release**:
documentan la landing original, anterior a este circuito, y nunca
entraron en la zona `FEATURE_LINKS` porque no vinieron de una etapa que
corriera `update-doc-indexes.ps1`.

No se corrigen acá: cerrarlas exige tocar la región gestionada de los dos
índices por una feature que no es esta. Quedan declaradas con nombre y
motivo en `HUERFANAS_HEREDADAS`, y un segundo test avisa el día que
alguien las enlace, para que la excepción no se arrastre vacía.

Las dos páginas que **sí** introdujo la v1.0.1 están enlazadas en ambos
índices, y hay un test que lo comprueba por separado: el `INFO` de MkDocs
no distingue entre "fuera de `nav`" e "inalcanzable", y esa diferencia es
justamente la que importa.

## Correcciones incidentales

Tres defectos preexistentes que aparecieron al reconstruir las páginas y
que habría sido peor dejar:

| Defecto | Corrección |
|---|---|
| El enlace "Saltar al contenido principal" apuntaba a `#main` y **ningún elemento tenía ese `id`** | `<main id="main">` en las tres páginas |
| `404.html` usaba iconos de Font Awesome y **no cargaba la hoja**: se veían como cuadros vacíos | Se agregó el `<link>` |
| El footer tenía enlaces a "Términos" y "Cookies" con `href="#"`, y el `404.html` tenía todo su footer apuntando a `#` | Se quitaron los que no existen; el resto apunta a destinos reales |

## Límites declarados

- **Los guards del diálogo corren en jsdom**, que no pinta. Que la caja
  entre en 320 px y tenga scroll interno lo vigila el CSS en
  `tests/test_dialogo_resultado.py`, no los tests de JavaScript. Es la
  lección del punto 16: un guard que corre en el motor equivocado no es
  un guard.
- **El rewrite y los redirects de Vercel no están verificados en vivo**
  desde esta sesión: se comprueban en el deployment Preview de la PR.
