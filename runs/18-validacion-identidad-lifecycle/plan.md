# Plan

- ASSESS: HIGH/FULL por afectar scripts de lifecycle y workflows.
- Crear un validador común y conectarlo al gate READY_FOR_PR, al cierre y CI.
- Mantener fallback explícito para unidades históricas sin manifiesto.
- Probar casos válidos, divergentes, ambiguos, contradictorios, rutas fuera de
  `runs/` e idempotencia.
