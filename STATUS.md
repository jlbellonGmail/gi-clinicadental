# Estado operativo

Versión de release: `1.0.2`
Versión funcional del producto: `1.0.1` (sin cambios de comportamiento)
Unidades: `17-adopcion-template-v2` y `18-validacion-identidad-lifecycle` (CLOSED)
Rama/worktree: eliminados tras integración y verificación
Base: `develop@28d27456fc802710231e21386e83fc6d920c58ef`
Template adoptado: `v2.0.0@f5d4b6cc029c34c0d0c05831bfd28134276fa167`

Estado: transición Template v2 cerrada; base estable publicada para planificar el producto v2.
Validaciones: pytest 165/165, npm test 337/337 y CI remoto de PR #55/56 PASS.
Auditoría independiente OpenCode de unidad 18: APPROVED; critical/high/medium/low = 0.
Merges: PR #54 hacia develop, PR #55 (`542082e...`), PR #56 hacia main (`374bf99...`), PR #57 hacia main (`91cce2e6085b75c741715a86399a3be08e0d15ed`) y PR #58 hacia develop (`f09e718cc66bc59b7ea5492205bc1224743634a0`).
ROADMAP: unidad 17 cerrada mediante `b244c98`; unidad 18 cerrada mediante `44ca679...`.
Release: tag anotado `v1.0.2` sobre `91cce2e6085b75c741715a86399a3be08e0d15ed`; base de tooling, no versión del producto v2.
Deployment: Preview de PR #57 y PR #58 completados; no hay evidencia de un deployment Production registrado por GitHub y no se ejecutó despliegue manual.
Próximo paso: planificar funcionalmente el producto v2, sin funcionalidad aprobada todavía.

No se modificaron infraestructura, secretos, esquema de datos ni comportamiento del producto.
