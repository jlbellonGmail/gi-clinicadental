# Test report 3 — iconos de marca

**Etapa**: v1.0.1-identidad-privacidad-white-label.
**Fecha**: 2026-09-08.

```yaml
status: construccion_completa_lista_para_auditoria
suites:
  npm_test: 337/337
  pytest: 129/129
  mkdocs_strict: ok
  build_check: ok
verificacion_en_negativo: 12/12 defectos detectados
referencias_locales_rotas: 0
```

## El defecto

Seis referencias rotas, no dos. Las encontró la verificación anterior y
esta release las cierra todas:

| Superficie | Referencia | Estado |
|---|---|---|
| `index.html` | `favicon.ico` | 404 |
| `index.html` | `apple-touch-icon.png` | 404 |
| `politica-de-privacidad.html` | `favicon.ico` | 404 |
| `politica-de-privacidad.html` | `apple-touch-icon.png` | 404 |
| `404.html` | `favicon.ico` | 404 |
| `mkdocs.yml` | `assets/favicon.ico` | 404 |

`404.html` era además la única página **sin** `apple-touch-icon`: no había
motivo, también se puede guardar en la pantalla de inicio.

Nada lo detectaba. Un icono ausente no rompe nada visible: simplemente no
hay icono, y `mkdocs build --strict` tampoco lo considera un error.

## La solución

`scripts/build-branding-icons.py` dibuja el isotipo dental con Pillow y
emite:

| Archivo | Formato | Tamaños | Peso |
|---|---|---|---|
| `favicon.ico` | ICO multi-tamaño | **16, 32, 48** | 3,3 KB |
| `apple-touch-icon.png` | PNG cuadrado, sin transparencia | **180 × 180** | 5,4 KB |
| `docs/assets/favicon.ico` | ICO multi-tamaño | 16, 32, 48 | 3,3 KB |

**Por qué un script y no un archivo suelto**: el logo del encabezado es
`<i class="fas fa-tooth">`, un glifo que se resuelve **en el navegador**.
Un favicon no puede depender de eso —el navegador lo pide antes de
ejecutar nada—, así que se dibuja como archivo real, sin fuentes de
iconos.

**Por qué fondo teal y diente blanco**, al revés que el encabezado: a
16 px un trazo fino sobre fondo claro desaparece entre las pestañas. La
silueta sólida sobre fondo de marca es lo que se lee a ese tamaño. Se
revisó a 16, 32, 48 y 180 px con la vista previa del generador.

**Sin transparencia en el PNG de iOS**: el sistema compone sobre negro y
las esquinas redondeadas quedarían con un halo oscuro.

## Parametrización

Dos caminos, ninguno toca HTML, CSS ni JavaScript:

1. **Archivos propios**: apuntar `brand.favicon` y `brand.appleTouchIcon`
   a las rutas nuevas.
2. **Mismo isotipo, otros colores**: cambiar `brand.iconColors` y
   regenerar.

Se corrigió además una trampa: el `type` del `<link rel="icon">` estaba
escrito a mano como `image/x-icon` en las tres plantillas. Con la ruta
saliendo de configuración, una clínica que pusiera un `.png` quedaba con
el tipo equivocado declarado y sin forma de arreglarlo sin tocar HTML.
Ahora se deduce de la extensión, y una extensión que no es de imagen
**falla el build** en vez de publicarse.

## Verificación por HTTP

Se sirvió el sitio y se pidió **cada referencia local** de las tres
páginas:

| Recurso | |
|---|---|
| `favicon.ico` | **200**, 3 377 B |
| `apple-touch-icon.png` | **200**, 5 515 B |
| `style.css`, `script.js` | 200 |
| las tres fotografías | 200 |
| `index.html`, `politica-de-privacidad.html` | 200 |
| `og-social.webp` (referida por URL absoluta) | **200**, 64 656 B |

**Referencias locales rotas: 0.**

## Verificación en negativo

| Defecto inyectado | |
|---|---|
| Falta `favicon.ico` | **rojo** |
| Falta `apple-touch-icon.png` | **rojo** |
| El favicon existe pero está vacío | **rojo** |
| El `.ico` trae un solo tamaño | **rojo** |
| El apple-touch-icon no es cuadrado | **rojo** |
| El HTML apunta a otra ruta que la configuración | **rojo** |
| Falta el favicon del sitio de documentación | **rojo** |
| El generador de iconos usa Font Awesome | **rojo** |
| Los colores del icono quedan escritos a mano | **rojo** |
| El tipo del favicon vuelve a estar fijo | **rojo** |
| Una referencia local del HTML apunta a la nada | **rojo** |
| Un color de icono inválido en la configuración | **rojo** |

**12 de 12.**

El guard más amplio es el penúltimo: no mira solo los iconos, sino que
**ninguna referencia local de las tres páginas apunte a un archivo
inexistente**. Los específicos son casos particulares de ése.

## Suites

| Suite | |
|---|---|
| `npm test` | **337 / 337**, 0 saltados |
| `pytest tests/` | **129 / 129** |
| `mkdocs build --strict` | OK, 0 warnings |
| `build:site --check` | OK |
