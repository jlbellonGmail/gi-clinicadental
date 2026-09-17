# Organización de runs por versión

## Convención canónica

Las unidades nuevas se almacenan en:

```text
runs/<version>-<tipo>/<NN>-<slug>/
```

Los únicos tipos vigentes son `producto` y `gobernanza`. La versión identifica
la release o línea de trabajo del producto, no la versión del Template. Para
ClínicaDental v2 la ruta reservada es `runs/v2.0.0-producto/`.

Los scripts aceptan explícitamente `-Version vX.Y.Z -ReleaseType producto|gobernanza`.
La forma histórica sin esos parámetros continúa resolviendo `runs/<slug>` para
leer artefactos legacy y no debe utilizarse al crear unidades nuevas.

## Clasificación histórica

La release `v1.0.0` declara en su anotación que incluye el MVP de captación
validado en el punto 16. Por eso las unidades de producto 01–16 se agrupan en
`v1.0.0-producto`, aunque sus commits de evidencias posteriores completen
documentación histórica.

| Run actual | Commit de introducción | Release real | Tipo | Destino propuesto | Evidencia |
|---|---|---|---|---|---|
| 01-configuracion-variables-entorno | `c82e224` | v1.0.0 | producto | `runs/v1.0.0-producto/01-configuracion-variables-entorno/` | commit de configuración del entorno; anterior al tag v1.0.0 |
| 02-inicializacion-supabase-schema | `b4de7e4` | v1.0.0 | producto | `runs/v1.0.0-producto/02-inicializacion-supabase-schema/` | esquema inicial de leads y RLS |
| 03-endpoint-recepcion-leads | `4711cfd` | v1.0.0 | producto | `runs/v1.0.0-producto/03-endpoint-recepcion-leads/` | endpoint POST y persistencia |
| 04-proteccion-antispam-y-abuso | `7942a2b` | v1.0.0 | producto | `runs/v1.0.0-producto/04-proteccion-antispam-y-abuso/` | protección del endpoint |
| 05-notificacion-clinica-smtp-ferozo | `f333438` | v1.0.0 | producto | `runs/v1.0.0-producto/05-notificacion-clinica-smtp-ferozo/` | notificación SMTP |
| 06-confirmacion-automatica-paciente | `0eaad86` | v1.0.0 | producto | `runs/v1.0.0-producto/06-confirmacion-automatica-paciente/` | confirmación por correo |
| 07-seguridad-y-politica-privacidad | `3565fff` | v1.0.0 | producto | `runs/v1.0.0-producto/07-seguridad-y-politica-privacidad/` | consentimiento y privacidad |
| 08-conexion-frontend-api | — | v1.0.0 | producto | sin run registrado | la feature aparece en historial/código, pero no existe carpeta `runs/08-*`; no se inventa evidencia |
| 09-redisenio-estetico-y-assets | `724bc9e` | v1.0.0 | producto | `runs/v1.0.0-producto/09-redisenio-estetico-y-assets/` | rediseño y assets |
| 10-actualizacion-datos-contacto | `de3b3f0` | v1.0.0 | producto | `runs/v1.0.0-producto/10-actualizacion-datos-contacto/` | datos institucionales |
| 11-seo-accesibilidad-y-navegacion | `a907470` | v1.0.0 | producto | `runs/v1.0.0-producto/11-seo-accesibilidad-y-navegacion/` | SEO, accesibilidad y navegación |
| 12-entregabilidad-correo-dominio | `55e0795` | v1.0.0 | producto | `runs/v1.0.0-producto/12-entregabilidad-correo-dominio/` | SPF, DKIM y DMARC |
| 13-pruebas-integrales-y-seguridad | `f1d6305` | v1.0.0 | producto | `runs/v1.0.0-producto/13-pruebas-integrales-y-seguridad/` | pruebas integrales |
| 14-pipeline-despliegue-vercel | `22a00f0` | v1.0.0 | producto | `runs/v1.0.0-producto/14-pipeline-despliegue-vercel/` | pipeline de despliegue |
| 15-observabilidad-y-operacion | `99ab949` | v1.0.0 | producto | `runs/v1.0.0-producto/15-observabilidad-y-operacion/` | observabilidad |
| 16-validacion-mvp-produccion | `28e51ae` | v1.0.0 | producto | `runs/v1.0.0-producto/16-validacion-mvp-produccion/` | tag v1.0.0 identifica explícitamente el punto 16 como MVP validado |
| v1.0.1-identidad-privacidad-white-label | `40f90cd` | v1.0.1 | producto | `runs/v1.0.1-producto/v1.0.1-identidad-privacidad-white-label/` | release de mantenimiento; se conserva el slug sin inventar número |
| 17-adopcion-template-v2 | `33358c7` | v1.0.2 | gobernanza | `runs/v1.0.2-gobernanza/17-adopcion-template-v2/` | tag v1.0.2: Template v2 governance base |
| 18-validacion-identidad-lifecycle | `0651a64` | v1.0.2 | gobernanza | `runs/v1.0.2-gobernanza/18-validacion-identidad-lifecycle/` | corrección del lifecycle e identidad tras la adopción |
| 19-planificacion-producto-v2 | `2b25ed3` | v2.0.0 | producto | `runs/v2.0.0-producto/19-planificacion-producto-v2/` | planificación aprobada para la futura línea funcional v2; no es release publicada |

Los contenidos de las evidencias no se reescriben. Las rutas de manifiestos y
metadatos operativos se actualizan sólo para reflejar su ubicación actual.

## Límites de la evidencia histórica

La unidad 08 aparece en el historial del producto, pero no tiene carpeta de
run; no se crea una evidencia retroactiva. La unidad 10 conserva su contenido
histórico aunque no contiene `test-report-1.md`. La unidad 13 no contiene
`spec.md`, aunque una decisión histórica lo menciona. Estas ausencias se
declaran explícitamente y no se rellenan con archivos inventados.

La normalización conserva los archivos y sus contenidos. Sólo cambia rutas de
manifiestos o referencias operativas actuales; las menciones dentro de actas
históricas se conservan como hechos de su momento.

## Cierre verificado

Las unidades 17, 18 y 19 permanecen CLOSED; sus metadatos de lifecycle se
reconcilian con el cierre registrado en ROADMAP sin reabrir ni alterar su
contenido funcional. La unidad 20 no tiene run y continúa sin iniciar.

La unidad 17 conserva deliberadamente en su `work-unit.json` los campos
históricos `lifecycle: ACTIVE` y `workingTreeDirty: true`. Su
`lifecycle.json` es la fuente histórica de cierre y la validación admite esa
excepción documentada; no se modifica el manifiesto para no falsificar el
estado registrado durante la adopción. Las unidades 18 y 19 sí tienen ahora
metadatos de lifecycle CLOSED completos y coherentes con ROADMAP.

## Auditoría independiente de la normalización

La auditoría final se ejecutó con OpenCode, modelo `opencode-go/gpt-5.6-luna`,
variante `medium`, agente Reviewer, modo solo lectura, MCP deshabilitado y sin
acciones remotas. Se conservaron cuatro intentos: los intentos 1–3
identificaron y guiaron correcciones; el intento 4 emitió `status: approved`
con `critical: 0`, `high: 0`, `medium: 0` y `low: 0`. El veredicto cubre el
estado final documentado aquí.
