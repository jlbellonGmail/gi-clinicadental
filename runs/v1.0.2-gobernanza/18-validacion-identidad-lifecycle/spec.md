# Spec: 18-validacion-identidad-lifecycle

Implementar una resolución común de identidad para el gate previo a PR y el
cierre post-merge. El identificador completo de etapa debe coincidir
exactamente entre ROADMAP, rama, `unitId`, `canonicalSlug` y `runPath`.

La unidad debe conservar compatibilidad con etapas históricas sin manifiesto,
rechazar identidades ausentes, ambiguas, contradictorias o fuera de `runs/`,
y añadir pruebas aisladas que demuestren que un rechazo no escribe ni limpia.

## Criterios de aceptación

- El gate previo rechaza divergencias antes de escribir ROADMAP.
- El cierre vuelve a validar antes de escribir o limpiar.
- Un `runPath` absoluto, fuera de `runs/`, con basename incorrecto o con
  manifiesto alternativo es rechazado.
- Identidades ausentes, ambiguas y contradictorias son rechazadas sin cambios.
- Se conservan `NN-slug`, `vX.Y.Z-slug` y el fallback de unidades históricas
  sin manifiesto; no se exige manifiesto retroactivo a unidades cerradas.
- Se entregan `docs/tecnica/validacion-identidad-lifecycle.md`,
  `docs/usuario/validacion-identidad-lifecycle.md`, `decision.md`,
  `audit-N.md`, `test-report-N.md` y sus enlaces exactos en ambos índices.
