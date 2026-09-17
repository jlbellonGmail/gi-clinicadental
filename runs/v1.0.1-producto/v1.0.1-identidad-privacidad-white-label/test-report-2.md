# Test report 2 — integración de las imágenes definitivas

**Etapa**: v1.0.1-identidad-privacidad-white-label.
**Fecha**: 2026-09-08.

```yaml
status: construccion_completa_lista_para_auditoria
suites:
  npm_test: 333/333   # 0 saltados: el guard de la imagen social quedo activo
  pytest: 115/115
  mkdocs_strict: ok
  build_check: ok
defecto_encontrado_y_corregido: imagenes deformadas por falta de `height: auto`
pendiente_humano:
  - comprobar el rewrite y los redirects contra el deployment Preview
  - repetir las capturas de pantalla con la ventana de Chrome en primer plano
```

## Los cuatro assets

Entregados por el humano, generados con IA. Se copiaron desde el checkout
principal, donde habían quedado.

| Clave | Archivo | Dimensiones | Proporción | Antes | Después |
|---|---|---|---|---|---|
| `hero` | `paciente-sonrisa.webp` | 1448 × 1086 | 1.333 | 1237,6 KB | **74,6 KB** |
| `team` | `equipo-dental.webp` | 1448 × 1086 | 1.333 | 1305,1 KB | **92,4 KB** |
| `interior` | `interior-clinica.webp` | 1448 × 1086 | 1.333 | 1259,2 KB | **91,5 KB** |
| `social` | `og-social.webp` | 1731 × 909 | **1.904** | 1163,0 KB | **63,1 KB** |

Llegaban a ~1,2 MB cada una, muy por encima del presupuesto aprobado (250
KB las de 4:3, 300 KB la social). Se recomprimieron a WebP calidad 85 sin
cambiar dimensiones ni recortar: el original venía prácticamente sin
pérdida, y por eso la reducción es tan grande. Se comprobó visualmente que
la calidad se mantiene.

Las dimensiones difieren de las "recomendadas" del inventario (1600 × 1200
y 1200 × 630) pero **las proporciones son las aprobadas**, y ambas superan
el mínimo útil. No se reescaló: subir de 1448 a 1600 sería inventar
píxeles, y bajar la social a 1200 sería tirar detalle sin motivo.

## Inspección visual de los cuatro

Se abrió cada archivo y se miró:

| Comprobación | Resultado |
|---|---|
| Texto incrustado | **ninguno** en las cuatro |
| Logos o marcas visibles | **ninguno**; los ambos son lisos, sin bordados ni credenciales |
| Pantallas con texto legible | no: solo radiografías panorámicas |
| Personas en `interior` | ninguna, como pedía la restricción |
| Coherencia estética | sí: luz natural, blancos y acentos verde azulado en las cuatro |
| Composición de `social` | sujeto en el tercio izquierdo, resto de fondo limpio: sobrevive a un recorte central |

## Los textos alternativos: se reescribieron los cuatro

Los `alt` anteriores **afirmaban cosas que las fotos no muestran**:

| Antes | Problema |
|---|---|
| "Paciente sonriendo después de un tratamiento de **implante de carga inmediata**" | La imagen no muestra ningún implante |
| "Equipo … trabajando con **tecnología de punta**" | Vago; no describe la escena |
| "Interior … con **tecnología CAD/CAM y escáner 3D**" | Nada de eso es identificable en la foto |

`AGENTS.md` prohíbe inventar información clínica no provista, y un texto
alternativo que describe un tratamiento inexistente **le miente
justamente a quien no puede ver la imagen**. Los nuevos describen lo que
se ve:

- `hero` — *Paciente sonriendo, sentada en el sillón de un consultorio
  odontológico moderno y luminoso*
- `team` — *Tres profesionales de odontología observando juntos una
  radiografía dental panorámica en un monitor*
- `interior` — *Consultorio odontológico moderno y vacío, con sillón,
  lámpara de techo y ventanal al jardín*
- `social` — *Paciente sonriendo en el sillón de un consultorio
  odontológico luminoso, junto a un ventanal con vegetación*

El de `social` es específico y distinto del `hero`: es la misma persona,
pero otra toma y otro encuadre.

## El defecto que apareció al mirar

Medido en un viewport real de 320 px, con las fotos ya integradas:

```
paciente-sonrisa.webp  259x1086  ratio 0.239  DEFORMADA (esperada 1.333)
```

**Lo introduje yo en esta misma release.** Al agregar los atributos
`width`/`height` —que reservan el espacio de la imagen y evitan que el
layout salte al cargar— quedó `img { max-width: 100% }` sin `height:
auto`: el ancho cedía al contenedor y el alto se aplicaba al pie de la
letra. La foto salía estirada casi cinco veces su altura.

No lo detectó nada: el HTML era válido, el CSS era válido, y jsdom no
calcula layout. Se encontró **abriendo el sitio y midiendo**.

Corregido con `height: auto`, y con dos guards nuevos en
`tests/test_responsive_movil.py` que son el par obligatorio de esos
atributos:

| Defecto inyectado | |
|---|---|
| Quitar `height: auto` del CSS | **rojo** |
| Quitar `width`/`height` de las imágenes | **rojo** |

## Medición: 8 anchos, viewport real

Iframe del mismo origen, con la hoja de estilos forzada por parámetro
—sin eso se medía el CSS cacheado, que fue lo que enmascaró la corrección
en el primer intento—.

| Ancho | Viewport | Scroll-H | Desbordes | Imágenes rotas | Proporción | Diálogo al cargar |
|---|---|---|---|---|---|---|
| 320 | 299 | no | **0** | 0 | 259×195 OK | `none` |
| 360 | 340 | no | **0** | 0 | 300×225 OK | `none` |
| 390 | 370 | no | **0** | 0 | 330×247 OK | `none` |
| 412 | 392 | no | **0** | 0 | 352×264 OK | `none` |
| 430 | 410 | no | **0** | 0 | 370×277 OK | `none` |
| 768 | 748 | no | **0** | 0 | 708×531 OK | `none` |
| 1024 | 1004 | no | **0** | 0 | 493×370 / 411×308 / 442×331 OK | `none` |
| 1440 | 1420 | no | **0** | 0 | 600×450 / 500×375 / 540×405 OK | `none` |

## El diálogo de la política, abierto, a cuatro anchos

| Ancho | Caja | Dentro del viewport | Encabezado | Pie | Cuerpo (visible/total) | Desbordes | Foco | Datos |
|---|---|---|---|---|---|---|---|---|
| 320 | 288 × 812 | sí | 79 px | 75 px | 610 / 4990 | **0** | `politicaCerrarX` | intactos |
| 390 | 358 × 812 | sí | 70 px | 75 px | 619 / 3714 | **0** | `politicaCerrarX` | intactos |
| 768 | 720 × 804 | sí | 78 px | 79 px | 647 / 2264 | **0** | `politicaCerrarX` | intactos |
| 1440 | 720 × 804 | sí | 78 px | 79 px | 647 / 2264 | **0** | `politicaCerrarX` | intactos |

El encabezado y el pie quedan fijos y **solo scrollea el cuerpo**, que es
el punto: si scrolleara la caja entera, el botón de cerrar se iría de
pantalla justo cuando hace falta.

## Verificación visual: parcial, y se declara

Se obtuvieron **dos capturas válidas de escritorio**: el sitio con la
fotografía del hero renderizada, con su proporción correcta, esquinas
redondeadas y la marca *Sonría más* en el header sobre el hero oscuro.

A partir de ahí **la ventana de Chrome pasó a segundo plano**
(`document.visibilityState === 'hidden'`), y con la composición suspendida
las capturas siguientes salieron en blanco y `requestAnimationFrame` dejó
de dispararse. Se comprobó que era la captura y no la página: con el
diálogo abierto, el DOM daba caja de 720 × 711 en (488, 20), fondo
`rgba(0,0,0,0.55)`, título a 45 px del borde y el elemento en el centro
del viewport era un párrafo del texto legal.

**Lo que esto significa**: la geometría está verificada por medición —el
layout se sigue calculando con la pestaña oculta, y de hecho así se
encontró el defecto de la proporción—, pero **no hay foto del diálogo ni
del móvil**. Se declara como pendiente en vez de presentarlo como
verificado. Repetirlo solo requiere la ventana en primer plano.

## Limpieza

- **Se eliminaron los tres `.png`** de relleno. Nadie los referenciaba
  —el HTML usa `<img src="*.webp">` sin `<picture>`—, así que nunca
  fueron un fallback efectivo; y ahora serían el fallback equivocado, un
  rectángulo de color en lugar de la foto que acompañan.
- **`create_images.py` ya no puede pisar las fotos reales.** Se conserva
  porque documenta la regla de no rasterizar marcas y porque
  `test_marca_publica.py` la verifica sobre ese archivo, pero ahora se
  niega a correr si `static/images/` ya tiene imágenes, salvo
  `CREATE_IMAGES_FORCE=1`. Sin esa guarda, un `python create_images.py`
  distraído destruía los cuatro assets sin vuelta atrás.

## Suites

| Suite | Resultado |
|---|---|
| `npm test` | **333 / 333**, 0 saltados |
| `pytest tests/` | **115 / 115** |
| `mkdocs build --strict` | **OK**, 0 warnings |
| `node scripts/build-site.js --check` | **OK** |

El `skipped` que había en el reporte anterior desapareció: el guard de la
imagen social está activo y en verde.

### Un fallo intermitente, verificado en vez de atribuido

En una corrida falló `test_reconciler_never_removes_dirty_worktree`.
Ocurrió **mientras Chrome y el servidor local estaban corriendo**. Se
comprobó antes de concluir nada:

| Comprobación | Resultado |
|---|---|
| Procesos de reconciliador huérfanos | **ninguno** |
| El test solo | pasa (42 s) |
| El módulo completo, dos veces | **7/7** y **7/7** (197 s y 195 s) |
| La suite completa, sin nada más corriendo | **115/115** |

Lo honesto es decir qué se sabe y qué no: el fallo **no se reprodujo en
cuatro corridas posteriores** y no hay procesos acumulados, que era la
causa real del problema equivalente en el punto 16. La contención con el
navegador es la explicación compatible con la evidencia, pero **no está
demostrada**: no se volvió a provocar.

## Lo que sigue sin verificarse desde esta sesión

1. **El `rewrite` y los `redirects` de Vercel.** Hay guard estructural
   sobre `vercel.json`; que `/politica-de-privacidad` responda 200 y las
   direcciones viejas devuelvan 308 se comprueba contra el deployment
   Preview.
2. **Las capturas del diálogo y del móvil**, por lo dicho arriba.
3. **El envío real del formulario en Production.**
