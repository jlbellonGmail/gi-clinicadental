# Decisiones — v1.0.1-identidad-privacidad-white-label (v1.0.1)

Release de mantenimiento sobre `develop` en `b00520b`. La v1.0.0 quedó
cerrada y no se reabrió: nada de esta etapa toca el tag ni `main`.

## La decisión central: generar el HTML, no hidratarlo

El pedido era instalar el mismo código para otra clínica sin modificar
código funcional. El sitio es estático, sin build, y Vercel lo sirve tal
cual: esa propiedad valía la pena conservarla.

Se eligió **generador con salida commiteada**. `config/clinic.json` +
`templates/` → `scripts/build-site.js` → el HTML de la raíz, que se
commitea y es lo que se sirve. **No hay build en el deploy.**

**Por qué no hidratación en el cliente**, que era la alternativa obvia
para un sitio sin build: `title`, `description` y Open Graph quedarían
fuera —los crawlers no ejecutan ese JavaScript— y la página se vería
vacía si el JS falla. Justamente los metadatos son parte del pedido de
marca.

**Por qué no un build en Vercel**: `AGENTS.md` obliga a justificar
cualquier dependencia de build, y acá no hace falta ninguna.

El costo de commitear la salida es que puede separarse de la
configuración. Se paga con un test que regenera y compara. Sin ese test,
editar `clinic.json` podría dejar de tener efecto sin que nadie se
entere, que es peor que no tener configuración.

## Lo que se decidió no renombrar

La marca pasa a `Sonría más` en toda la superficie pública. **Los
identificadores técnicos no se tocan**: `sonriamas-contactos@nextgia.io`,
`facebook.com/sonrimas` y los slugs internos siguen igual. Son buzones y
URLs reales; cambiarlos por estética rompe cosas que funcionan.

Eso obligó a que el guard de marca distinga entre **variantes visibles**
—escritas con espacio o con `+`— e identificadores pegados. Un guard que
prohibiera la subcadena `sonrie` habría fallado con el propio correo de
contacto.

## El requisito que se leyó al revés, y estuvo bien

"Abrir la política no puede perder los datos del formulario" tiene dos
lecturas: guardar y restaurar, o no navegar.

Se eligió **no navegar**: `preventDefault()`, el formulario nunca se
desmonta, y los valores siguen ahí **por construcción**. La otra lectura
habría significado persistir nombre, correo y mensaje en `localStorage`,
que el pedido prohíbe explícitamente.

Consecuencia práctica: el test central no comprueba que los datos "se
restauren", sino que **nunca se pierden**, y hay un guard aparte que
verifica que `script.js` no use almacenamiento del navegador.

Se conserva el `href` real del enlace: sin JavaScript lleva a la página
completa, y con Ctrl/Cmd/Shift o botón del medio no se intercepta —si
alguien pide otra pestaña a propósito, se respeta—.

## Refactorizar el diálogo existente en vez de duplicarlo

El diálogo de la política necesitaba foco, `Escape`, cierre y trampa de
foco: exactamente lo que ya hacía el de resultado. Duplicarlo era la
opción de menor riesgo inmediato y la peor a plazo: dos trampas de foco
que se van diferenciando.

Se extrajo `crearDialogo()`. **La refactorización se hizo con las 272
pruebas existentes en verde, y siguieron en verde.** Esa es la única
razón por la que era una decisión razonable y no una apuesta.

## Una sola fuente para el texto legal

La política se renderiza **una vez** y la misma cadena se inserta en la
página y en el diálogo. Es lo que hace verdadero el requisito de "no
convertir el modal en el único lugar donde vive la política": las dos
superficies existen y no pueden divergir, porque no hay dos fuentes. Hay
un test que compara sección por sección.

## `demoMode` y el responsable

Con `demoMode: false`, `legal.controller.legalName` y `.address` pasan a
ser obligatorios y el build **falla** si faltan.

El razonamiento: una política que declara tener un responsable del
tratamiento y no lo nombra es peor que una que se declara demostración
técnica. La validación no deja publicar esa variante en blanco.

Ningún texto afirma cumplimiento normativo absoluto, y hay un test que lo
vigila. La política es profesional y adaptable; no se declara conforme a
ningún régimen concreto porque nadie lo verificó.

## `config/clinic.json` es público, y se asume

Se sirve como archivo estático, igual que el HTML que produce. Podría
excluirse del deploy, pero `api/_lib/mailer.js` lo necesita para firmar
los correos con la marca configurada, y su contenido ya está todo visible
en las páginas.

La consecuencia se asume explícitamente y se protege: un test recorre
**claves y valores** buscando credenciales. No el texto crudo —la primera
versión hacía eso y se disparaba con su propio comentario, el que
advierte que los secretos van en variables de entorno—.

## Tres correcciones incidentales

Defectos preexistentes que aparecieron al reconstruir las páginas:

- el enlace "Saltar al contenido principal" apuntaba a `#main` y **ningún
  elemento tenía ese `id`**: la única ayuda de navegación por teclado del
  sitio no funcionaba;
- `404.html` usaba iconos de Font Awesome **sin cargar la hoja**;
- había enlaces de footer a "Términos" y "Cookies" con `href="#"`, y el
  footer entero del 404 apuntaba a `#`.

Se corrigieron. Son cambios fuera del pedido literal, y se declaran acá
en vez de pasarlos como parte del alcance: dejarlos habría sido publicar
una versión "profesional" con la navegación por teclado rota.

## Errores propios de esta etapa

Se dejan anotados porque el patrón se repitió:

1. **Dos guards nuevos se dispararon con su propia documentación.** El de
   `localStorage` con el comentario que explica que no hay que agregarlo;
   el de secretos con el comentario que dice que los secretos van en
   variables de entorno. Los dos se corrigieron mirando **la causa**
   —código sin comentarios, claves y valores del JSON— y no el texto. Es
   el mismo error dos veces en la misma sesión.
2. **Cuatro tests del generador estaban mal escritos, no el código.**
   Asumían que cambiar `brand.name` cambiaba también `brand.description`,
   que `contact.email` y `legal.privacyContactEmail` eran el mismo campo,
   y que la página de la política se enlaza a sí misma. Se corrigieron
   los tests.
3. **El comentario del `404.html` nombraba la clase literal
   `has-mobile-nav`**, y el guard que la prohíbe busca la cadena en el
   HTML. Se reescribió el comentario en vez de aflojar el guard.

Ninguno de los tres llegó a `develop`: los detectó la suite antes del
commit. Pero los tres son la misma clase de descuido —escribir el guard
sin ejecutarlo contra el caso que debe pasar—.

## Lo que NO se hizo

- **Las imágenes fotográficas.** No hay generación de imágenes de calidad
  disponible en esta sesión. Se entrega el inventario exacto —archivo,
  ubicación, proporción, tamaño y prompt— y la integración lista para
  recibirlas: cada imagen sale de configuración, con su `alt`, `width` y
  `height`. Reemplazarlas es dejar los archivos y editar una línea.
  **Es el único punto que requiere intervención humana**, y no bloqueó
  nada más.
- Agenda, calendario, profesionales, chatbot, agente de voz, CMS, panel
  administrativo, dashboard y multi-tenant: v2.0.0.
- Tag y release: no corresponden a esta etapa.

## Lo que no se pudo verificar desde esta sesión

- **El `rewrite` y los `redirects` de Vercel.** Están declarados y hay un
  guard estructural sobre `vercel.json`, pero que `/politica-de-privacidad`
  responda 200 y `/politica-privacidad` devuelva 308 solo se comprueba
  contra un deployment. Queda para el Preview de la PR.
- **El envío real del formulario** con la nueva versión de política. El
  circuito quedó igual y la suite lo cubre, pero la validación en
  Production es una acción humana.

## La numeración: por qué esta etapa no es un hito

Se construyó bajo el nombre `17-identidad-privacidad-y-white-label`.
**Estaba mal**: H17 está reservado para "UI/UX avanzada y profesional" de
la v2.0.0, y una corrección sobre una versión ya publicada no debe
consumir un número de hito del roadmap.

Pasa a llamarse **`v1.0.1-identidad-privacidad-white-label`**, y el
ROADMAP la lista en una sección propia de *Releases de mantenimiento*,
fuera de la numeración de hitos.

### Eso obligó a tocar el motor del circuito

No era solo renombrar carpetas. `Get-FeatureInfo` exigía
`^[0-9]{2}-slug$`, y el workflow de cierre post-merge derivaba el slug de
la rama con `^feature/([0-9]{2}-...)$`. Con el nombre nuevo, la release no
habría podido pasar por `ready-for-pr.ps1` ni cerrar su ROADMAP sola.

Se amplió a **dos formas válidas**, con el mismo contrato:

| Forma | Para qué |
|---|---|
| `NN-slug` | un hito del roadmap |
| `vX.Y.Z-slug` | una release de mantenimiento sobre una versión liberada |

Cambiar el motor del circuito excede el pedido literal, y por eso se
declara acá en vez de pasarlo como parte del alcance. La alternativa era
renombrar los documentos y dejar la automatización rota, que es peor:
`ready-for-pr.ps1` habría fallado y el cierre post-merge se habría
saltado en silencio.

### Un defecto encontrado al escribir el guard

Al probar qué identificadores **debía rechazar** el contrato, apareció
que `17-Con-Mayusculas` pasaba. La causa: PowerShell compara sin
distinguir mayúsculas por defecto, así que el `[a-z0-9]` del patrón no
exigía minúsculas y el mensaje de error las prometía sin pedirlas. Es un
defecto preexistente, anterior a esta etapa. Corregido con `-cnotmatch`.

Apareció por escribir la verificación en negativo, no la positiva: los
cinco identificadores válidos pasaban desde el principio.

### La rama y el historial

- La rama se renombró a `feature/v1.0.1-identidad-privacidad-white-label`.
  Era seguro: **nunca se había pusheado**. El worktree se movió a
  `../worktrees/identidad-privacidad-white-label`.
- **Los mensajes de los commits de construcción conservan el nombre
  viejo.** Es historial, no un documento permanente, y no se reescribe
  para maquillarlo. Hay un test que comprueba que ningún archivo de
  `docs/`, `runs/` ni el ROADMAP presente esta release como hito 17, y que
  declara explícitamente que el historial queda fuera de su alcance.
- **No se tocó el roadmap H17–H30 de la v2.0.0.**

## Las imágenes: la construcción no está terminada

Se corrige lo dicho en el reporte anterior. Las fotografías generadas por
IA son **parte obligatoria del alcance aprobado de la v1.0.1**, no un
pendiente aceptable: la etapa no se audita con los marcadores de posición
de Pillow como resultado final.

La integración está lista y no cambia cuando lleguen los archivos: cada
imagen sale de `config/clinic.json` con `src`, `alt`, `width` y `height`.
El inventario detallado —archivo, ruta, función, proporción, resolución,
peso, formato, prompt, restricciones y `alt`— está en
`docs/usuario/identidad-privacidad-white-label.md`.

Queda esperando los assets definitivos. Al recibirlos: integrarlos,
comprobar desktop y móvil, `build:site`, suites completas,
`build:site --check`, verificación visual y **nuevo SHA candidato**.
Recién entonces, auditoría independiente.
