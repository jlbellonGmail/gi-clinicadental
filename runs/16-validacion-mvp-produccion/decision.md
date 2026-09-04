# Decision: 16-validacion-mvp-produccion — Validación del MVP en producción

## Estado

**Fase 2 en curso — pasos 1 a 6 completos.** Artefactos preparados en
`feature/16-validacion-mvp-produccion`, y las dos tandas de correcciones
pre-release construidas, probadas y ya integradas a `develop`:

| PR | Rama | Contenido | Estado |
|---|---|---|---|
| #21 | `release/v1.0.0-preparacion` | marca, Open Graph, `docs.yml` v1, versión 1.0.0 | mergeada, CI verde |
| #22 | `fix/docs-pages-no-disponible` | `docs.yml` sin dependencia de Pages, `AGENTS.md` | mergeada, CI verde |

**Candidato de release: `origin/develop` @ `74297a7`.**

Falta: completar el preflight (P3, P4 y P6 dependen de los paneles de
Vercel y Supabase), `audit-1` de OpenCode sobre el candidato, el release a
`main`, la validación real en Production, `audit-2`, HITL 2, tag y cierre.

`main` sigue intacto en `a034703`, sin tags, y `ROADMAP.md` en
`[ ] 16-validacion-mvp-produccion`.

Las dos PRs mergeadas son de **preparación del release** hacia `develop`,
no de esta feature: `feature/16` sigue sin PR y sin mergear, no hay tag, y
`ROADMAP.md` no tiene `[-]` ni `[x]`. Este archivo se completa a medida
que la secuencia avanza; no afirma ningún resultado que no esté
verificado.

## Evidencias

- `runs/16-validacion-mvp-produccion/spec.md` (plan aprobado en HITL 1,
  con los tres ajustes exigidos antes de autorizar la Fase 2)
- `docs/tecnica/validacion-mvp-produccion.md`
- `docs/usuario/validacion-mvp-produccion.md`
- Pendientes: `test-report-1.md`, `audit-1.md`, `test-report-2.md`,
  `audit-2.md`, `evidencia/`

## Decisiones demostrables

### Production no tenía MVP: el hallazgo que reordenó toda la etapa

No es una suposición de planificación, está verificado. `main` estaba en
`a034703` —el commit baseline de la landing estática—, **86 commits por
detrás de `develop`**. En Vercel había **un solo deployment `Production`**
en toda la historia del proyecto (`2026-08-19`, ref `1b7735c`), y ese
commit **no contiene `api/`, `package.json` ni `vercel.json`**.

Comprobado contra el sitio público `https://gi-clinicadental.vercel.app`:

| Comprobación | Resultado |
|---|---|
| `GET /api/leads` | **404** |
| `GET /politica-privacidad.html` | **404** |
| `script.js` | contenía `// Simulate API call` |
| Cabeceras de seguridad de `vercel.json` | ausentes |

El ítem 16 del roadmap pedía validar Production. Production servía un
sitio anterior al backend. **La validación era literalmente imposible sin
un release previo**, y ése es el motivo de que esta etapa incluya un
release y no sólo una batería de pruebas.

### La validación se hace en Production porque los Preview no son públicos

Los deployments Preview del proyecto están protegidos por Vercel
Authentication: tanto `…-git-develop-gi26.vercel.app` como el deployment
de `04e7644` devuelven `302 → vercel.com/sso-api`. Un Preview no
reproduce la experiencia de un paciente anónimo, así que no sirve para
validar el circuito público. **El único origen público del proyecto es
Production.**

Esto refuerza, no debilita, la decisión de la feature 14 de que sólo
`main` despliega a producción: el gate sigue siendo el mismo, lo que
cambia es que la validación no tiene alternativa a Production.

### `feature/16` no se mergea a `develop` hasta tener la evidencia

`post-merge-close-feature.yml` marca `[x]` en cuanto una rama
`feature/NN-slug` se mergea a `develop`. Mergear esta feature antes de
validar equivaldría a **declarar el MVP cerrado sin pruebas** — exactamente
lo que el ítem 16 existe para impedir.

Por eso la rama se mantiene sin mergear hasta el paso 17, y `ROADMAP.md`
permanece en `[ ]` durante todo el release. No es un descuido: es el
estado verdadero mientras la validación no ocurrió.

### Las correcciones pre-release viajan fuera del patrón `feature/NN-slug`

Consecuencia del punto anterior: las correcciones necesarias para el
release **no pueden** ir en `feature/16`, porque tienen que llegar a
`main` antes de la validación, y eso obligaría a mergear la feature
antes de tiempo.

Van en `release/v1.0.0-preparacion`, cuyo nombre **queda deliberadamente
fuera** del patrón que evalúa el workflow de cierre
(`^feature/([0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*)$`). Cuando no coincide, el
workflow imprime que no hay cierre automático y **se salta sin fallar**.
Así la PR de correcciones se mergea a `develop` sin dejar un workflow en
rojo y sin tocar `ROADMAP.md`.

Es el mecanismo que ya existía en el repo, usado a propósito, no un
rodeo improvisado.

### `audit-1` audita el candidato real, no el spec en abstracto

Ajuste exigido por el humano antes de aprobar HITL 1. Una auditoría del
spec previa a que exista el candidato no puede detectar lo que realmente
importa: qué árbol se va a mover a `main`.

`audit-1` se ejecuta sobre `origin/develop` **después** de integrar las
correcciones y **después** del preflight, es decir sobre el árbol exacto
que la PR `develop → main` va a mover. La PR de release no se crea hasta
que ese veredicto esté aprobado.

Para que el veredicto no caduque en silencio, `audit-1.md` registra el
`<SHA_CANDIDATO>` auditado y se verifica que `origin/develop` siga
apuntando a él antes de abrir la PR. Si cambió, la auditoría no vale para
el árbol nuevo y se repite el ciclo.

### OpenCode audita; Claude Code persiste

Separación estricta, exigida explícitamente por el humano:

- **Autor de la auditoría**: OpenCode, en **solo lectura**. No crea ni
  modifica `audit-1.md`, `audit-2.md` ni ningún otro archivo del
  repositorio. Únicamente devuelve el informe.
- **Persistencia del artefacto**: Claude Code, que escribe el informe
  **literal**, sin reinterpretar hallazgos, veredicto ni recomendaciones,
  sin resumir y sin corregir redacción.

Cada `audit-N.md` lleva cabecera de procedencia (autor, quién persiste,
fecha, SHA auditado, alcance) y a continuación el informe íntegro con su
bloque YAML. Cualquier respuesta de Claude Code va en este archivo, nunca
dentro del artefacto de auditoría.

Los reintentos se numeran (`audit-1-intento-N.md`) y `audit-1.md` /
`audit-2.md` quedan reservados al veredicto aprobado de cada etapa:
`AGENTS.md` prohíbe que un agente sobrescriba el artefacto de otro.

### El versionado npm toca dos archivos, no uno

`package.json` declaraba `"version": "0.1.0"` y `package-lock.json`
(`lockfileVersion: 3`) lo repetía en **dos lugares**: la raíz y el paquete
raíz `packages[""]`. Cambiar sólo `package.json` los deja
desincronizados y **`npm ci` falla por diseño** — que es justamente lo que
corre el CI.

Se usa `npm version 1.0.0 --no-git-tag-version`, que actualiza los tres
campos según la estructura real de ambos archivos. El flag
`--no-git-tag-version` es obligatorio: los agentes nunca crean tags
(`AGENTS.md`, sección Versionado), y `v1.0.0` está reservado al humano.

### La marca era bloqueante, no deuda aceptable

Se encontraron **17 ocurrencias de "Savia Dental"** —nombre de plantilla—
en los tres HTML públicos, mientras cabecera y pie ya decían "Sonríe más":
`index.html` (11, incluyendo `title`, `meta description`, Open Graph,
Twitter Card, un párrafo visible y el `alt` de las 3 imágenes),
`404.html` (2) y `politica-privacidad.html` (4).

El primer release estable es exactamente el momento en que eso deja de ser
un detalle interno y pasa a ser contenido público e indexable. Se corrige
antes de publicar, no después, y **sin abrir una feature 17**: es una
sustitución localizada dentro del alcance del release, no funcionalidad
nueva.

No se inventa denominación: "Sonríe más" ya está en el propio sitio, en
`mkdocs.yml` (`site_name`) y en el ítem 10 de `ROADMAP.md`. Las reglas de
dominio de `AGENTS.md` prohíben generar contenido institucional.

### No se reescribe la marca en artefactos históricos

`create_images.py` queda fuera (script de desarrollo, excluido del
deployment por `.vercelignore`). Y los `.md` de `docs/` y `runs/` que
citan "Savia" describiendo el estado de entonces **se dejan intactos**:
`AGENTS.md` prohíbe sobrescribir el artefacto de otro agente, y reescribir
evidencia pasada la falsearía. Un historial que se corrige a sí mismo deja
de ser historial.

### `docs.yml`: Pages no es un pendiente, es una limitación de entorno

Mi primera lectura fue que GitHub Pages "estaba deshabilitado" y que
bastaba con que un humano lo habilitara. **Era incorrecto, y lo corrijo
acá en vez de dejar la versión vieja en pie.** Pages **no está disponible**
en este repositorio: es privado y el plan actual no lo incluye. Settings →
Pages muestra *"Upgrade or make this repository public to enable Pages"*, y
`GET /repos/<owner>/<repo>/pages` devuelve 404. No es una casilla sin
marcar: es una restricción del entorno.

**Decisión del proyecto: no se cambia la visibilidad del repositorio ni el
plan.** Y decisión derivada: **Pages no bloquea el MVP.** Un MVP funcional
no puede quedar detenido por dónde se publica su documentación.

Lo que sí seguía siendo un problema real es que `docs.yml` se dispara con
`push` a `main` filtrando por `docs/**`, y el release lleva `docs/` a
`main` **por primera vez**: el workflow corre sí o sí en ese merge.
Cualquier variante que intentara publicar —`gh-deploy` o el flujo oficial
de Pages, da igual— habría dejado `main` en rojo el día del primer release
estable.

**Diseño adoptado: separar lo obligatorio de lo opcional.**

- `mkdocs build --strict` queda en el job `build`, **sin condición**.
  Sigue siendo el gate real de la documentación: si un enlace queda roto o
  falta una página, la corrida falla, haya Pages o no. Eso era innegociable.
- El job `build` **ya no contiene ningún paso de Pages**, así que no puede
  fallar por ese motivo. `configure-pages`, `upload-pages-artifact` y
  `deploy-pages` viven ahora sólo en el job `deploy`.
- El sitio se sube como artefacto **`mkdocs-site`** (14 días). Es el
  reemplazo práctico de la publicación mientras la limitación siga
  vigente: la documentación se descarga desde la corrida.
- Un paso consulta la API de Pages y expone `pages_disponible`; `deploy`
  corre sólo cuando vale `true`.

**El default seguro es NO publicar.** 404 (no habilitado), 403 (plan que
no lo incluye), un fallo de red, o incluso que el propio paso de detección
falle y no escriba salida: todos esos casos omiten el deploy. Un job
`skipped` no pone la corrida en rojo. Preferí un falso negativo —no
publicar pudiendo hacerlo— antes que un falso positivo que rompa `main`.

**Verificado empíricamente, no sólo afirmado**: corrida `33826977524`,
disparada con `workflow_dispatch` sobre `develop`, terminó
`completed/success` con `build: success`, `deploy: skipped` y el artefacto
`mkdocs-site` de 5.379.313 bytes. Es la prueba de que el release no va a
dejar `main` en rojo por este motivo.

**Sin deuda de mantenimiento**: si algún día Pages se habilita, no hay que
tocar el workflow. Basta con *Settings → Pages → Source = "GitHub
Actions"* y el job `deploy` empieza a correr en la siguiente corrida.

### `AGENTS.md` decía tres cosas que no eran ciertas

El contrato del circuito afirmaba, en tres lugares, que la documentación
se publica en GitHub Pages: en **Stack**, en **CI/CD** y en **Setup
manual**, este último pidiendo explícitamente *Settings → Pages → Source =
"GitHub Actions"*.

Ninguna de las tres se puede cumplir en este repositorio. **Dejar una
instrucción imposible en el contrato que todos los agentes leen al
arrancar es peor que corregirla**: el próximo agente la intentaría, o
peor, la daría por hecha. Las tres quedan reemplazadas por la descripción
real, con la condición exacta de reactivación.

### `og:url` apuntaba a un dominio que no resuelve (y no era una errata)

Corrección de una afirmación previa de este mismo documento. Al inspeccionar
`index.html` leí `og:url = https://sonrimas.com` como una errata de
`sonriemas`. **Es incorrecto**: `sonrimas.com` es el dominio institucional
declarado en la feature 10, coherente con `contacto@sonrimas.com` y con los
perfiles sociales del footer (`facebook.com/sonrimas`, etc.). Dato del
negocio, no tipeo.

El motivo real del cambio es otro, y está verificado: **el dominio no
resuelve** — no tiene registro A, y `curl https://sonrimas.com` devuelve
`000`. `og:url` apuntaba a un destino que hoy no sirve el sitio, de modo que
las tarjetas de redes sociales del primer release estable habrían enlazado a
la nada.

Se corrige a la URL canónica indicada por el humano,
**`https://gi-clinicadental.vercel.app`**, que es el único origen público del
proyecto. Beneficio lateral verificable: es el mismo valor que debe coincidir
exactamente con `SITE_URL` o `ALLOWED_ORIGINS` para que `isOriginAllowed()` no
rechace los envíos (preflight P4), así que la corrección alinea el metadato
público con la configuración del backend en vez de dejarlos divergentes.

Junto con `og:url` se corrigen `og:image` y `twitter:image`, hoy rutas
relativas cuando Open Graph exige URL absoluta.

**Deuda registrada**: cuando `sonrimas.com` se conecte a Vercel habrá que
actualizar juntos `og:url`, `og:image`, `twitter:image` y `SITE_URL`. Si se
cambia el dominio sin actualizar `SITE_URL`, el formulario empieza a devolver
`403 origen_no_permitido` y el frontend sólo muestra *"Error en la conexión"*,
que no distingue esa causa de una caída de red.

`contacto@sonrimas.com` y los perfiles sociales **no se tocan**: son datos
institucionales de la feature 10, fuera del alcance de este release.

Además **no existe `<link rel="canonical">`** en el sitio, pese a que el
ítem 11 del roadmap lo mencionaba. Queda registrado como observación y
**no se agrega en este release**, para no ampliar alcance más allá de lo
aprobado en HITL 1.

### Dos ejecuciones con datos distintos, por una razón concreta

La ventana de idempotencia es de 5 minutos sobre `email`
(case-insensitive) + `nombre` (case-sensitive). Con datos iguales, la
segunda ejecución devolvería **201 con el id existente y no enviaría
ningún correo**: V6, V7 y V8 darían un falso negativo y parecería un fallo
donde no lo hay.

Por eso desktop y móvil usan nombre y correo distintos. Es una restricción
del código real, no una preferencia de estilo.

### El rate limit no se prueba en Production

Es un limitador en memoria, por instancia serverless y por proceso: no
persiste entre cold starts ni se comparte entre instancias concurrentes
(limitación ya documentada y aceptada en las features 03 y 04). Forzarlo
en Production daría un resultado no determinista y generaría leads y
correos innecesarios.

Se excluye explícitamente, y la cobertura queda en las pruebas
automatizadas (`npm test`, 202/202). Excluirlo con motivo es distinto de
omitirlo en silencio.

### Los leads sintéticos se descartan, no se borran

Pasan a `estado='descartado'` desde el panel de Supabase. Dejarlos en
`nuevo` contaminaría la bandeja de leads pendientes de la clínica;
borrarlos destruiría la evidencia de que la validación ocurrió. El estado
`descartado` resuelve las dos cosas y usa el procedimiento operativo que
ya existe (feature 15).

## Desviación de proceso declarada

`AGENTS.md` define 4 subagentes (`analyst` → `reviewer` → `builder` →
`qa`) sin HITL intermedio. Esta ejecución usa el circuito que indicó el
humano, y se declara acá en vez de aplicarse en silencio:

- Claude Code construye → **OpenCode audita en solo lectura** → Claude
  corrige → OpenCode reaudita.
- **No se invocó `analyst-agent`, `reviewer-agent` ni `qa-agent`.** El
  `spec.md` lo escribió Claude Code a partir del plan aprobado en HITL 1.
- `audit-1.md` y `audit-2.md` **no los escribe el constructor**: los
  redacta OpenCode y Claude Code los persiste literalmente.
- El circuito de esta etapa tiene **exactamente dos** controles humanos,
  HITL 1 y HITL 2, por decisión explícita del humano. Una versión previa
  del plan proponía cinco; fue corregida antes de aprobarse.

## Insumos pendientes del humano

Registrados acá porque condicionan pasos concretos y no deben perderse:

1. **Resuelto.** URL canónica: `https://gi-clinicadental.vercel.app`,
   confirmada por el humano. Aplicada en `og:url`, `og:image` y
   `twitter:image` (PR #21).
2. **Resuelto, y cerrado como limitación de entorno.** GitHub Pages no
   está disponible y no se va a habilitar. **Ya no hay ninguna acción
   humana pendiente en la UI de GitHub**: `docs.yml` construye siempre y
   omite el deploy solo (PR #22, verificado en la corrida `33826977524`).
3. **Pendiente** — `<EMAIL_CONTROLADO_DESKTOP>` y
   `<EMAIL_CONTROLADO_MOVIL>`, más la confirmación de acceso a la casilla
   `LEADS_NOTIFICATION_EMAIL`. Bloquean P5 y V3-V7.
4. **Pendiente** — verificación en los paneles: variables de Production en
   Vercel (P3), y sobre todo que **`SITE_URL` o `ALLOWED_ORIGINS` contenga
   exactamente `https://gi-clinicadental.vercel.app`** (P4, riesgo R1);
   más la tabla `leads` con RLS y `anon` bloqueado en el proyecto Supabase
   de Production (P6). Se registra presente/ausente, **nunca el valor**.

## Resultado

Pendiente. Este archivo se completará con: resultado del preflight,
veredicto de `audit-1`, SHA y deployment de Production, resultado de las
doce comprobaciones, veredicto de `audit-2`, decisión de HITL 2, tag
emitido y confirmación del cierre en `ROADMAP.md`.

**El MVP no está cerrado y no se afirmará que lo está hasta que las tres
señales existan: `[x]` en `ROADMAP.md`, tag `v1.0.0` publicado por el
humano, y evidencia completa en este directorio.**
