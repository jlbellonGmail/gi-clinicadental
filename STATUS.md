# Estado operativo

Versión de release: `1.0.2`
Versión funcional del producto: `1.0.1` (sin cambios de comportamiento)
Unidades: `17-adopcion-template-v2`, `18-validacion-identidad-lifecycle` y `19-planificacion-producto-v2` (CLOSED)
Rama/worktree: eliminados tras integración y verificación
Base de esta unidad: `develop@35737852297ee7d02c7f2e8023d1ff4e5b423b46`
Template adoptado: `v2.0.0@f5d4b6cc029c34c0d0c05831bfd28134276fa167`

Estado: transición Template v2 y planificación funcional v2 cerradas; unidad `19-planificacion-producto-v2` CLOSED. La estructura histórica de `runs/` está normalizándose por versión; no se inició la unidad 20.
Validaciones históricas de transición: pytest 165/165 y npm test 337/337 en CI/entorno validado; en esta unidad npm test 337/337 y pytest local 145/165 con 20 fallos ambientales de serialización PowerShell, no declarados PASS.
Auditoría independiente OpenCode de unidad 18: APPROVED; critical/high/medium/low = 0.
Merges: PR #54 hacia develop, PR #55 (`542082e...`), PR #56 hacia main (`374bf99...`), PR #57 hacia main (`91cce2e6085b75c741715a86399a3be08e0d15ed`) y PR #58 hacia develop (`f09e718cc66bc59b7ea5492205bc1224743634a0`).
ROADMAP: unidad 17 cerrada mediante `b244c98`; unidad 18 cerrada mediante `44ca679...`.
Release: tag anotado `v1.0.2` sobre `91cce2e6085b75c741715a86399a3be08e0d15ed`; base de tooling, no versión del producto v2.
Deployment: Preview de PR #57 y PR #58 completados; no hay evidencia de un deployment Production registrado por GitHub y no se ejecutó despliegue manual.
Próximo paso: diseñar y aprobar el alcance de `20-fundacion-tenancy-identidad`; sin funcionalidad de producto v2 implementada.

No se modificaron infraestructura, secretos, esquema de datos ni comportamiento del producto.
