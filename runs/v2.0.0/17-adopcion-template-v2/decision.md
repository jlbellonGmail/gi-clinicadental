# Decisiones de adopción

- Se usa `Feature` sin versión de producto: `Maintenance` requiere una versión
  SemVer y representaría una línea de mantenimiento del producto, lo que no
  corresponde a tooling.
- `v2.0.0` aparece sólo en la ruta histórica/procedencia de la unidad; no cambia
  `package.json`, tags ni releases.
- Se mantiene el contrato legacy para runs existentes y se usa `.agentic` como
  única fuente normativa para unidades nuevas.
- MCP queda vacío y no se crean Skills.
- El merge, push, PR, despliegue, tags y releases permanecen fuera de esta fase.

## Cómputo de intentos

`attempt 7` identifica el séptimo artefacto/ciclo de auditoría independiente
OpenCode, no siete reintentos técnicos de npm. El contador no se reinició.
La convergencia FULL ejecutó iteraciones 1 y 2 con hallazgos y la iteración 3
terminó `FAILED_SAFELY`/`BLOCKED` por gates externos pendientes. Las
correcciones se hicieron entre ciclos Builder–Reviewer; el Reviewer final fue
APPROVED con cero hallazgos de implementación.
