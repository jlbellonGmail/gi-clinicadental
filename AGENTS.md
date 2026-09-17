# Proyecto: gi-clinicadental

## Adopción operativa de Template v2.0.0

Las unidades nuevas usan `.agentic/` como fuente canónica de roles, modelos,
MCP y schemas. Los roles canónicos son Planner, Builder y Reviewer; los
artefactos y scripts legacy se conservan únicamente para leer y cerrar runs
históricos. La convención canónica para una unidad nueva es
`runs/<version>-<tipo>/<NN>-<slug>/`, con `tipo` `producto` o `gobernanza`;
la rama continúa siendo `feature/<NN>-<slug>` para hitos. Las correcciones de
mantenimiento conservan `feature/vX.Y.Z-<slug>` y se clasifican bajo
`runs/vX.Y.Z-<tipo>/<NN>-<slug>/`. La adopción histórica 17 se normaliza como
`runs/v1.0.2-gobernanza/17-adopcion-template-v2/`.

`CONSTITUTION.md` contiene principios estables y `STATUS.md` resume la
reentrada. ASSESS determina de forma reproducible LIGHT, STANDARD o FULL;
esta adopción es FULL por afectar automatización, gobernanza y CI. El Reviewer
permanece independiente y el merge sigue requiriendo decisión humana.

La compatibilidad legacy no habilita una segunda normativa: sus nombres son
aliases de migración y sus runs no se reescriben. MCP queda vacío y no se
crean Skills durante esta adopción.

Sitio web de captación de pacientes para una clínica dental: landing
page informativa con formulario de contacto/leads. El frontend continúa
siendo HTML/CSS/JS sin framework ni build; el backend actual de captación
es una función serverless Node en `api/leads.js` respaldada por Supabase y
correo SMTP. La evolución integral de gestión clínica sigue siendo futura
(ver "Estado actual" en `ROADMAP.md`).

## Stack

- Frontend: HTML5 + CSS3 + JavaScript vanilla, sin framework ni proceso de build (`index.html`, `style.css` y `script.js` en la raíz del repositorio).

- Backend objetivo: funciones Serverless de Node.js que se implementarán y desplegarán en Vercel. El endpoint principal de captación será `POST /api/leads`, implementado dentro de `api/`. La lógica del servidor deberá permanecer separada del frontend y nunca exponer credenciales privadas.

- Base de datos objetivo: Supabase PostgreSQL. La tabla principal será `leads` y su estructura se administrará mediante migraciones SQL declarativas y versionadas dentro del repositorio. El acceso de escritura se realizará exclusivamente desde el backend mediante la clave secreta almacenada en Vercel.

- Integración Supabase: cliente oficial `@supabase/supabase-js`. La clave pública podrá utilizarse en el frontend solamente cuando resulte necesario y esté protegida mediante RLS. La clave secreta o `service_role` será de uso exclusivo del backend.

- Correo transaccional: Nodemailer conectado al servidor SMTP de Ferozo mediante TLS. Enviará la notificación interna a la clínica y la confirmación de recepción al paciente. Las credenciales SMTP se consumirán exclusivamente desde variables de entorno de Vercel.

- Hosting: Vercel. `develop` se utilizará para integración y despliegues Preview; `main` será la rama estable asociada al despliegue Production.

- Variables de entorno: administradas en Vercel para los entornos Preview y Production. `.env.example` documentará solamente los nombres requeridos y valores ficticios o vacíos. Ninguna credencial real deberá incorporarse al repositorio.

- CI/CD: GitHub Actions ejecutará las verificaciones del circuito y los tests del producto. La integración Git nativa de Vercel generará despliegues Preview para las Pull Requests y desplegará a Production después del merge autorizado hacia `main`.

- Documentación: MkDocs Material. La documentación técnica y de usuario permanecerá separada del sitio público desplegado en Vercel. **Publicación en GitHub Pages: no disponible en este entorno** (repositorio privado con el plan actual — ver "Setup manual"). `docs.yml` construye la documentación en modo estricto y deja el sitio como artefacto descargable de la corrida; el deploy se omite solo y se reactiva sin tocar el workflow el día que Pages esté disponible.

- Testing: pytest continuará validando los scripts del circuito agéntico. A medida que se incorporen el backend y las integraciones se agregarán pruebas de producto para la API, validaciones, Supabase, SMTP, seguridad y flujo end-to-end.

## Estructura del repo

- `index.html`, `style.css`, `script.js`: la landing page, tal cual
  existía antes de adoptar este circuito. No se reestructura ni se mueve
  a una subcarpeta en esta migración (fuera de alcance).
- `runs/`: artefactos por feature (`spec.md`, `audit-N.md`,
  `test-report-N.md`, `decision.md`). No es código de producción, es
  historial del circuito.
- `docs/tecnica/`: un `.md` por área/feature, nombrado solo con el slug
  sin número (ej. `landing.md`, no `01-landing.md`), con decisiones de
  diseño y casos borde. Para quien mantiene el código.
- `docs/usuario/`: un `.md` por área/feature, mismo slug, con el
  propósito y cómo usarlo. Para quien consume el sitio o lo administra.
- `tests/`: pytest de los scripts del circuito (`scripts/*.ps1`). Se
  agregará `tests/` de producto (frontend o backend) cuando exista algo
  real que testear — no antes.
- `scripts/`: motor ejecutable del circuito agéntico (`scripts/*.ps1`,
  ver más abajo). No hay scripts operativos de producto todavía.

## Workflow del proyecto — circuito agéntico sin HITL intermedio

Este documento define cómo se ejecuta cualquier feature en este repo. Es
leído por todos los agentes al arrancar sesión, sea Claude Code, opencode o
Codex. No es negociable por ningún agente individual: si un agente cree que
debe saltarse un paso, debe decirlo explícitamente en su output, no
saltarlo en silencio.

El circuito tiene un solo punto de intervención humana: la decisión final
sobre la PR ya creada y con CI verde. Esa decisión es binaria: `MERGE` o
`NO MERGE`. No hay checkpoints humanos antes de crear la PR.

Cada uno de los 4 agentes corre como **subagente**, invocado puntualmente
para su etapa. Esto mantiene el contexto principal limpio: el subagente
hace su tarea, entrega su artefacto en `runs/`, y termina.

## Circuito

El contrato mínimo de artefactos vive en una sola fuente ejecutable:
`scripts/feature-contract.ps1`. Los prompts de Codex, Claude Code y
opencode pueden recordar el contrato, pero no deben duplicar validaciones:
deben invocar los scripts comunes. El contrato exige, según etapa:
`spec.md`, `decision.md`, `audit-N.md`, `test-report-N.md`,
`docs/tecnica/<slug>.md`, `docs/usuario/<slug>.md`, un enlace exacto en
`docs/tecnica/index.md`, un enlace exacto en `docs/usuario/index.md`,
estado correcto de `ROADMAP.md`, rama `feature/<NN>-<slug>`, PR contra
`develop` y CI verde.

1. `analyst-agent` (read-only, subagente, sesión nueva) → produce `spec.md`.
   El spec SIEMPRE debe incluir como criterios de aceptación la creación
   de `docs/tecnica/<slug>.md`, `docs/usuario/<slug>.md`,
   `runs/<version>-<tipo>/<NN>-<slug>/decision.md`, y enlaces exactos en
   `docs/tecnica/index.md` y `docs/usuario/index.md`.
2. `reviewer-agent` (read-only, subagente, sesión nueva) → produce
   `audit-N.md` con veredicto `approved` o `rejected`. Rechaza
   automáticamente si el spec no exige los dos `.md` de documentación.
   - Si `rejected` → vuelve a 1 con el feedback. La corrección sigue en
     el circuito agéntico; no hay checkpoint humano intermedio.
3. Si `approved` → `builder-agent` (write, subagente, en worktree propio)
   → implementa el código Y escribe `docs/tecnica/<slug>.md` y
   `docs/usuario/<slug>.md` como parte de terminar la feature, no aparte.
   También crea `runs/<version>-<tipo>/<NN>-<slug>/decision.md` con decisiones demostrables
   desde spec/auditoría/implementación, y ejecuta
   `scripts/update-doc-indexes.ps1 <NN>-<slug> "<Titulo>"`.
4. `qa-agent` (write, subagente, mismo worktree) → corre tests (pytest y
   cualquier verificación real del sitio, ej. abrir en navegador si
   corresponde), verifica que el contrato común pase con
   `Assert-FeatureContract` (docs, decision, auditoría, reporte e
   índices), produce `test-report-N.md`.
   - Si falla (código o documentación faltante) → vuelve a 3 con el
     reporte. La corrección sigue en el circuito agéntico; no hay
     checkpoint humano intermedio.
5. Si QA aprueba → actualizar `ROADMAP.md` al estado `[-] READY_FOR_PR`
   para esa feature, sin marcar `[x]`, y commitear ese cambio en la rama
   de la feature. Script recomendado:
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ready-for-pr.ps1 <NN>-<slug>`.
6. Push de la rama de feature y creación automatizada de PR hacia
   `develop` (`gh pr create`). La PR debe incluir evidencias completas:
   resumen de cambios, resultados de tests, auditoría, checklist de
   aceptación, riesgos y enlaces a spec/docs.
7. Verificar que el CI de la PR corre en verde antes de pedir decisión
   humana. Script recomendado:
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\wait-pr-ci.ps1`.
8. **Único HITL:** el humano revisa la PR y sus evidencias completas y
   decide `MERGE` o `NO MERGE`.
   - Si decide `NO MERGE` → vuelve a 3 con observaciones concretas para
     que `builder-agent` corrija la implementación o, si corresponde, la
     spec.
   - Si decide `MERGE` → la PR se mergea a `develop` en GitHub.
9. **Cierre automático post-merge remoto:** GitHub Actions dispara
   `.github/workflows/post-merge-close-feature.yml` cuando una PR hacia
   `develop` se cierra como mergeada. El workflow corre código confiable
   de la rama base (`develop`) e invoca la lógica común:
   `scripts/close-feature.ps1 -Slug <NN>-<slug> -PrNumber <n> -SkipLocalCleanup`.
   Este script:
   - confirma con GitHub que la PR está `MERGED` y que su base es
     `develop`;
   - cambia al checkout principal de `develop` y sincroniza con
     `origin/develop`;
   - valida que `ROADMAP.md` tenga exactamente una entrada
     `[-] <NN>-<slug>` o exactamente una entrada `[x] <NN>-<slug>` si es
     una reejecución;
   - cambia exclusivamente `[-] <NN>-<slug>` a `[x] <NN>-<slug>`;
   - commitea y pushea ese cambio directo a `develop` solo si había cierre
     pendiente;
   - valida después del push que `origin/develop:ROADMAP.md` contiene
     exactamente una entrada `[x] <NN>-<slug>` y ninguna `[-] <NN>-<slug>`;
   - en modo local, recién entonces borra el worktree y la rama local de
     la feature ya mergeada;
   - en modo GitHub Actions, omite limpieza local porque un runner remoto
     no puede borrar worktrees del equipo del usuario.

Este último paso es la única automatización que toca `develop`
directamente, y es intencional que viva fuera de cualquier worktree.
GitHub y la PR mergeada son la fuente de verdad del cierre: si la feature
no está mergeada a `develop`, `close-feature.ps1` no debe marcar `[x]`.
El cierre post-merge tiene una sola implementación común:
`scripts/close-feature.ps1`. Codex, Claude Code y opencode no duplican esa
lógica en sus directorios propios; solo deben invocar ese script.

La limpieza local es una reconciliación separada: `ready-for-pr.ps1`
inicia `scripts/start-local-reconciler.ps1`, que observa
`origin/develop:ROADMAP.md` y solo elimina worktree/rama cuando ya existe
exactamente una entrada `[x] <NN>-<slug>` y ninguna `[-]`. Si el equipo o
el agente se cierran, la próxima ejecución del circuito puede relanzar el
reconciliador; la actualización remota de `ROADMAP.md` no depende de esa
limpieza.

## Retornos permitidos

- `reviewer-agent` → `analyst-agent` cuando el spec es `rejected`.
- `qa-agent` → `builder-agent` cuando QA falla.
- `HITL final` → `builder-agent` cuando la decisión es `NO MERGE`.

Cualquier otro retorno o pedido de intervención humana rompe el circuito y
debe declararse como excepción, no ejecutarse en silencio.

## Estados de ROADMAP.md

- `[ ]` pendiente: la feature no está cerrada.
- `[-]` `READY_FOR_PR`: implementación, documentación y QA aprobados; la
  PR existe o está lista para crearse; CI pendiente o verde; falta decisión
  final de merge.
- `[x]` completado: solo después de que la PR fue mergeada a `develop` y
  el cierre post-merge marcó el roadmap automáticamente.

Regla dura: `ROADMAP.md` no se marca `[x]` antes del merge. Antes del
merge solo puede quedar pendiente `[ ]` o `READY_FOR_PR` `[-]`.

## Git

- Rama base de trabajo diario: `develop`
- Rama de producción: `main` — solo recibe merges desde `develop` vía PR,
  cuando se decide hacer un release (no en cada feature)
- Releases de mantenimiento sobre una version ya liberada:
  `feature/v<X.Y.Z>-<slug>`, con `runs/v<X.Y.Z>-<slug>/`. Siguen el mismo
  circuito y el mismo contrato que un hito; existen para que una
  correccion sobre lo publicado no consuma un numero de hito reservado
  a otra cosa en el roadmap.
- Cada feature: `feature/<NN>-<slug>`, en su propio `git worktree` bajo
  `../worktrees/<slug>/` — esto habilita correr varios circuitos en
  paralelo sin pisarse
- Nunca commitear directo a `develop` (salvo el cierre automatizado de
  `ROADMAP.md`, ver paso 9) ni nunca directo a `main`
- La PR hacia `develop` se crea automáticamente después de QA aprobado.
- El humano no abre la PR ni hace checkpoints previos: solo decide
  `MERGE` o `NO MERGE` con la PR y sus evidencias a la vista.

## Versionado (tags)

- Cada release a `main` se marca con un tag `vX.Y.Z` (SemVer:
  major.minor.patch), pusheado por el humano después de mergear a `main`
  (`git tag vX.Y.Z && git push origin vX.Y.Z`).
- Los agentes nunca crean tags — es una decisión del humano, en el momento
  de release hacia `main`.
- El sitio está alojado en Vercel. Los despliegues Preview se generan desde
  Pull Requests y ramas de integración. Production se actualiza exclusivamente
  desde `main` después del HITL correspondiente.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): corre `pytest` sobre `tests/`
  (tests del circuito) en cada push/PR a `develop` o `main`. Gate
  obligatorio antes de mergear cualquier PR (paso 7 del circuito). Se
  amplía a tests de producto (frontend/backend) cuando exista algo real
  que testear.
- **Docs** (`.github/workflows/docs.yml`): se dispara al pushear a `main`
  con cambios en `docs/` o `mkdocs.yml`, y a demanda con
  `workflow_dispatch`. Construye el sitio MkDocs con `mkdocs build
  --strict` (la documentación del circuito, no la landing page en sí, que
  se sirve por separado). **El build es obligatorio y falla la corrida si
  la documentación no compila; el deploy a GitHub Pages es opcional y hoy
  se omite**, porque Pages no está disponible en este repositorio (ver
  "Setup manual"). El sitio queda como artefacto `mkdocs-site` de la
  corrida. El job de deploy se salta —`skipped`, no rojo— mientras la API
  de Pages no responda que está habilitada.
- **Post-merge close** (`.github/workflows/post-merge-close-feature.yml`):
  ver paso 9 del circuito.
- **Release**: pendiente (ver sección Versionado). No hay `Dockerfile` ni
  `release.yml` todavía.

## Herramientas locales requeridas

- Windows PowerShell (`powershell.exe`) para los scripts de automatización
  en `scripts/*.ps1`.
- Git (`git`) para ramas, worktrees, commits, push y verificación de merge.
- GitHub CLI (`gh`) instalado, en `PATH` y autenticado para crear PRs,
  consultar estado de PR mergeada y esperar checks de CI.
- Python 3.12+ con `pytest` instalado (`pip install -r requirements-dev.txt`)
  para correr los tests del circuito.

## Artefactos

Cada ciclo de feature genera su carpeta en `runs/<version>-<tipo>/<NN>-<slug>/` con:

- `spec.md`
- `audit-N.md` (uno por intento del reviewer-agent)
- `test-report-N.md` (uno por intento del qa-agent)
- `decision.md` (archivo canónico obligatorio con decisiones demostrables
  y evidencia de cierre/merge; no debe quedar vacío ni ornamental)

Ningún agente sobreescribe el artefacto de otro. Cada intento se numera.
El número y slug de cada feature sale de `ROADMAP.md`.

## Formato de veredicto

`reviewer-agent` y `qa-agent` deben abrir su output con un bloque YAML así,
antes de cualquier prosa:

```yaml
status: approved | rejected
attempt: <n>
feedback:
  - punto concreto 1
  - punto concreto 2
```

## Configuración de modelos (Claude Code, opencode, Codex)

Para opencode, `model`, `reasoningEffort` y `permission` de cada agente NO
están en `.opencode/agent/*.md` — viven centralizados en `opencode.json`.
Los `.md` de opencode solo tienen `description` y `mode`; el rol/prompt es
igual al de Claude Code. Motivo: así cambiar de proveedor es editar una
sola línea en `opencode.json`, sin tocar los 4 archivos de rol. El modelo
configurado en `opencode.json` es un valor de ejemplo — ajustarlo al
proveedor real disponible antes de usar opencode en este repo.

Para Claude Code, `model` y `effort` sí quedan en el frontmatter de cada
`.claude/agents/*.md`, porque Claude Code no tiene un mecanismo
equivalente de override centralizado por agente.

Para ejecutar el circuito completo hasta `git push`, creación de PR,
consulta/espera de CI y cierre post-merge, Claude debe correr como
Claude Code en un entorno con permisos reales sobre el repo Git y GitHub.

Para Codex, la configuración nativa del repo vive en `.codex/`. Ese
directorio se usa como `CODEX_HOME` reproducible del proyecto:

- `.codex/config.toml`: defaults comunes de Codex.
- `.codex/<role>.config.toml`: perfil por agente, invocado con
  `codex exec -p <role>`.
- `.codex/prompts/<role>.md`: prompt mínimo específico del rol.

Ejemplo desde PowerShell, ejecutado por el Main Agent al delegar:

```powershell
$env:CODEX_HOME = (Resolve-Path .\.codex).Path
Get-Content .\.codex\prompts\analyst-agent.md -Raw | codex exec -p analyst-agent -C . -
```

Los perfiles Codex fijan modelo y esfuerzo; las reglas comunes del
circuito siguen viviendo en este `AGENTS.md`, para evitar duplicación.

## Reglas adicionales

Ver `.claude/rules/` para instrucciones modulares por dominio
(accesibilidad, SEO, estilo de contenido médico/legal si aplica). Vacío
por ahora — se completa a medida que el proyecto lo necesite, no de
entrada. opencode las lee vía el campo `instructions` de `opencode.json`.
Si `.claude/rules/` deja de estar vacío, Codex debe referenciar esas
reglas desde `.codex/prompts/*.md`.

## Reglas de dominio (no negociables por ningún agente)

- No inventar información médica/clínica no provista (tratamientos,
  precios, certificaciones, testimonios) — el contenido del sitio debe
  venir del cliente/negocio real, no generarse por el agente.
- No conectar el formulario de contacto a un endpoint real sin que el
  spec de esa feature declare explícitamente a dónde van los datos
  (email, CRM, base de datos) y qué validación/consentimiento aplica
  (datos de salud/contacto personal).
- No agregar un backend, base de datos o dependencia de build sin que
  quede como una decisión de arquitectura explícita en
  `docs/tecnica/arquitectura.md`.

## Setup manual (una sola vez, no automatizable)

- **GitHub Pages**: **no disponible en este repositorio, y es una decisión
  del proyecto, no un pendiente.** Verificado el 2026-09-04: el repo es
  privado y el plan actual no incluye Pages — Settings → Pages muestra
  *"Upgrade or make this repository public to enable Pages"* y
  `GET /repos/<owner>/<repo>/pages` devuelve 404. **No se cambia la
  visibilidad del repositorio ni el plan.**

  Por eso `docs.yml` está diseñado para funcionar sin Pages: construye con
  `mkdocs build --strict` (gate obligatorio) y publica el sitio como
  artefacto `mkdocs-site` de la corrida, que es de donde se descarga la
  documentación mientras la limitación siga vigente. El job de deploy
  consulta la API de Pages y se salta solo si no está disponible, de modo
  que `main` nunca queda en rojo por este motivo.

  **Si algún día Pages se habilita** (repo público o plan que lo incluya),
  no hay que tocar el workflow: basta con
  Settings → Pages → Build and deployment → Source = "GitHub Actions", y
  el job de deploy empieza a ejecutarse en la siguiente corrida.

  Contexto completo en `docs/tecnica/validacion-mvp-produccion.md` y
  `runs/v1.0.0-producto/16-validacion-mvp-produccion/decision.md`.
- **Rama `develop`**: se crea en esta misma migración a partir de `main`
  (que contiene el baseline de la landing page existente). Quedan
  sincronizadas hasta la primera feature nueva.
