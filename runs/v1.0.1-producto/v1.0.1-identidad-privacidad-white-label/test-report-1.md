# Test report 1 — v1.0.1

**Etapa**: v1.0.1-identidad-privacidad-white-label.
**Fecha**: 2026-09-08.
**Base**: `develop` en `b00520b`.

```yaml
status: construccion_parcial_faltan_las_imagenes_definitivas
sha_intermedio: c93a4b4b2133a13b83e07bd2a75beb9b40dcbe79   # NO es el candidato final
suites:
  npm_test: 331/331
  pytest: 113/113
  mkdocs_strict: ok
  build_check: ok
verificacion_en_negativo: 20/20 defectos detectados
bloqueante:
  - las tres imagenes fotograficas son alcance obligatorio de la v1.0.1;
    la etapa no se audita con los marcadores de Pillow como resultado final
pendiente_humano:
  - comprobar el rewrite y los redirects contra el deployment Preview
```

## Suites

| Suite | Antes | Ahora |
|---|---|---|
| `npm test` | 272 | **331 / 331** |
| `pytest tests/` | 79 | **113 / 113** |
| `mkdocs build --strict` | ok | **ok** |
| `node scripts/build-site.js --check` | — | **ok** |

Los 59 tests nuevos de JavaScript son 15 del diálogo de la política, 23
de la validación de configuración y 21 del generador. Los 34 de Python son 9 de configuración y secretos, 19 de la
nomenclatura de etapa y 6 reescritos o agregados en los guards de marca.

## Que la refactorización no rompió nada

`crearDialogo()` reemplazó la implementación suelta del diálogo de
resultado. Las **272 pruebas que ya existían siguieron pasando sin
modificarse**: es lo que hace que la extracción fuera una decisión
razonable y no una apuesta.

Dos tests de `test_dialogo_resultado.py` sí se ajustaron, y hay que
decirlo con precisión: **no porque el comportamiento cambiara, sino
porque estaban acotados por conteo global**.

- `test_hay_una_sola_infraestructura_de_dialogo` contaba
  `class="modal"` en toda la página. Con un segundo diálogo, ese conteo
  dejó de medir lo que decía medir. Se reemplazó por algo más preciso y a
  la vez más amplio: el diálogo de resultado sigue siendo uno con sus
  tres variantes, **y** todos los `role="dialog"` de la página viven
  dentro de la infraestructura `.modal`. Se agregó además un test que no
  existía: **todos** los diálogos arrancan cerrados desde el HTML.
- `test_ninguna_variante_promete_un_correo` aislaba el diálogo con
  `id="modalResultado".*?<script`, y ese rango pasó a comerse el texto
  legal, que menciona "correo electrónico" como dato almacenado. Se acotó
  con un helper.

## Verificación en negativo

Un test que nunca se vio fallar no prueba nada. Se inyectó cada defecto,
se corrió el guard que debería detectarlo y se exigió que **se pusiera en
rojo**.

| Defecto inyectado | Guard | |
|---|---|---|
| La marca vuelve a la variante incorrecta | `test_marca_publica` | **rojo** |
| El HTML publicado se edita a mano y se separa de la config | `build-site.test.js` | **rojo** |
| El enlace de la política vuelve a navegar | `politica-dialogo.test.js` | **rojo** |
| Se persiste el formulario en el navegador | `politica-dialogo.test.js` | **rojo** |
| El foco no vuelve al control que abrió el diálogo | `politica-dialogo.test.js` | **rojo** |
| Una imagen se queda sin texto alternativo | `clinic-config.test.js` | **rojo** |
| `demoMode: false` sin responsable declarado | `clinic-config.test.js` | **rojo** |
| La versión de la política pierde el formato que valida la API | `clinic-config.test.js` | **rojo** |
| Una credencial entra en la configuración pública | `test_configuracion_y_secretos` | **rojo** |
| Los correos vuelven a tener la marca escrita a mano | `test_marca_publica` | **rojo** |
| Se quita la red de seguridad de `[hidden]` | `test_dialogo_resultado` | **rojo** |
| La dirección vieja de la política queda en 404 | `test_configuracion_y_secretos` | **rojo** |
| La función se despliega sin la configuración | `test_configuracion_y_secretos` | **rojo** |
| Las plantillas se publican con los marcadores en crudo | `test_configuracion_y_secretos` | **rojo** |
| Una variable expuesta al navegador con nombre de secreto | `test_configuracion_y_secretos` | **rojo** |
| Contenido editorial declarado como variable de entorno | `test_configuracion_y_secretos` | **rojo** |
| El 404 declara el menú móvil que no tiene | `test_responsive_movil` | **rojo** |
| Un servicio se queda sin descripción | `clinic-config.test.js` | **rojo** |
| La política afirma cumplimiento legal | `build-site.test.js` | **rojo** |
| Un diálogo deja de arrancar cerrado | `test_dialogo_resultado` | **rojo** |

**20 de 20.** El árbol quedó restaurado y `--check` vuelve a coincidir.

## Marca

| Superficie | Antes | Ahora |
|---|---|---|
| `index.html` | 12 apariciones de la variante incorrecta | **0**, 12 de la correcta |
| `politica-de-privacidad.html` | — | **0 / 5** |
| `404.html` | 4 | **0 / 4** |
| `api/_lib/mailer.js` | 8 literales | **0**: 8 interpolaciones de `${marca()}` |
| `mkdocs.yml` | 1 | **0** |

Sin tocar `sonriamas-contactos@nextgia.io`, `facebook.com/sonrimas` ni
ningún slug interno.

## Privacidad desde el formulario

Verificado en jsdom sobre el `index.html` real:

| Comprobación | Resultado |
|---|---|
| El diálogo arranca cerrado | sí |
| El clic cancela la navegación (`defaultPrevented`) | **sí** |
| Los cuatro valores del formulario tras abrir y cerrar | **intactos** |
| El foco al abrir | entra al diálogo |
| El foco al cerrar | vuelve **al enlace exacto** que lo abrió |
| `Escape`, la X, "Volver al formulario" y el fondo | los cuatro cierran |
| La posición de scroll al cerrar | **restaurada** (`scrollTo(0, 1234)`) |
| Tab y Shift+Tab | no se escapan del diálogo |
| Ctrl+clic | **no** intercepta: deja abrir la pestaña |
| `localStorage` / `sessionStorage` en `script.js` | **ninguno** |
| El diálogo contiene la política completa | sí, y enlaza la página |
| El diálogo de resultado | no se cruza con el de la política |

El foco de retorno se probó **con el último enlace de la página, no con
el primero**: si el código devolviera el foco a un elemento fijo, con el
primero pasaría igual.

## White-label

Cambiando solo `config/clinic.json` en memoria, el generador produce:

- marca, descripciones y texto de pie distintos en las tres páginas;
- teléfono, WhatsApp, correo, dirección y horarios distintos;
- servicios distintos, **ordenados por `order`** y no por su posición en
  el archivo, con `visible` e `inForm` funcionando por separado;
- redes sociales distintas, con `aria-label`;
- imágenes distintas, con `alt`, `width` y `height`;
- la versión de la política en el `<meta>` que lee el formulario;
- con `demoMode: false`, sin avisos de demostración y con el responsable
  real —incluidos nombre comercial e identificación fiscal cuando
  existen, omitidos sin dejar la frase colgando cuando no—.

El texto legal se comprobó **sección por sección**: cada `<section>` de
la página está también en el diálogo.

## Lo que no se pudo verificar desde esta sesión

1. **El `rewrite` y los `redirects` de Vercel.** Hay un guard estructural
   sobre `vercel.json`, pero que `/politica-de-privacidad` responda 200 y
   `/politica-privacidad` devuelva 308 solo se comprueba contra un
   deployment. Queda para el Preview de la PR.
2. **Las imágenes fotográficas.** No hay generación de imágenes de
   calidad en esta sesión. Las actuales siguen siendo los marcadores de
   posición de Pillow. El inventario y los prompts están en
   `docs/usuario/identidad-privacidad-white-label.md`.
3. **El envío real del formulario en Production** con la nueva versión de
   política. El circuito no cambió y la suite lo cubre, pero la
   validación en vivo es una acción humana.
