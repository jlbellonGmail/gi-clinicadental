# Validación de identidad del lifecycle

La identidad completa de una unidad es el identificador de etapa (`NN-slug`
o `vX.Y.Z-slug`). Debe ser idéntico en la entrada de ROADMAP, `unitId`,
`canonicalSlug`, el identificador de la rama y el último componente de
`runPath`. Las unidades históricas sin manifiesto conservan el contrato
anterior; las unidades con manifiesto se validan antes de escribir o limpiar.
