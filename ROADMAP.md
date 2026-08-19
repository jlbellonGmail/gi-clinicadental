# Roadmap: gi-clinicadental (Savia Dental)

Cada feature nueva se implementa siguiendo el circuito agéntico de
[AGENTS.md](AGENTS.md): Analyst → Reviewer → Builder → QA →
`[-] READY_FOR_PR` → PR → CI verde → HITL (único punto de aprobación
humana) → Merge → `[x]`, con su carpeta de evidencia en
`runs/<NN>-<slug>/` y su documentación en `docs/tecnica/<slug>.md` +
`docs/usuario/<slug>.md`.

Este archivo refleja el estado **verificado** del proyecto (código
real, no expectativas). No se marca `[x]` antes del merge a `develop`.

## Propósito del producto

Sitio web de captación de pacientes para Savia Dental (clínica dental):
landing page informativa + formulario de contacto/leads, con el
objetivo final de que cada lead completado llegue realmente a la
clínica (email, CRM o base de datos — a definir).

---

## Estado actual verificado (2026-08-19)

No había Git inicializado hasta esta migración. El repo llegó como 3
archivos sueltos (`index.html`, `style.css`, `script.js`): una landing
page completa y funcional **a nivel visual**, verificada por lectura
directa del código:

- Hero, stats, 6 tarjetas de servicios, sección de equipo, formulario de
  contacto (nombre/email/servicio/mensaje), footer.
- Scroll suave, efecto de header, animaciones de aparición al hacer
  scroll — todo funcional (JS vanilla sin dependencias, salvo Font
  Awesome por CDN para íconos).

Gaps verificados (ver [docs/tecnica/landing.md](docs/tecnica/landing.md)
para el detalle):

- **El formulario de contacto está simulado** (`setTimeout` en
  `script.js`, comentario literal `// Simulate API call`): ningún lead
  se guarda ni se envía a ningún lado. Es el gap más importante para un
  MVP operable real.
- 3 imágenes referenciadas en `index.html` no existen en el repo
  (rotas).
- Datos de contacto (teléfono, dirección, email) y enlaces de footer
  son placeholders de plantilla, no verificados como reales.

No hay backend, no hay tests de producto, no había CI. Se preservó el
código existente sin modificarlo (commit baseline
`chore(baseline): landing page estática existente`), y se agregó el
circuito AI-Native encima.

---

## Backlog (circuito `AGENTS.md`)

- [ ] 01-formulario-leads-real — Conectar `#leadForm` a un destino real
      (definir en la spec: email transaccional, CRM o base de datos +
      validación server-side + qué pasa con los datos personales/de
      salud que se recolectan). Es el gap más crítico para que el sitio
      cumpla su propósito (captar pacientes reales, no simulados).
- [ ] 02-assets-y-contenido-real — Reemplazar las 3 imágenes rotas y
      verificar/actualizar los datos de contacto y enlaces de footer con
      información real del negocio (no se inventa contenido — requiere
      insumos del cliente real, ver "Reglas de dominio" en `AGENTS.md`).

## Cómo se usa este archivo

1. El humano mantiene el backlog: agrega, renombra o reordena items.
2. Ningún item se marca `[x]` antes del merge a `develop`.
3. Después de QA aprobado, la automatización cambia `[ ]` → `[-]` en la
   rama de la feature (`scripts/ready-for-pr.ps1`) y lo lleva dentro de
   la PR.
4. Después del merge, GitHub Actions ejecuta
   `post-merge-close-feature.yml`, que invoca `scripts/close-feature.ps1`
   desde `develop` para cambiar `[-]` → `[x]`, commitear y pushear a
   `origin/develop`.
5. Al arrancar una feature se usa el número/slug de este archivo para
   crear `runs/<NN>-<slug>/` y la rama `feature/<NN>-<slug>` (en worktree
   propio bajo `../worktrees/<slug>/`).

**Patrón del ítem**: `NN` (dos dígitos, numeración secuencial), `slug` en
minúsculas con guiones, seguido de `—` y descripción corta en español.
