# Test report 4 — Corrección del responsive móvil (V12)

**Etapa**: 16-validacion-mvp-produccion.
**Fecha**: 2026-09-06.
**Autor**: Claude Code.
**Origen**: **V12 = FAIL**, reportado por el humano tras validar en un
teléfono real.

```yaml
status: corregido_pendiente_de_revalidacion_en_production
attempt: 1
candidato: e783b832114fadac6ae7bb1aad5e4e62a4d469e7
medicion: viewport real (iframe del mismo origen) a 320/360/390/412/430/768/1024/1440
resultado_local: 0 elementos fuera del viewport en los 10 casos
pendiente:
  - deployment a Production
  - revalidacion de V12 sobre Production
  - comprobacion visual final en telefono real
```

## Problemas reportados

En teléfono real: header mal acomodado con la navegación invadiendo el
ancho y opciones cortadas; sin menú hamburguesa; título del hero
demasiado grande y desplazado; CTAs mal ubicados; contenido saliéndose
del viewport; y formulario demasiado angosto.

## Cómo se midió: viewport real, no simulado

`resize_window` **no redimensiona** en este entorno: reportaba éxito con
390×844 y con 414×896, pero `window.innerWidth` seguía devolviendo
**1696** en ambos casos. Declarar V12 con esa herramienta habría sido
falsear la evidencia, y así se hizo constar.

La alternativa que sí funciona: **un `<iframe>` del mismo origen crea su
propio viewport**, y las media queries del documento embebido evalúan
contra ese ancho. Es un viewport real, no una emulación. Al ser mismo
origen, se puede leer `contentDocument` y medir cada elemento con
`getBoundingClientRect()`.

Criterio de desborde: un elemento desborda si `right > viewport + 1` o
`left < -1`. Se mide la **posición real**, que no se ve afectada por el
recorte de `overflow: hidden` — importante, porque el sitio tenía una
máscara global (ver más abajo).

## Medición ANTES de corregir

| Ancho | Elementos desbordando | `#leadForm` | `h1` | CTAs | Hamburguesa |
|---|---|---|---|---|---|
| 360 | **8** | **201 px** (56 %) | 40 px | row | no existe |
| 390 | 6 | 231 px | 40 px | row | no existe |
| 412 | 6 | 253 px | 40 px | row | no existe |
| 430 | 6 | 271 px | 40 px | row | no existe |

Los dos desbordes de cabecera, a 360 px:

```
nav.nav-links   [131 .. 460]   → 100 px fuera
div.header-cta  [460 .. 703]   → 343 px enteros fuera de pantalla
```

## Causas reales

1. **`.nav-links` y `.header-cta` no colapsaban nunca.** No existía
   ningún breakpoint que los ocultara ni botón que los reemplazara. Con
   4 enlaces (`gap: 30px`) más un botón con el teléfono completo y otro
   de CTA, la barra necesita ~700 px. En 360 no cabe, y no había nada
   que lo contemplara.
2. **El padding del formulario vivía inline en el HTML**
   (`style="padding: 50px"`), donde **ninguna media query puede
   alcanzarlo**. Ésa era la causa concreta de los 201 px: 360 − 40 de
   contenedor − 100 de padding.
3. **`.hero` tenía `height: 100vh` fija**, que recorta contenido en
   pantallas bajas en vez de crecer.

## Corrección aplicada, acotada a `@media (max-width: 768px)`

- Botón `.nav-toggle` con `aria-expanded`, `aria-controls` y
  `aria-label`; clase `.has-mobile-nav` en el header.
- El header pasa a dos filas con `flex-wrap`. Se eligió así en vez de
  posicionamiento absoluto: evita números mágicos dependientes de la
  cantidad de enlaces, que se romperían al agregar uno.
- Hero: `height: auto` con `min-height: 100vh`, `h1` con `clamp()`, CTAs
  apilados a ancho completo.
- Formulario: el padding se movió a la clase CSS y se reduce en móvil.
- JS: apertura/cierre, cierre al elegir destino —si no, el menú tapa el
  contenido al que se acaba de navegar— y cierre con Escape.

## Medición DESPUÉS

| Ancho | Desbordes cerrado | Desbordes menú abierto | `h1` | CTAs | `#leadForm` |
|---|---|---|---|---|---|
| 360 | **0** | **0** | 29,6 px | column | 257 px |
| 390 | **0** | **0** | 29,6 px | column | 288 px |
| 412 | **0** | **0** | 30,9 px | column | 309 px |
| 430 | **0** | **0** | 32,3 px | column | 327 px |

Comportamiento del menú, verificado en los cuatro anchos: hamburguesa
visible; nav y CTA ocultos al cerrar; visibles al abrir; `aria-expanded`
pasando de `false` a `true` y de vuelta; el menú se vuelve a cerrar.

El aviso de demostración técnica queda visible en todos los anchos.

## El hallazgo de la auditoría: una máscara global

**`audit-1` intento 4 rechazó el candidato**, y con razón. Encontró dos
cosas encadenadas que se le habían pasado a Claude Code:

1. **`overflow-x: hidden` global en `body`** (`style.css:30`), heredado
   del commit baseline `a034703`. El punto 16 prohíbe explícitamente
   tapar el desborde en vez de corregir su causa. Mientras esa regla
   estuviera ahí, **cualquier desborde residual era invisible**.
2. **El test escrito para prohibir esa regla daba falso positivo.**
   Buscaba `body{overflow-x:hidden` como subcadena contigua sobre el CSS
   sin espacios, y no la encontraba porque hay otras propiedades entre
   medio. **Pasaba en verde con la regla prohibida presente.**

El segundo hallazgo es el más grave: un guard que no puede fallar no
protege nada, y éste además daba falsa confianza. Los otros tests del
módulo sí se habían verificado en negativo; éste no, y ahí se coló.

### Corrección

La máscara se eliminó. El test se reescribió: ahora **parsea las reglas**
contando llaves, entra en los `@media`, ignora comentarios y comprueba
selectores `html`/`body` con `re.fullmatch`. Cubre `overflow` y
`overflow-x`, valores `hidden` y `clip`, y selectores compuestos como
`html, body`.

Distingue lo prohibido de lo legítimo: `.hero` y `.hero-image` conservan
`overflow: hidden` **scopeado** —contener decoraciones, recortar esquinas
redondeadas— y no disparan el test.

### Verificación sin la máscara

Quitarla podía **revelar** desbordes que estaban ocultos. Medición
completa, ya sin máscara:

| Caso | `body overflow-x` | Desbordes | Con menú abierto |
|---|---|---|---|
| 320 px `/index.html` | `visible` | **0** | **0** |
| 360 px `/index.html` | `visible` | **0** | **0** |
| 390 px `/index.html` | `visible` | **0** | **0** |
| 412 px `/index.html` | `visible` | **0** | **0** |
| 430 px `/index.html` | `visible` | **0** | **0** |
| 768 px `/index.html` | `visible` | **0** | **0** |
| 1024 px `/index.html` | `visible` | **0** | — |
| 1440 px `/index.html` | `visible` | **0** | — |
| 360 px `/404.html` | `visible` | **0** | — |
| 360 px `/politica-privacidad.html` | `visible` | **0** | — |

**El desborde estaba corregido de verdad, no escondido.** Se incluyó
320 px —por debajo de lo pedido— porque quitar una máscara global es
justo el cambio que puede destapar algo en el ancho más estrecho.

## Desktop: verificado, no asumido

| Ancho | Hamburguesa | Nav | CTA | Header | `h1` | CTAs | Form padding | Desbordes |
|---|---|---|---|---|---|---|---|---|
| 1440 | oculta | visible | visible | 80 px | 56 px | row | 50 px | **0** |
| 1024 | oculta | visible | visible | 80 px | 56 px | row | 50 px | **0** |

Idéntico a antes de la corrección.

`404.html` conserva su navegación en móvil: las reglas están **scopeadas
a `.has-mobile-nav`**, clase que esa página no declara porque tiene un
solo enlace y ningún botón que lo abra. Sin ese scoping se habría quedado
sin ninguna navegación visible, y hay un test que lo protege.

## Tests

**9 casos** en `tests/test_responsive_movil.py`, con su **límite
declarado** en el docstring: son **estructurales, no visuales**.
Verifican que las piezas que corrigen el problema sigan en su sitio; no
miden layout. Para eso haría falta un navegador headless en CI, que este
proyecto no tiene.

Verificados en negativo: reintroduciendo el padding inline falla uno;
reintroduciendo la máscara global falla otro.

| Suite | Resultado |
|---|---|
| `npm ci` | exit 0 |
| `npm test` | **213/213** |
| `pytest tests/` | **48/48** |
| `mkdocs build --strict` | OK |

## Límite de esta evidencia

Todas estas mediciones son **locales**, sobre `http://localhost`, y con
un **iframe**, que es un viewport real pero **no es un teléfono**. No
capturan la barra del navegador móvil, el `100vh` dinámico de iOS, el
zoom por defecto ni el comportamiento del teclado virtual al enfocar un
input.

Por eso V12 **no se declara PASS con esto**. Falta:

1. Deployment del candidato a Production.
2. Repetir esta medición contra Production.
3. **Comprobación visual final en un teléfono real**, que es la que
   originalmente falló y la única que puede cerrar el criterio.
