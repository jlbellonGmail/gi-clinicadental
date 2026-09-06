# Test report 6 — Envío del formulario: doble submit, feedback y confirmación

**Etapa**: 16-validacion-mvp-produccion.
**Fecha**: 2026-09-06.
**Autor**: Claude Code.
**Origen**: ampliación de alcance pedida por el humano. Tres problemas de
UX confirmados usando el sitio en pruebas reales, más la confiabilidad de
los dos envíos SMTP consecutivos.

```yaml
status: liberado_y_validado_en_production
alcance:
  - A: confiabilidad de los dos envios SMTP consecutivos
  - B: prevencion del doble submit
  - C: feedback inmediato durante el procesamiento
  - D: confirmacion final clara
suites:
  npm_test: 248/248   # eran 213
  pytest: 60/60       # eran 59
  mkdocs_strict: ok
verificacion_en_negativo:
  guards_css: 18/18
  guards_js: 16/16   # el del cuerpo comprueba la causa, no el efecto
  cambios_inocuos_que_siguen_en_verde: 7/7
cobertura_nueva:
  script.test.js: 28 casos sobre DOM real (primera cobertura de script.js)
  mailer.test.js: +7 casos de reintento y pool
pendiente:
  - auditoria independiente sobre el candidato
  - release a main y deployment
  - validacion minima real
```

## B — El guard de doble submit estaba invertido

No es que faltara: **existía y hacía lo contrario de lo que decía**.

```js
btn.disabled = true;              // 1. deshabilita
// ...
if (btn.dataset.submitting) {     // 2. detecta el segundo submit
    btn.disabled = false;         // 3. y REHABILITA el boton
    btn.textContent = originalText;
    return;
}
btn.dataset.submitting = 'true';  // 4. recien aca marca el estado
```

El orden está mal en dos sitios a la vez: la marca se pone **después** de
comprobarla, y la rama que debería bloquear **desbloquea**, con la request
todavía en vuelo. Sumado a que el envío tarda varios segundos, es
exactamente el escenario que reportó el humano.

### Corrección

El estado pasa a una variable explícita en el closure del handler:

```js
let enviando = false;
// ...
if (enviando) {
    return;      // sale sin tocar nada
}
```

`disabled`, `aria-busy` y `aria-disabled` son su **reflejo** en el DOM, no
el estado en sí. El guard cubre el click, el Enter y cualquier submit
programático, porque los tres producen el mismo evento `submit`. Hay una
segunda barrera en el `click` del botón, por si algún navegador dejara
pasar un click sobre un botón ya deshabilitado.

## C — Feedback inmediato

Al primer submit válido, sin esperar a la red:

- botón deshabilitado, con `aria-busy="true"` y `aria-disabled="true"`;
- etiqueta a **"Enviando solicitud..."**;
- spinner `.form-submit__spinner`, decorativo y con `aria-hidden` porque
  el estado ya se anuncia por `aria-busy`.

El spinner respeta `prefers-reduced-motion`: sigue indicando trabajo en
curso, sin girar. No se bloquea la página entera.

## D — Confirmación

Diálogo `#modalExito` con `role="dialog"`, `aria-modal="true"` y
`aria-labelledby`. Se abre **solo tras un 201 confirmado**, el foco entra
al botón de cierre, `Escape` lo cierra, y al cerrarse el foco vuelve a
donde estaba. No redirige.

**No afirma que se haya enviado ningún correo.** El endpoint responde
`201 { id }` y los dos envíos SMTP ocurren después, pudiendo fallar sin
afectar ese 201. Decirlo sería afirmar algo que el sistema no confirmó.
Hay un test que prohíbe las cadenas "correo", "email", "mail", "bandeja" y
"casilla" en el texto del diálogo.

### Éxito y error

| | Éxito (201) | Error |
|---|---|---|
| Formulario | se resetea | **se conserva todo** |
| Botón | vuelve a normal | se rehabilita, permite reintentar |
| Mensaje | diálogo | `#formError` con `role="alert"` |

El reset ocurre **solo** con `status === 201`. Se verificó que los dos
caminos de éxito del endpoint —incluido el de idempotencia, que devuelve
el lead ya existente— responden 201 (`api/leads.js:751` y `:968`), así que
la condición no deja fuera ningún caso legítimo.

El error nunca muestra detalle técnico. Un test inyecta el mensaje
`"ETIMEDOUT connect 10.0.0.1:465 request_id=abc-123"` y verifica que nada
de eso llegue al texto visible.

## A — Los dos envíos SMTP consecutivos

En la validación real el correo a la clínica salió bien y el del paciente
—segundo envío de la misma invocación— dio `ETIMEDOUT`. El humano
confirmó que fue pasajero.

**Una sola conexión.** `pool: true` con `maxConnections: 1`. Sin pool cada
`sendMail` abría su propia conexión: TCP, TLS y autenticación otra vez. El
segundo envío pagaba ese costo completo por segunda vez, y fue el que
falló. Con la sesión reutilizada hay **menos trabajo y menos superficie de
fallo, no más**.

**Un reintento, acotado.** `enviarConReintento()` reintenta una sola vez
si el fallo fue transitorio:

| Se reintenta | No se reintenta |
|---|---|
| `ETIMEDOUT`, `ESOCKET`, `ECONNECTION`, `ECONNRESET`, `EPIPE`, `EAI_AGAIN`, `EDNS` | `EAUTH`, `EENVELOPE`, `EMESSAGE` |
| SMTP **4xx** (temporario por RFC 5321) | SMTP **5xx** (permanente) |

El tope es deliberado: un bucle convertiría un fallo de correo
—recuperable, y que no afecta al lead ya insertado— en un timeout de la
request entera. Por eso `vercel.json` fija además `maxDuration: 30` para
`api/leads.js`, que antes quedaba en el valor por defecto de la
plataforma.

No cambia el orden secuencial, ni el contenido, ni los destinatarios, ni
los `try/catch` acotados con su flag y `UPDATE` propios. **No se agregó
instrumentación diagnóstica.**

## Cobertura nueva

### `script.js` no tenía ni un test

Los 213 tests eran **todos de backend**. Los tres defectos se encontraron
usando el sitio a mano, y el guard invertido llevaba tiempo ahí sin que
nadie lo notara.

`script.test.js` aporta **28 casos sobre DOM real** (jsdom), montado con
el `index.html` del repositorio, no con un fixture: si el markup deja de
cablear el botón, los tests fallan. El `fetch` falso devuelve una Promise
que **no se resuelve sola**, lo que permite observar la ventana en la que
la request está pendiente — justo donde vivía el defecto.

`jsdom` entra como **dependencia de desarrollo**; no se despliega. La
decisión, y las alternativas descartadas, están en
`docs/tecnica/arquitectura.md`, que ya tenía una decisión previa de "sin
dependencia de testing nueva": se revisó de frente en vez de añadirla en
silencio.

**Límite declarado**: jsdom no pinta. Verifica estado, atributos y
llamadas, no aspecto visual.

### Un fallo del arnés, no del producto

Los dos primeros tests que enviaban una segunda vez daban 3 requests en
vez de 2. La causa: al evaluar el script el `readyState` todavía es
`loading`, así que el `dispatchEvent('DOMContentLoaded')` manual lo
disparaba una vez **y jsdom lo volvía a disparar al terminar de parsear**.
El handler corría dos veces y quedaban dos listeners de submit. Se
corrigió esperando el evento real.

Se deja registrado porque el síntoma —"el guard de doble envío falla"—
apuntaba al producto y el defecto estaba en la herramienta de medición.

## Verificación en negativo

Los guards nuevos no se dan por buenos leyéndolos. Cada defecto se
reintroduce y se comprueba el rojo; cada cambio inocuo, el verde.

| Defecto reintroducido | Guard que falla |
|---|---|
| Vuelve el guard invertido que rehabilitaba el botón | doble submit |
| Se quita el guard de doble envío | doble submit |
| El botón no se anuncia como ocupado | estado accesible |
| La etiqueta no cambia durante el envío | "Enviando solicitud..." |
| El formulario se resetea también ante error | datos conservados |
| Se acepta cualquier 2xx como éxito | reset solo con 201 |
| El error muestra el detalle técnico crudo | sin filtraciones |
| `Escape` deja de cerrar la confirmación | accesibilidad del diálogo |
| La confirmación promete un correo | promesa no confirmada |
| Se quita el spinner | indicador de carga |
| Se quita el `pool` | una sola conexión |
| El reintento deja de aplicarse a `ETIMEDOUT` | reintento transitorio |
| El reintento se vuelve un bucle sin tope | reintento acotado |
| Se reintenta un fallo permanente de autenticación | `EAUTH` no se reintenta |

Y en la otra dirección, cambios inocuos que **siguen en verde**:
reordenar los párrafos de la confirmación, subir la espera entre
intentos, el nombre de la función del gradiente en mayúsculas,
reformatear el gradiente, `.hero .foo + .hero-content`, un
`overflow: hidden` scopeado nuevo, y el bloqueo de scroll del modal.

**Total: 34 defectos en rojo, 7 cambios inocuos en verde.**

## Un defecto que solo apareció midiendo

Al unificar el CSS del modal dentro del bloque `@media` existente, las
tres reglas móviles quedaron **antes** que sus reglas base —que estaban al
final del archivo— y con la misma especificidad gana la última: las tres
murieron en silencio. El `h2` del diálogo seguía en 24 px en vez de
20,8 px.

El CSS era válido, los selectores existían y el bloque móvil los
contenía. **Ningún test lo veía.** Se encontró midiendo en viewport real.

Corregido moviendo la sección base delante del breakpoint, y ahora hay un
guard —`test_ninguna_regla_movil_queda_pisada_por_una_regla_base_posterior`—
que detecta esa clase de regla muerta sin navegador. Verificado en
negativo.

## Medición del layout

Viewport real, contra `documentElement.clientWidth`.

| Ancho | Desbordes | Scroll-H | Header |
|---|---|---|---|
| 320 / 360 / 390 / 412 / 430 | **0** | no | 68 px |
| 767 | **0** | no | 68 px |
| 1024 / 1440 | **0** | no | 80 px |

Con el diálogo abierto:

| Ancho | Desbordes | Caja | Dentro del viewport | Título |
|---|---|---|---|---|
| 320 | **0** | 288×322 | sí | 20,8 px |
| 390 | **0** | 358×246 | sí | 20,8 px |
| 430 | **0** | 398×246 | sí | 20,8 px |
| 767 | **0** | 440×246 | sí | 20,8 px |

La caja se topa en 440 px en pantallas anchas y queda centrada.

### Corrección a `test-report-5.md`: el caso de 768 px

Aquel reporte afirma que a 768 px el sitio usa el layout móvil (header
68 px, CTAs apilados). **Depende del entorno.** Medido ahora:

| Ancho | `matchMedia('(max-width: 768px)')` | Header |
|---|---|---|
| 767 | `true` | 68 px |
| **768** | **`false`** | **80 px** |
| 769 | `false` | 80 px |

A 768 exactos el media query **no** coincide en este navegador: el ancho
real del viewport queda fraccionalmente por encima de 768 y `innerWidth`
lo redondea hacia abajo. En la medición anterior, con otra barra de
scroll y otro `devicePixelRatio`, sí coincidía.

No es un defecto —ambas ramas renderizan sin desborde, verificado a 767 y
769— pero la afirmación del reporte 5 era dependiente del entorno y se
corrige acá en vez de repetirse.

## Alcance

No se rediseñó el sitio ni se abrió la etapa de UI/UX. Los cambios son:
`index.html` (spinner, región de error, diálogo), `style.css` (estado de
carga, error, diálogo), `script.js` (envío), `api/_lib/mailer.js` (pool y
reintento), `api/leads.js` (usa el reintento), `vercel.json`
(`maxDuration`), más tests y documentación.

Supabase, el contrato del endpoint, el consentimiento, la idempotencia y
el logging sin PII no se tocaron, y sus 213 tests previos siguen pasando
sin modificación.

## La auditoría rechazó el primer candidato

`audit-3-envio-formulario.md` (Codex, sobre `91f3a70`): **NO APROBADA**.
Dio por correctos el guard de doble envío —cubre `submit`, y el estado se
libera en las ramas de éxito y error—, la ausencia de filtraciones
técnicas, el reintento acotado con su distinción entre transitorio y
permanente, el pool de una sola conexión, y el `role`/`aria-modal`/foco
inicial/Escape/retorno del foco del diálogo.

Encontró **dos defectos**, los dos ciertos:

### 1. `response.json().catch(() => ({}))` hacía ambiguo el 201

Con un 201 y un cuerpo ilegible, el `catch` lo convertía en éxito y se
reseteaba el formulario. Y los tests no podían verlo: todos entregaban un
`json()` resuelto.

Se resolvió de raíz: **el cuerpo ya no se lee**. Nada de la UI depende del
`id` que devuelve el endpoint, así que parsearlo solo agregaba una rama
que había que decidir. Sin parseo no hay ambigüedad — manda el status.

Dos tests nuevos fijan el comportamiento en los dos sentidos: un 201 con
cuerpo ilegible **sí** es éxito (el lead fue creado), y un 500 con cuerpo
ilegible **sigue** siendo error y conserva los datos.

### 2. El diálogo no atrapaba el foco

Con `aria-modal="true"` el resto del documento se anuncia como inerte,
pero el `Tab` del teclado igual se escapaba: el foco terminaba en la
página de atrás, que visualmente está tapada.

Se agregó una trampa de foco que cicla dentro de `.modal__caja` y devuelve
el foco si algo lo saca. Dos tests: que `Tab` y `Shift+Tab` se queden
dentro, y que **con el diálogo cerrado el `Tab` no se interfiera** — un
trap que se pasa de listo rompe la navegación normal del teclado.

Tras estas correcciones: **`npm test` 247/247**, y **16 guards de JS
verificados en negativo** (eran 14), más 2 cambios inocuos que siguen en
verde.

## La auditoría volvió a rechazar: el guard comprobaba el efecto, no la causa

`audit-3-envio-formulario-intento-2.md` (Codex, sobre `36253d7`): **NO
APROBADA**. Dio por correcta la lógica de envío, reset, filtraciones,
accesibilidad, pool y reintento. Encontró dos cosas, las dos ciertas:

### El test del cuerpo ilegible no distinguía una implementación de la otra

Comprobaba que un 201 con cuerpo roto fuera éxito. Pero **con
`response.json().catch(() => ({}))` reintroducido el efecto es
idéntico**, así que el guard habría seguido en verde con el defecto
presente.

Peor: el caso negativo que yo había escrito usaba `return
response.json();` **sin** el `.catch`, una mutación más fácil que el
defecto real. Verifiqué contra algo que no era el defecto.

Corregido comprobando la **causa**: el arnés cuenta las invocaciones de
`json()` y los tests exigen **cero**. Un test nuevo lo verifica en los
tres caminos (201, 429, 500), y el caso negativo usa ahora el defecto
exacto. Comprobado: con `.catch(() => ({}))` reintroducido, los dos tests
se ponen en rojo.

Es la cuarta vez en esta etapa que aparece la misma lección, y la más
sutil: **no basta con que el guard falle ante alguna mutación; tiene que
fallar ante la que importa.**

### El reporte se contradecía

Decía 27 casos en el bloque YAML y 23 en el cuerpo: actualicé una
ocurrencia y me dejé la otra. Ahora son **28** en los dos sitios, con
`npm test` en 248.

## La tercera auditoría aprobó

`audit-3-envio-formulario-intento-3.md` (Codex, sobre `3c66c8a`):
**APROBADA**. Verificó que el guard del cuerpo detecta ahora el defecto
**exacto** —`response.json().catch(() => ({}))`— y no solo una variante
más fácil; que el guard central bloquea los `submit` repetidos antes de
tocar el estado y que este se libera en éxito y en error; que el
formulario solo se resetea con 201, conserva los datos ante errores y no
lee el cuerpo; que no hay filtraciones ni promesas indebidas; y que el
pool y el reintento están correctamente acotados en ambos envíos.

Comprobó los conteos con `grep -c`: 28 casos en `script.test.js`, 30 en
`mailer.test.js` con los 7 nuevos.

Señaló además que dos referencias de línea del reporte habían quedado
viejas tras los cambios —`api/leads.js:746` y `:959`, hoy `:751` y
`:968`—, aunque la afirmación funcional sí estaba respaldada. Corregidas.

## Pendiente

Release a `main`, deployment, y una validación mínima real en
Production.

---

## Release y validación mínima real en Production

**Fecha**: 2026-09-06.

| | |
|---|---|
| PR de release | **#42**, `develop` → `main` |
| `main` | `109d0afe75803f0e6f8e3e7ae40127d66cee04ef` |
| Contenido liberado | `3c66c8a`, el SHA que aprobó `audit-3-envio-formulario-intento-3.md` |
| Deployment | `6298664005`, `Production`, **`success`** |

El deployment exitoso confirma además que la plataforma **acepta**
`maxDuration: 30` en `vercel.json`, que era el riesgo declarado en la PR.

### Production sirve el candidato auditado

| Archivo | Bytes | Idéntico al candidato |
|---|---|---|
| `style.css` | 19.417 | **sí** |
| `index.html` | 17.786 | **sí** |
| `script.js` | 13.307 | **sí** |
| `404.html` | 3.542 | **sí** |
| `politica-privacidad.html` | 9.030 | **sí** |

Sondas: `GET /` **200**, `/politica-privacidad.html` **200**,
`/404.html` **200**, `GET /api/leads` **405**.

### Un envío real, con datos sintéticos

Marca de la fila: `V13-MTQDI8RT`. Nombre `Prueba Sintetica V13-…`,
destinatario la cuenta controlada del humano, mensaje declarando que es un
dato de prueba. Es la **sexta** fila sintética.

Se instrumentó un espía sobre `fetch` que **solo cuenta** las llamadas a
`/api/leads`, sin alterar el comportamiento.

| Comprobación | Resultado |
|---|---|
| Primer click → requests | **1** |
| Tres clicks seguidos → requests | **1** |
| Más un `Enter` → requests | **1** |
| Botón, al instante | `disabled`, `aria-busy="true"`, `aria-disabled="true"` |
| Etiqueta, al instante | **"Enviando solicitud..."** |
| Spinner | visible (`display: block`) |
| Respuesta | **201**, sin mensaje de error |
| Formulario tras el 201 | **reseteado**, consentimiento desmarcado |
| Botón tras el 201 | disponible, etiqueta restaurada |
| Diálogo | visible, con el texto correcto |
| Foco al abrir | `#modalExitoCerrar` |
| `Tab` dentro del diálogo | se queda en `#modalExitoCerrar` |
| `Escape` | cierra, y quita `body.con-modal` |
| URL tras cerrar | **la misma**: no redirige |
| Scroll horizontal | **no** |

El texto del diálogo, verbatim desde Production:

> Solicitud enviada — Recibimos tu solicitud correctamente. Tu turno
> todavía no está confirmado. Nos comunicaremos con vos para coordinarlo.

Sin ninguna mención a un correo, que es el criterio.

### La duración: 13,8 segundos

Es el dato más relevante de esta medición. El endpoint tardó **13,8 s** en
responder el 201.

Eso está **por encima del límite por defecto** que la función tenía antes
de esta tanda. Sin el `maxDuration: 30` añadido en `vercel.json`, esta
misma request habría muerto por timeout de plataforma —un 504— con el lead
ya insertado y los correos posiblemente enviados. El margen no era
teórico.

**Lo que no se puede afirmar desde acá**: si esos 13,8 s incluyen un
reintento de alguno de los dos envíos SMTP. Confirmarlo requiere los logs
de Vercel o los flags del lead en Supabase, y ninguno de los dos es
accesible desde esta sesión. Queda como comprobación humana, junto con las
dos que ya estaban pendientes.

### Lo que sigue pendiente de comprobación humana

1. Los dos flags SMTP del lead `V13-MTQDI8RT` en Supabase, y si hubo
   reintento.
2. Descartar las **seis** filas sintéticas (`estado='descartado'`).
3. La comprobación visual de V12 en un teléfono real.
