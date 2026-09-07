# Test report 5 — Calidad visual del móvil (V12, segundo intento)

**Etapa**: 16-validacion-mvp-produccion.
**Fecha**: 2026-09-06.
**Autor**: Claude Code.
**Origen**: **V12 = FAIL otra vez**, reportado por el humano tras validar
en un teléfono real el candidato `e783b83`.

```yaml
status: liberado_y_desplegado_pendiente_de_telefono_real
attempt: 2
candidato_inicial: 6d4f90df506455744dc9f537857d9d10b311aa17   # PR 33, rechazado
candidato_aprobado: 5c94dcfec55b183a57bebe3f56cfe33825e9a060   # PR 37
auditorias:
  - audit-1-intento-5.md (Codex, sobre 6d4f90d, NO APROBADA)
  - audit-1-intento-6.md (Codex, sobre 5492cd4, NO APROBADA)
  - audit-1-intento-7.md (Codex, sobre 653c0ce, NO APROBADA)
  - audit-1-intento-8.md (Codex, sobre 8451815, NO APROBADA)
  - audit-1-intento-9.md (Codex, sobre 5c94dcf, APROBADA)
correcciones_posteriores: si
medicion: viewport real (iframe del mismo origen)
referencia: documentElement.clientWidth   # corregida: antes innerWidth
anchos: [320, 360, 390, 412, 430, 768, 1024, 1440]
casos: 31
resultado_local: 0 elementos desbordando y 0 scroll horizontal en los 31 casos
guards_verificados_en_negativo: 18/18
cambios_inocuos_que_siguen_en_verde: 4/4
main: 4e861340d6812b82e6b2b605e5111d2c5b80140a   # PR 38
deployment: 6295205198 (Production, success)
pendiente:
  - comprobacion visual en telefono real
```

## El diagnóstico que faltaba

El intento anterior corrigió el **desborde**: nada se salía del viewport
en ningún ancho. La validación en teléfono real volvió a fallar de todos
modos, y el motivo es que el desborde nunca fue el único problema.

El hero era **teal sobre teal**. Medido sobre `--gradient-primary`
(`#0ca9a9`), que era su fondo:

| Elemento | Contraste | Por qué |
|---|---|---|
| `h1` | **1,00:1** | degradado gris→teal recortado al texto; el extremo derecho coincidía con el fondo |
| Párrafo | **1,51:1** | usaba `--text-muted` (`#6b7c7c`), un gris pensado para fondo claro |
| CTA primario | **1,00:1** | relleno teal sobre fondo teal |
| CTA secundario | **1,00:1** | borde y texto teal, sin relleno |

Sobre `--primary` el blanco puro da 2,89:1, así que **ese fondo no
admitía texto legible de ningún color de la paleta**. No era un ajuste de
tamaños: era la superficie.

Los tests estructurales del intento anterior no podían detectarlo.
Verifican que las piezas estén en su sitio, no de qué color son. Esa es
la brecha que este intento cierra.

## Corrección

### Superficie propia para el hero

`--gradient-hero: linear-gradient(135deg, #0a7c7c 0%, #066060 100%)`,
deliberadamente más oscuro que `--gradient-primary`, que **se conserva
sin tocar** para el resto del sitio.

| Elemento | Antes | Ahora |
|---|---|---|
| `h1` | 1,00:1 | **5,02:1** (blanco) |
| Acento del `h1` | 1,00:1 | **3,80:1** (`--accent-soft`, texto grande) |
| Párrafo | 1,51:1 | **4,54:1** (`#eaf6f6`) |
| CTA primario, texto sobre su botón | 1,00:1 | **6,06:1** |
| CTA primario, superficie sobre el hero | 1,00:1 | **5,02:1** |
| CTA secundario | 1,00:1 | **5,02:1** |

Los ratios son contra `#0a7c7c`, el extremo **más claro** del gradiente:
el caso peor. Sobre el extremo oscuro todos suben.

El acento del `h1` (`--accent-soft: #ffd9bd`) da 3,80:1, que cumple AA
como **texto grande** — el `h1` no baja de 29,6 px en ningún ancho.
Llevarlo a 4,5:1 exigiría aclararlo hasta `#fff0e6`, indistinguible del
blanco del resto del título: se perdería el acento sin ganar
legibilidad. La excepción se declara y **el test comprueba el tamaño**
en vez de asumirlo.

### Scoping

Las reglas que aplican **color del hero** van scopeadas a `.hero`.
`.hero-content` se reutiliza en la sección de equipo, que va sobre fondo
claro; sin el scope ese contenido quedaría blanco sobre blanco.

La excepción, deliberada: `.hero-content p` **sí** declara color sin
scope, porque ahí el valor (`--text-muted`) es el del reuso sobre fondo
claro, no una fuga del hero. `.hero .hero-content p` lo pisa dentro del
hero. `audit-1-intento-6.md` marcó con razón que decir "todas" era
demasiado amplio.

### Resto

- **Header móvil unificado a 68 px.** La página legal daba 80: las reglas
  de compactación estaban scopeadas a `.has-mobile-nav`, clase que esa
  página no declara. Lo que aplica a cualquier header (altura, padding,
  gap) se movió a `.header-container`; `flex-wrap` sigue restringido a
  `.has-mobile-nav`, que es lo único propio del menú desplegable.
- **Página legal**: `h1` a 25,6 px y botón "Volver al inicio" a 13,6 px /
  141 px, para que el botón deje de competir con el título.
- **CTA apilados con tope de 420 px.** A 768 px quedaban como cintas de
  705 px. El tope no afecta a ningún ancho de teléfono: a 430 px el
  contenedor mide 367 px.

## La auditoría rechazó el primer candidato

`audit-1-intento-5.md` (Codex, sobre `6d4f90d`): **NO APROBADA**. Los
hallazgos eran correctos y están corregidos:

| Hallazgo | Corrección |
|---|---|
| `.hero-content h1` declaraba `color: var(--white)` **sin scope** | el color pasó a `.hero .hero-content h1` |
| El test validaba precisamente el selector sin scope | ahora lee el scopeado, más un guard que prohíbe color sin scopear en `.hero-content` |
| Ningún test garantizaba que `--gradient-primary` conservara su valor | guard nuevo |
| El reporte decía "unificado a 68 px" pero la tabla mostraba 75 px a 320 px | causa encontrada y corregida: ahora son 68 px en todos los anchos |

Sobre `.hero-content p` sin scope, que el auditor menciona junto al `h1`:
ahí el color **es** el del reuso sobre fondo claro, no una fuga del hero.
`.hero .hero-content p` lo pisa dentro del hero. Se dejó como estaba y se
declaró la intención en un comentario, porque quitarlo rompería la
sección de equipo. El guard nuevo lo verifica: `--text-muted` sobre
blanco da 4,38:1 y no dispara.

### Lo del header a 320 px

El logo caía a **dos líneas**: "Sonríe más" a 1,15 rem no entra en los
104 px que le quedaban, y eso estiraba el header a 75 px. Corregido con
`font-size: clamp(1rem, 4.2vw, 1.15rem)` y `white-space: nowrap`.
Verificado a 320/360/390/412/430/768: header **68 px** en las tres
páginas, logo en una línea, y entre 99 px y 534 px de holgura entre el
logo y la hamburguesa. Cero solapamientos.

## La segunda auditoría también rechazó

`audit-1-intento-6.md` (Codex, sobre `5492cd4`): **NO APROBADA**. Dio por
resueltos los cuatro hallazgos anteriores —hero scopeado, `404.html`
legible, grilla y header corregidos, sin máscara global, y los guards
principales capaces de fallar— pero encontró que **varios guards seguían
siendo demasiado laxos**:

| Hallazgo | Corrección |
|---|---|
| El guard de scope solo miraba selectores que **empiezan** por `.hero-content`; `.equipo .hero-content h1` se le escapaba | ahora busca `.hero-content` en cualquier posición y comprueba si algún ancestro es `.hero` |
| El guard de `--gradient-primary` solo verificaba que aparecieran las dos variables: permitía invertir paradas, cambiar el ángulo o mover posiciones | ahora compara el **valor completo** normalizado |
| Los guards de `overflow` distinguían mayúsculas: `BODY { OVERFLOW-X: HIDDEN }` pasaba | `re.I` en selector y valor |
| El parser entraba **un solo nivel** en los at-rules: un `@media` dentro de un `@supports` quedaba sin analizar | `reglas_css` es recursiva |
| El reporte afirmaba "todas las reglas de color van scopeadas a `.hero`", y `.hero-content p` es una excepción deliberada | reformulado, con la excepción explícita |

Los cuatro primeros son huecos reales y están cerrados, cada uno con su
caso negativo nuevo: **15 guards, los 15 verificados en negativo**.

### Un hallazgo del auditor que no era correcto

El informe dice que el reporte "afirma que hay 8 casos de contraste" pero
que el archivo "contiene seis funciones `test_`", y lista seis líneas.
El archivo tiene **ocho**: se le pasaron `test_los_dos_cta_del_hero_se_ven`
y `test_la_pagina_404_no_hereda_texto_ilegible_sobre_el_hero`. `pytest
--collect-only` sobre ese módulo recoge **8 tests**. La afirmación del
reporte era exacta y no se cambió.

Se deja registrado porque el criterio de esta etapa es persistir la
auditoría literal y responderla punto por punto, no aceptarla en bloque.

## La tercera auditoría: dos precisiones sobre los guards

`audit-1-intento-7.md` (Codex, sobre `653c0ce`): **NO APROBADA**.
Confirmó que los cuatro huecos anteriores estaban cerrados, que el parser
recursivo no duplica reglas ni rompe los `@media` simples, que el
`overflow: hidden` scopeado a componentes sigue permitido, y que no queda
ningún guard inalcanzable. También verificó los conteos con
`grep -c "^def test_"` y confirmó las cifras del reporte.

Quedaban dos debilidades, ambas ciertas:

| Debilidad | Corrección |
|---|---|
| `_sin_scope_de_hero` daba por scopeado `.hero + .hero-content p` y `.hero ~ .hero-content p`. Son **hermanos**, no ancestros: el elemento no está dentro del hero | solo cuentan los combinadores de descendencia y de hijo; un `+` o `~` entre `.hero` y `.hero-content` invalida el scope |
| También daba por scopeado `.foo:not(.hero) .hero-content p`, que menciona `.hero` justamente para **excluirlo** | el contenido de `:not(...)` se descarta antes de buscar |
| El guard de `--gradient-primary` comparaba la cadena casi literal: quitar un espacio detrás de una coma lo hacía fallar con el valor CSS intacto | compara sin espacios ni mayúsculas — protege el **valor**, no el formato |

### El arnés ahora comprueba las dos direcciones

La última debilidad es de un tipo distinto a todas las anteriores: **un
guard demasiado estricto es tan inútil como uno que no puede fallar**,
porque se pone en rojo por lo que no importa y acaba desactivándose.

Así que la verificación dejó de mirar solo si el guard falla ante su
defecto, y comprueba además que **no** falle ante un cambio inocuo:

| Cambio inocuo | Resultado esperado |
|---|---|
| Reformatear el gradiente sin cambiar su valor | sigue verde |
| `overflow: hidden` scopeado a un componente nuevo | sigue verde |

**17 defectos reintroducidos, los 17 en rojo. 2 cambios inocuos, los 2 en
verde.**

## La cuarta auditoría: los dos clasificadores, fijados con tablas

`audit-1-intento-8.md` (Codex, sobre `8451815`): **NO APROBADA**. Confirmó
la recursión del parser, los guards de `overflow` —incluido el
`overflow: hidden` legítimo de `.hero` y `.hero-image`— y los conteos de
tests. Encontró dos errores en las correcciones de la ronda anterior, los
dos ciertos:

| Error | Corrección |
|---|---|
| `.hero .foo + .hero-content p` **sí** desciende del hero: el hermano está entre `.foo` y `.hero-content`, no después de `.hero`. La regla "ningún `+` después de `.hero`" lo rechazaba | ahora decide el combinador que cierra **el compuesto de `.hero`**, no cualquier `+` posterior |
| Bajar el valor del gradiente a minúsculas igualaba `var(--PRIMARY)` con `var(--primary)`. Los nombres de variable CSS **sí** distinguen mayúsculas: aceptaba un valor roto | se comparan las **partes** —ángulo, variables y posiciones—, con el nombre de la función y las unidades sin distinguir mayúsculas y los nombres de variable distinguiéndolas |

### La lección: los dos clasificadores no estaban testeados

`_sin_scope_de_hero` se corrigió tres rondas seguidas, siempre por un
caso que nadie había escrito: primero solo miraba el principio del
selector, después trataba `.hero + .hero-content` como scope, después
rechazaba `.hero .foo + .hero-content`. Cada corrección se verificaba
contra un ejemplo suelto y volvía a derivar en el siguiente.

Ahora hay **dos tests de tabla** que fijan su comportamiento:

- `test_el_clasificador_de_scope_distingue_ancestro_de_hermano`: 9
  selectores que **sí** descienden del hero y 8 que no.
- `test_el_comparador_del_gradiente_mira_el_valor_no_el_formato`: 3
  formas equivalentes y 4 valores realmente distintos.

Son la diferencia entre "lo probé con un caso" y "el comportamiento está
fijado". Un guard que decide por su cuenta y no está sujeto por ninguna
tabla vuelve a derivar en cuanto se lo toca.

**18 defectos reintroducidos, los 18 en rojo. 4 cambios inocuos, los 4 en
verde.**

## Dos defectos que encontró esta ronda, fuera de la auditoría

### `404.html` quedó ilegible, y era culpa de esta corrección

`404.html` usa `.hero`, así que recibió la superficie oscura nueva. Sus
párrafos llevaban `color: var(--text-muted)` **inline**:

| Estado | Contraste |
|---|---|
| Antes de esta etapa, sobre `--primary` | 1,51:1 |
| Con `--gradient-hero`, **sin corregir** | **1,15:1** |
| Corregido | **4,54:1** |

Es decir: el cambio del hero **empeoró** esa página. Al ser inline,
ninguna regla CSS podía arreglarlo; se quitó el color para que herede el
del hero. Su `h1` "404" ya estaba bien (5,02:1).

No lo vio la auditoría —no se le preguntó por el 404— ni los tests, que
solo miraban `index.html`. Hay un guard nuevo para esto.

### Mi propia medición tenía un punto ciego del ancho de la barra de scroll

El detector de desbordes comparaba contra `window.innerWidth`. La
referencia correcta es `documentElement.clientWidth`: la diferencia es
justo el ancho de la barra de scroll, unos 23 px, y ahí se escondía un
desborde real.

Con la referencia corregida apareció: a 320 px, `.service-card` llegaba a
300 px sobre un área de contenido de 297. La causa,
`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` — un mínimo
fijo de 280 px no cabe en los 257 px disponibles. Corregido con
`minmax(min(280px, 100%), 1fr)`, que cede cuando no hay espacio.

**Todas las mediciones de abajo usan la referencia corregida.**

## Medición: 31 casos, viewport real

Un `<iframe>` del mismo origen crea su propio viewport y las media
queries del documento embebido evalúan contra ese ancho. Es un viewport
real, no una emulación. `resize_window` **no redimensiona** en este
entorno: reporta éxito y `window.innerWidth` sigue devolviendo 1696.

Criterio: un elemento desborda si `right > clientWidth + 1` o
`left < -1`. Se comprueba además `scrollWidth > clientWidth`, que es el
scroll horizontal tal como lo ve quien navega.

### `index.html`, menú cerrado

| Ancho | `clientWidth` | Desbordes | Scroll-H | `body overflow-x` | Header | `h1` | CTA | Formulario |
|---|---|---|---|---|---|---|---|---|
| 320 | 297 | **0** | no | `visible` | 68 px | 29,6 px | column, 257 px | 217 px |
| 360 | 337 | **0** | no | `visible` | 68 px | 29,6 px | column, 297 px | 257 px |
| 390 | 368 | **0** | no | `visible` | 68 px | 29,6 px | column, 328 px | 288 px |
| 412 | 389 | **0** | no | `visible` | 68 px | 30,9 px | column, 349 px | 309 px |
| 430 | 407 | **0** | no | `visible` | 68 px | 32,3 px | column, 367 px | 327 px |
| 768 | 745 | **0** | no | `visible` | 68 px | 38,4 px | column, 420 px | 665 px |
| 1024 | 1001 | **0** | no | `visible` | 80 px | 56 px | row, 205 px | 341 px |
| 1440 | 1418 | **0** | no | `visible` | 80 px | 56 px | row, 214 px | 440 px |

Contrastes idénticos en los ocho anchos: `h1` 5,02 / párrafo 4,54 / CTA
primario 6,06 / CTA secundario 5,02. El aviso de demostración técnica
visible en todos.

**El `h2` de la sección de equipo da 17,4:1 sobre blanco** en los ocho
anchos: la prueba de que el blanco del hero no se escapó al reuso.

### Menú abierto

320, 360, 390, 412, 430 y 768: **0 desbordes**, sin scroll horizontal,
`aria-expanded="true"`, nav desplegada.

### Otras páginas

| Caso | Desbordes | Scroll-H | Header |
|---|---|---|---|
| `politica-privacidad.html` 320 / 360 / 390 / 430 / 768 | **0** | no | 68 px |
| `politica-privacidad.html` 1440 | **0** | no | 80 px |
| `404.html` 320 / 360 / 390 / 768 | **0** | no | 68 px |
| `404.html` 1440 | **0** | no | 80 px |

Página legal: `h1` 25,6 px y botón "Volver al inicio" 13,6 px / 141 px en
móvil; 32 px y 190 px en desktop. `404.html` no declara `has-mobile-nav`
—un solo enlace, ningún botón que abra un menú— y conserva su navegación
visible.

## Desktop: verificado, no asumido

A 1024 y 1440: hamburguesa oculta, nav y CTA de cabecera visibles, header
80 px, `h1` 56 px, CTAs en fila, 0 desbordes. Sin regresión.

## Tests

`tests/test_contraste_visual.py`, **8 casos**, calcula ratios WCAG sobre
el CSS **sin navegador**: resuelve las variables de `:root`, expande
`var()` recursivamente y toma el extremo más claro del gradiente del hero
como caso peor.

Cubre título, acento, párrafo, ambos CTA (texto sobre su botón,
superficie contra el hero, borde del secundario), que el hero no vuelva a
`--gradient-primary`, que ese gradiente conserve su valor, que ningún
color del hero se declare sin scopear, y el hero de `404.html`.

`tests/test_responsive_movil.py` suma el guard de grillas con mínimo
fijo.

### Tres guards que no podían fallar

Los tres se detectaron **verificando en negativo**, no leyendo el código:

1. **El parser tomaba el selector después del último `}`.** `@import` no
   cierra con llave, así que la primera regla del archivo se leía como
   parte del at-rule. Una máscara global declarada ahí no se detectaba.
   Corregido: el selector arranca después del último `}` **o del último
   `;`**.
2. **`bloque_movil()` devolvía el `@media` con su envoltorio.**
   `reglas_de_bloque` asume un fragmento plano, así que tomaba
   `@media (max-width: 768px)` como selector y desde ahí cada regla
   quedaba emparejada con el cuerpo de la anterior: `body` nunca aparecía
   solo. Una máscara global **dentro** del breakpoint pasaba en verde.
   Éste venía del commit que la auditoría anterior ya había aprobado.
3. **Un carácter backspace literal dentro de un regex.** El guard de
   scope llevaba un `0x08` en lugar de `\b`, por un escape mal resuelto
   al generar el archivo: nunca podía coincidir. Pasaba en verde con el
   defecto presente.

Los tres repiten el patrón que `audit-1-intento-4.md` ya había señalado.
La conclusión operativa es que **leer un guard no basta**: hay que
reintroducir el defecto y ver el rojo.

### Verificación en las dos direcciones: 18 y 4

| Defecto reintroducido | Guard que falla |
|---|---|
| Hero vuelve a `--gradient-primary` | los de contraste |
| Párrafo vuelve a `--text-muted` | `test_el_parrafo_del_hero_es_legible` |
| CTA primario vuelve a relleno teal | `test_los_dos_cta_del_hero_se_ven` |
| `h1` móvil baja de 24 px | `test_el_acento_del_titulo_es_legible` |
| Color del `h1` vuelve a la regla sin scope | `test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro` |
| `--gradient-primary` se oscurece | `test_el_gradiente_general_del_sitio_no_se_toca` |
| Vuelve el color inline del hero del 404 | `test_la_pagina_404_no_hereda_texto_ilegible_sobre_el_hero` |
| Máscara global tras el `@import` | `test_el_desborde_no_se_tapa_con_overflow_hidden` |
| Máscara global dentro del breakpoint | `test_el_breakpoint_movil_tampoco_enmascara` |
| Grilla con mínimo fijo | `test_ninguna_grilla_fija_un_minimo_mas_ancho_que_la_pantalla` |
| Color sin scope en un selector que **no empieza** por `.hero-content` | `test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro` |
| `--gradient-primary` conserva las variables pero cambia el ángulo | `test_el_gradiente_general_del_sitio_no_se_toca` |
| Máscara global en **mayúsculas** | `test_el_desborde_no_se_tapa_con_overflow_hidden` |
| Máscara global dentro de un **at-rule anidado** | `test_el_desborde_no_se_tapa_con_overflow_hidden` |
| Color tras un combinador de hermano (`.hero + .hero-content p`) | `test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro` |
| Color bajo `:not(.hero)` | `test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro` |
| Nombre de variable del gradiente en mayúsculas | `test_el_gradiente_general_del_sitio_no_se_toca` |
| Vuelve el padding inline del formulario | `test_el_formulario_no_pierde_el_ancho_en_padding` |

Y en la otra dirección, cambios inocuos que **siguen en verde**:

| Cambio inocuo | Guard |
|---|---|
| Reformatear el gradiente sin cambiar su valor | `test_el_gradiente_general_del_sitio_no_se_toca` |
| Nombre de la **función** del gradiente en mayúsculas | `test_el_gradiente_general_del_sitio_no_se_toca` |
| Color en `.hero .foo + .hero-content`, que sí desciende del hero | `test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro` |
| `overflow: hidden` scopeado a un componente nuevo | `test_el_desborde_no_se_tapa_con_overflow_hidden` |

### Suites

| Suite | Resultado |
|---|---|
| `npm test` | **213/213** |
| `pytest tests/` | **59/59** |
| `mkdocs build --strict` | OK |

**Nota sobre `tests/test_local_reconciler_scripts.py`.** Ese módulo lanza
procesos PowerShell en segundo plano y los espera hasta 90 s. Bajo carga
—con el navegador midiendo y varios servidores locales activos— dos
ejecuciones distintas agotaron ese plazo, cada una en un test distinto.
En aislamiento pasa 7/7, y en CI pasa. Es sensible al tiempo, no algo que
introduzca este cambio, que no toca el circuito. Queda registrado por si
vuelve a aparecer.

## Alcance

No toca `api/`, `vercel.json`, `package.json`, `package-lock.json` ni
`supabase/`. El backend queda idéntico, así que la evidencia de V4 a V10
sigue siendo válida.

Documentación actualizada: `docs/tecnica/redisenio-estetico-y-assets.md`
declaraba que el hero usaba `--gradient-primary`, lo que dejó de ser
cierto.

## Límite de esta evidencia

Todo lo anterior es **local**, sobre `http://localhost`, y con un iframe:
un viewport real, pero **no un teléfono**. No captura la barra del
navegador móvil, el `100vh` dinámico de iOS, el zoom por defecto ni el
teclado virtual al enfocar un input. Además, el iframe tiene barra de
scroll clásica; un teléfono usa barras superpuestas, donde
`clientWidth == innerWidth`.

V12 **no se declara PASS con esto**. Falta una nueva auditoría sobre el
candidato corregido, el release a `main`, el deployment y la comprobación
visual en un teléfono real, que es la que falló dos veces y la única que
puede cerrar el criterio.

---

## Release y revalidación en Production

**Fecha**: 2026-09-06.

| | |
|---|---|
| PR de release | **#38**, `develop` → `main` |
| `main` | `4e861340d6812b82e6b2b605e5111d2c5b80140a` |
| Contenido liberado | `5c94dcf`, el SHA que aprobó `audit-1-intento-9.md` |
| Deployment | `6295205198`, `Production`, **`success`** |

### El banco de medición no se puede usar contra Production

El sitio envía **`X-Frame-Options: DENY`**, así que el navegador se niega
a renderizarlo dentro de un `<iframe>` y el acceso al documento embebido
falla con `SecurityError`. Es la cabecera de seguridad de `vercel.json`
**funcionando como debe** —no un defecto—, pero inutiliza la técnica que
permitió medir en local.

### La equivalencia se demuestra por identidad de los archivos servidos

En vez de inventar otra medición, se comprobó que Production sirve
**exactamente el mismo código** que se midió:

| Archivo servido por Production | Bytes | Comparación con el candidato |
|---|---|---|
| `style.css` | 15.760 | **idéntico** |
| `index.html` | 16.003 | **idéntico** |
| `script.js` | 8.478 | **idéntico** |
| `404.html` | 3.542 | **idéntico** |
| `politica-privacidad.html` | 9.030 | **idéntico** |

Comparación byte a byte tras normalizar fin de línea. Siendo el mismo
CSS, el mismo HTML y el mismo JS, interpretados por el mismo motor de
render, **las mediciones locales aplican a Production sin
extrapolación**.

### V1 revalidado sobre Production

| Sonda | Resultado |
|---|---|
| `GET /` | **200** |
| `GET /politica-privacidad.html` | **200** |
| `GET /404.html` | **200** |
| `GET /api/leads` | **405** |
| `GET /no-existe-xyz` | **404** |

Cabeceras: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

### Por qué no se repiten V4–V10

El diff entre el `main` anterior (`fa20f9b`) y el actual (`4e86134`) toca
**únicamente** `style.css`, `404.html`,
`docs/tecnica/redisenio-estetico-y-assets.md` y dos módulos de `tests/`.

**No cambió nada de `api/`, `vercel.json`, `package.json`,
`package-lock.json` ni `supabase/`.** El backend es el mismo y las
variables de entorno no se tocaron, así que la evidencia de V4 a V10
—recogida sobre el deployment anterior y confirmada por el humano— sigue
siendo válida. Repetir el circuito completo crearía otra fila sintética y
dos correos más sin aportar información nueva.

### Lo único que falta para cerrar V12

**La comprobación visual en un teléfono real.** Es la que falló dos veces
y la única que esta cadena de evidencia no puede sustituir: ni el iframe
ni la identidad de archivos capturan la barra del navegador móvil, el
`100vh` dinámico de iOS, el zoom por defecto ni el teclado virtual al
enfocar un input.
