# Decision: 18-validacion-identidad-lifecycle

- Se usa `Feature` con identificador `18-validacion-identidad-lifecycle`;
  no representa una versión ni cambia el producto `1.0.1`.
- ROADMAP identifica la unidad por el identificador completo. No se eliminan
  prefijos ni se deducen equivalencias.
- La validación de manifiestos es estricta; la ausencia de manifiesto sólo
  conserva el comportamiento histórico para unidades antiguas.
- Para un manifiesto histórico cerrado, `lifecycle.json` es la fuente del
  estado de cierre; se valida su `unitId` y `branch`, y se tolera únicamente
  que el manifiesto conserve `ACTIVE`, como ocurre en la unidad 17 preservada.
- El run debe estar dentro de `runs/` y su carpeta debe corresponder
  exactamente al `runPath` declarado.
- Convergencia: se conservaron los intentos 1–9; los intentos 1–8 fueron
  rechazados con correcciones entre iteraciones y el intento 9 fue APPROVED.
- Verificación local final: pytest 163 passed, pruebas focalizadas 14 passed y
  scanner de identidades PASS. CI remoto y cierre post-merge quedan pendientes
  hasta una eventual publicación/integración autorizada.
