# Test report 4 — correcciones de audit-1

**Etapa**: v1.0.1-identidad-privacidad-white-label.
**Fecha**: 2026-09-08.
**Responde a**: `audit-1.md` — **NO APROBADA** sobre `42eb36e`.

```yaml
status: correcciones_aplicadas_listo_para_reauditoria
auditoria_previa: rejected
suites:
  npm_test: 337/337
  pytest: 149/149
  mkdocs_strict: ok_0_warnings
  build_check: ok
  feature_contract: ok_sin_title_explicito
verificacion_en_negativo: 13/13 defectos detectados
tests_nuevos: 20
```

## Qué se corrigió

| Hallazgo | Estado |
|---|---|
| `spec.md` con `runs/17-...` | Corregido |
| `spec.md` referencia `docs/usuario/imagenes-del-sitio.md`, inexistente | Corregido: el inventario está consolidado en `identidad-privacidad-white-label.md` |
| `spec.md` describe `<picture>` AVIF/WebP/fallback no implementado | Corregido: describe WebP directo, y por qué |
| `spec.md` dice que las fotografías no están disponibles | Corregido: las cuatro están integradas |
| `.mjs` por `.js` en dos rutas de la spec | Corregido |
| Páginas fuera de `nav` | Investigado y acotado; guard nuevo |
| Fragilidad del título canónico | Corregida en las cuatro superficies |
| Comentario `Sonrie mas` en CSS | Corregido como higiene |

## Hallazgo propio, no señalado por la auditoría

`docs/tecnica/identidad-privacidad-white-label.md` declaraba en "Límites
declarados" que **"las imágenes siguen siendo marcadores de posición
generados con Pillow"**. Era falso desde `53c8ee9`, tres commits antes
del SHA auditado. Es exactamente el defecto que la auditoría marcó en la
spec, en otro archivo. Eliminado.

## Por qué el guard de nomenclatura no vio la spec

El patrón era `runs/17-identidad`; la spec traía `runs/17-.../decision.md`,
con el nombre elidido. Ampliado a `runs/17-`.

Al ampliarlo empezó a dispararse con `audit-1.md` y `decision.md`, que
citan la ruta vieja al narrar la corrección. **No se editó el acta de
auditoría para que pasara un test.** Se acotó el barrido a los documentos
que *describen el sistema* —documentación publicada, `ROADMAP.md`,
`spec.md`— dejando fuera las *actas del proceso* —`audit-N.md`,
`test-report-N.md`, `decision.md`—, que existen para contar qué cambió.

La distinción no puede hacerla el patrón: en la spec,
`runs/17-.../decision.md` decía dónde vive un artefacto requerido; en
`decision.md`, la misma cadena cuenta que ahí decía eso. Idénticas como
texto, opuestas como significado.

## MkDocs: precisión sobre el hallazgo

`mkdocs build --strict` termina **en verde con cero warnings**. Lo que
emite es un mensaje `INFO`. `--strict` convierte *warnings* en errores; un
`INFO` no lo es.

| | páginas |
|---|---|
| Total fuera de `nav` | 37 |
| De esas, alcanzables desde su índice | 35 |
| **Realmente inalcanzables** | **2** |
| Introducidas por la v1.0.1 | 2, **ambas enlazadas** |

Las dos inalcanzables son `docs/tecnica/landing.md` y
`docs/usuario/landing.md`, preexistentes y ajenas a esta release.

No se agregaron las dos páginas nuevas a `nav` —serían las únicas dos de
37— ni se declaró `not_in_nav`, que habría silenciado el `INFO` completo
incluidas las dos genuinamente inalcanzables. Se agregó un guard que
exige que toda página esté enlazada desde el índice de su área, con las
dos `landing.md` como excepción declarada y un test que avisa cuando la
excepción quede obsoleta.

## Título canónico: dos capas, la segunda introducida por esta release

1. `Get-FeatureInfo` derivaba `Identidad Privacidad White Label` contra
   índices que dicen `Identidad, privacidad y white-label`.
2. `ready-for-pr.ps1` sacaba el título de documentación del de la PR con
   `-replace "^Feature [0-9]{2}-"`. La v1.0.1 amplió el contrato de slugs
   a `vX.Y.Z-slug` **y no amplió ese recorte**: el título quedaba en
   `Feature v1.0.1-identidad-privacidad-white-label` y el contrato no
   podía pasar por ninguna vía.

`scripts/feature-titles.json` declara el título una vez; lo consumen
`Get-FeatureInfo`, `Assert-FeatureContract`, `ready-for-pr.ps1` y
`update-doc-indexes.ps1`. `-Title` (PR) y `-DocTitle` (documentación)
quedaron separados.

**Comprobado:** `Assert-FeatureContract -Slug v1.0.1-identidad-privacidad-white-label`
**sin `-Title`** pasa. Los índices no se tocaron.

Compatibilidad: una etapa sin entrada cae al derivado y un `-Title`
explícito sigue ganando. Los 16 tests del contrato pasan sin cambios.

## Verificación en negativo — 13/13

| Defecto inyectado | Detectado |
|---|---|
| La spec vuelve a `runs/17-...` elidido | Sí |
| La spec vuelve a la ruta vieja completa | Sí |
| La etapa deja de declarar su título canónico | Sí |
| El registro declara un título vacío | Sí |
| El índice se degrada al título derivado | Sí |
| Los dos índices usan títulos distintos | Sí |
| `Get-FeatureInfo` deja de leer el registro | Sí |
| Vuelve el recorte por patrón de hito | Sí |
| La PR vuelve a titularse con la variable del contrato | Sí |
| Una página nueva queda sin enlace | Sí |
| La documentación de la release se desenlaza | Sí |
| `nav` pierde un índice | Sí |
| La excepción heredada queda obsoleta | Sí |

Dos dieron verde en la primera pasada. **No eran huecos de los guards:
eran defectos de la inyección** — `docs/usuario/index.md` y `mkdocs.yml`
son CRLF y las sustituciones buscaban `\n`, así que el defecto nunca
llegó a escribirse. Corregida la inyección, los dos detectan.

## Suites

| | |
|---|---|
| `npm test` | **337 / 337**, 0 saltados |
| `pytest` | **149 / 149** (129 + 20 nuevos) |
| `mkdocs build --strict` | OK, **0 warnings** |
| `node scripts/build-site.js --check` | OK |
| `Assert-FeatureContract` sin `-Title` | OK |

## Lo que sigue sin verificarse desde esta sesión

Sin cambios respecto de `test-report-3.md`:

- el `rewrite` y los `redirects` de Vercel, que se comprueban contra el
  deployment Preview de la PR;
- las capturas del diálogo y del móvil: la ventana de Chrome quedó en
  segundo plano (`document.visibilityState === 'hidden'`), lo que
  suspende el compositor y devuelve capturas en blanco;
- el envío real del formulario en Production.
