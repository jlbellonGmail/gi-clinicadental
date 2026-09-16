# Spec — adopción operativa de Template v2.0.0

## Objetivo

Adoptar la gobernanza, roles, evidencias, SDD adaptativo, lifecycle y gates de
Template v2.0.0 sobre `develop@28d27456fc802710231e21386e83fc6d920c58ef`,
preservando el producto 1.0.1, su historial y sus reglas de privacidad.

## Alcance y restricciones

La unidad es Feature de tooling: `17-adopcion-template-v2`. `version` queda
vacío; `v2.0.0` es sólo procedencia y ruta de evidencia. No hay cambios de
producto, releases, despliegues, MCP, Skills ni infraestructura remota.

## Aceptación

1. `.agentic` es la fuente canónica y sus adaptadores Claude, Codex y OpenCode
   son coherentes y comprobables.
2. ASSESS selecciona FULL para esta adopción; SDD, routing y convergence dejan
   evidencia JSON reproducible.
3. El lifecycle permite inspección/reconciliación segura en el worktree y
   rechaza cleanup sin PR mergeada y sin autorización.
4. CI conserva pytest/npm y añade integridad, adaptadores y supply chain sin
   permisos amplios ni efectos remotos.
5. La compatibilidad histórica permanece legible; nuevas unidades usan la
   ruta versionada sin dos fuentes normativas activas.
6. SUMMARY, decisión, rollback, test-report y auditoría reflejan resultados
   reales; `STATUS.md` mantiene la unidad ACTIVE.
7. La documentación técnica y de usuario y sus enlaces exactos existen.
