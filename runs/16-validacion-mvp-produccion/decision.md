# Decision: 16-validacion-mvp-produccion — Validación del MVP en producción

## Estado

**Fase 2 en curso — pasos 1 a 10 completos.** Artefactos preparados en
`feature/16-validacion-mvp-produccion`, tres tandas de correcciones
pre-release integradas a `develop`, preflight **P1-P8 aprobado** y
**`audit-1` de OpenCode aprobada**.

| PR | Rama | Contenido | Estado |
|---|---|---|---|
| #21 | `release/v1.0.0-preparacion` | marca, Open Graph, `docs.yml` v1, versión 1.0.0 | mergeada, CI verde |
| #22 | `fix/docs-pages-no-disponible` | `docs.yml` sin dependencia de Pages, `AGENTS.md` | mergeada, CI verde |
| #23 | `fix/email-contacto-publico` | contacto público real, sitio declarado demo técnica | mergeada, CI verde |

**Release ejecutado** (PR #24 → `main` @ `eaf4e6f`, deployment
`6286569895` success), **validación en Production FALLIDA** y dos
bloqueantes tratados:

| Bloqueante | Estado |
|---|---|
| `POST /api/leads` → 500 | **diagnosticado** — clase A (entorno). Ver `test-report-2.md`, anexos A y B. Pendiente de una verificación humana sobre `NEXT_PUBLIC_SUPABASE_URL` |
| Marca incrustada en las imágenes | **CORREGIDO** — PR #25 |

Correcciones posteriores al release, ya en `develop`:

| PR | Contenido |
|---|---|
| #25 | imágenes regeneradas sin marca + test de regresión (6 casos) |
| #26 | `supabase_status_code` en el logger + 5 tests |

**El circuito funciona en Production.** `POST /api/leads` devuelve **201**
y crea leads. Los dos bloqueantes están resueltos.

| | |
|---|---|
| `main` | `9ad687477a2ef55463952682ddc0120910d6516c` |
| Candidato liberado | `1991211` = SHA de `audit-1-intento-3` |
| `develop` | idéntico a `main`, 0 commits por delante |
| Tags | **0** |
| `ROADMAP.md` | `[ ] 16-validacion-mvp-produccion` |

Verificado por Claude Code: **V1, V2, V3, V4, V11, N1 y N2**.
Pendiente de verificación humana: **V5, V6, V7, V8, V9, V10** (paneles de
Supabase y Vercel) y **V12** (teléfono real).

**V12 = FAIL** en teléfono real. Corregido en las PRs #30 y #31, con
medición de viewport real antes y después (`test-report-4.md`).

**Candidato: `e783b83`**, sin liberar. `audit-2` sobre `9ad6874` queda
**invalidada**: el candidato cambió.

**Bloqueo actual**: `audit-1` sobre `e783b83` no pudo producir un
artefacto íntegro tras cuatro ejecuciones (ver la desviación técnica más
abajo). No se declara aprobada. **El MVP no está cerrado** y el release
espera decisión humana.

`main` sigue intacto en `a034703`, sin tags, y `ROADMAP.md` en
`[ ] 16-validacion-mvp-produccion`. **El MVP no está cerrado.**

Las tres PRs mergeadas son de **preparación del release** hacia
`develop`, no de esta feature: `feature/16` sigue sin PR y sin mergear, no
hay tag, y `ROADMAP.md` no tiene `[-]` ni `[x]`. Este archivo se completa
a medida que la secuencia avanza; no afirma ningún resultado que no esté
verificado.

## Evidencias

- `runs/16-validacion-mvp-produccion/spec.md` (plan aprobado en HITL 1,
  con los tres ajustes exigidos antes de autorizar la Fase 2)
- `docs/tecnica/validacion-mvp-produccion.md`
- `docs/usuario/validacion-mvp-produccion.md`
- `runs/16-validacion-mvp-produccion/test-report-1.md` (preflight P1-P8,
  aprobado sobre `26e2a68`)
- `runs/16-validacion-mvp-produccion/audit-1.md` (OpenCode, `approved`,
  sobre `26e2a68`)
- Pendientes: `test-report-2.md`, `audit-2.md`, `evidencia/`

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

### El candidato cambió dos veces, y eso invalidó dos auditorías potenciales

`60dbb6c` → `74297a7` → `26e2a68`. Cada corrección pre-release produjo un
árbol distinto, y `audit-1` sólo vale sobre el árbol exacto que la PR
`develop → main` va a mover. Ninguna verificación previa se reutilizó: el
preflight se reejecutó completo sobre `26e2a68` y la auditoría corrió
sobre ese SHA.

Es el control antideriva funcionando, no un contratiempo: si hubiera
auditado el primer candidato y liberado el tercero, el veredicto no
habría cubierto lo que efectivamente se publica.

### La marca tenía tres grafías y hubo que fijarla antes de auditar

Al llegar los datos de Production aparecieron tres formas en circulación:
**`Sonríe más`** en los HTML, en `mkdocs.yml` y en el ítem 10 del roadmap;
**`sonrimas`** en el dominio, el email del footer y las redes sociales; y
**`sonriamas`** en las cuentas SMTP nuevas (`sonriamas@nextgia.io`,
`sonriamas-contactos@nextgia.io`).

El checklist del humano pedía verificar `marca pública = SONRIAMAS`, y esa
grafía aparecía **0 veces** en el sitio. En vez de asumir cuál era la
correcta —o peor, reescribir 24 ocurrencias por mi cuenta— se planteó la
discrepancia con la evidencia a la vista. Resolución: **la marca visible
es `Sonríe más`; `sonriamas` es el identificador técnico de las cuentas de
correo, no la marca.** El sitio no se tocó.

### El contacto público apuntaba a un buzón inexistente

`contacto@sonrimas.com` estaba en el footer, y `sonrimas.com` no tiene
registro A: quien escribiera ahí no llegaba a nadie. Se reemplazó por
`sonriamas-contactos@nextgia.io`, que es el buzón real y el mismo que
recibe los avisos de cada lead.

No es cosmético: un sitio que publica un canal de contacto muerto es peor
que uno que no publica ninguno, porque promete una respuesta que nunca va
a llegar.

### La política de privacidad publicaba tres "[A COMPLETAR POR EL CLIENTE]"

Incluido el del **responsable del tratamiento de datos**. Publicar un
documento legal con marcadores de pendiente, y sin identificar a nadie
como responsable, no era aceptable para el primer release estable.

El humano precisó la situación real: `Sonríe más` es hoy una demostración
técnica y de portfolio, y NextGIA no es una persona jurídica constituida.
Instrucciones explícitas: **no inventar razón social, CUIT ni domicilio**,
y **no publicar datos personales del desarrollador** como responsable
legal.

La solución no fue rellenar los huecos ni borrarlos, sino **decir la
verdad**: la política declara que no existe una entidad responsable,
porque no la hay. Sección 0 nueva con el aviso de demostración técnica;
la finalidad pasa a ser demostrar el circuito y no gestionar turnos; los
destinatarios dejan de ser "el personal administrativo de la clínica"; la
conservación se ata a la vida de la demo sin inventar un plazo comercial;
y el canal ARCO apunta al buzón real.

**Queda registrado como condición actual de la demo, no como deuda
bloqueante de Production.**

De paso se corrigió un dato falso heredado: la sección de destinatarios
nombraba a **Ferozo** como proveedor SMTP, y el proveedor real es
**DonWeb**.

### El aviso se puso donde actúa, no sólo donde es legalmente prolijo

Una advertencia de "no ingreses datos reales" que vive únicamente en un
documento enlazado no protege a nadie: casi nadie abre la política antes
de enviar un formulario. Por eso el aviso se repite en dos lugares con
efecto real: un bloque visible **encima del formulario**, y el texto del
checkbox de consentimiento, que pasó de *"autorizo a la clínica a
contactarme para responder mi solicitud"* a *"entiendo que este sitio es
una demostración técnica"*.

Lo que **no** se tocó: el mensaje de éxito sigue diciendo *"Solicitud
recibida. La clínica se comunicará para confirmar el turno"*, que
contradice el aviso. Es un criterio de aceptación explícito de V4 en esta
misma validación, así que modificarlo habría invalidado la prueba. Queda
como observación para después del cierre.

### La auditoría independiente casi no ocurre, y hubo que resolver tres obstáculos

Se declaran los tres porque afectan a la credibilidad del veredicto:

**1. Ningún proveedor configurado funcionaba.** `opencode.json` apunta a
`anthropic/claude-sonnet-4-5`, pero **no hay credencial de Anthropic**
—`AGENTS.md` ya advertía que ese valor era un ejemplo a ajustar—.
OpenRouter respondió *"can only afford 2010 tokens"* y `opencode-go`
*"Insufficient balance"*. La auditoría corrió finalmente con
`opencode/nemotron-3-ultra-free`.

`opencode.json` **no se modificó**: el modelo se pasó por flag. Cambiar un
archivo versionado habría alterado el SHA candidato y obligado a repetir
todo el preflight.

**2. `reviewer-agent` no se puede usar como auditor.** Está declarado
`mode: subagent` en `.opencode/agent/reviewer-agent.md`, así que OpenCode
lo rechaza como agente primario y **cae al agente por defecto, que no
hereda sus permisos de solo lectura** (`edit`, `bash` y `webfetch` en
`deny`). El aviso literal fue: *"agent reviewer-agent is a subagent, not a
primary agent. Falling back to default agent"*.

Es un defecto real del circuito, no una particularidad de esta ejecución:
**cualquier intento futuro de auditar con `reviewer-agent` vía
`opencode run` correrá con permisos de escritura sin que nadie lo note.**
Se registra como brecha a corregir fuera del alcance de este release.

**3. La garantía de solo lectura no se delegó en la configuración.** Como
no se podía confiar en los permisos del agente, la auditoría se ejecutó
sobre una **copia aislada del árbol** (`git archive`, sin `.git`, fuera
del repositorio). Aunque el agente hubiera intentado escribir, no podía
tocar el repo ni los worktrees.

La precaución resultó justificada: el **primer** intento, anterior a
aislar el árbol, dejó una escritura real —OpenCode sincronizó su propio
`.opencode/package.json` de `1.18.23` a `1.18.27` al arrancar en el
worktree—. **Ese cambio fue detectado y revertido**; es ajeno al punto 16
y no se coló en el release. Confirma que el runtime escribe con
independencia de los permisos del agente.

### `audit-1`: aprobada

Veredicto de OpenCode sobre `26e2a68`: **`status: approved`**, sin
hallazgos bloqueantes, con cinco observaciones no bloqueantes que
coinciden con las ya registradas en `test-report-1.md` (favicon y
apple-touch-icon inexistentes, contradicción del mensaje de éxito,
deprecación de Node 20, ausencia de `canonical`, `sonrimas.com` sin
registro A).

El informe se persistió **literalmente** en `audit-1.md`, verificado byte
a byte contra la salida cruda de OpenCode. Se conservó incluso su
preámbulo —el informe abre con una línea de prosa antes del bloque YAML,
en lugar de empezar por el bloque como pide `AGENTS.md`—: corregir esa
desviación de formato habría significado editar el artefacto de otro
auditor, que es exactamente lo que la separación de autoría prohíbe. Se
declara acá en vez de arreglarse en silencio.

### La causa raíz era la clave, y mi propio error la mantuvo oculta dos rondas

Confirmado por el humano: `SUPABASE_SERVICE_ROLE_KEY` tenía una **clave
legacy en formato JWT** que el proyecto ya no acepta, así que el gateway
de Supabase rechazaba la petición **antes de que llegara a PostgREST**.
Reemplazada por la Secret key `sb_secret_...` del mismo proyecto.

Lo que hay que registrar no es el acierto final sino el error propio. En
el Anexo A descarté la clave razonando que *"todas las causas devuelven
JSON con `code`, luego `sin_codigo` las descarta"*. **Era falso.** Asumí
que un solo componente contestaba, cuando delante de PostgREST hay un
gateway con su **propio formato de error, sin `code`**. Esa afirmación
mantuvo la hipótesis correcta fuera de consideración durante dos rondas
completas. Corregirla en el Anexo C fue lo que destrabó el caso.

Coherente con la clasificación clase A que se sostuvo todo el
diagnóstico: **no se cambió una sola línea de código por este fallo.**

Se verificó además que `@supabase/supabase-js@2.112.3` soporta el formato
nuevo de forma nativa —incluye un helper `isNewApiKey()` y la opción
`omitApiKeyAsBearer`—, para no cambiar un fallo por otro.

### Dos imprecisiones menores en `audit-1-intento-2.md`, no corregidas

El informe de OpenCode dice *"lista blanca estricta de 13 campos"*; son
**14** desde la PR #26. Y dice que se regeneraron *"las tres"* imágenes;
fueron **dos** — `paciente-sonrisa` no se tocó porque nunca llevó la
marca.

**No se editan**: corregir el artefacto de otro auditor es exactamente lo
que la separación de autoría prohíbe. Ninguna de las dos afecta al
veredicto. Se anotan acá, que es donde corresponde.

### `audit-1.md` y `audit-1-intento-2.md` conviven

`audit-1.md` aprobó el candidato `26e2a68`, que se liberó y falló en
Production. Sigue siendo cierto **para ese SHA**, y por eso no se borra ni
se sobrescribe. `audit-1-intento-2.md` aprueba `8611e96`, que es el que se
libera ahora. Los dos juntos cuentan la historia real; uno solo la
falsearía.

### El 404 refutó mi hipótesis del Bearer, y eso es una buena noticia

El log de Production dio `supabase_status_code = 404`, no `401`. **La
hipótesis del anexo E —que la clave `sb_secret_` viajara como Bearer y el
gateway la rechazara— queda refutada.**

Vale la pena señalar por qué salió bien: en el anexo E escribí
explícitamente *"no lo declaro causa raíz todavía"*, precisamente para no
repetir el error del anexo A. Si la hubiera dado por buena, habría
"corregido" algo que no estaba roto —actualizando el paquete o
envolviendo `fetch`— y el 404 habría seguido ahí, ahora con código nuevo
encima.

Lo que el 404 sí permite afirmar, y es un avance real: **ese 404 no lo
emite PostgREST**. Un 404 de PostgREST por relación o esquema
inexistentes devuelve JSON **con `code`** (`42P01`, `PGRST205`), y el log
sigue en `sin_codigo`. Lo emite algo delante de PostgREST.

### Registrar una URL exigía una garantía, no una promesa

`supabase_host` y `supabase_path` (PR #28) resuelven la pregunta que el
status no responde: **a qué URL le estamos pegando realmente**. Un 404 no
distingue "la tabla no existe" de "el host es otro".

Pero la consulta instrumentada lleva el **email del paciente en su query
string**, así que registrar parte de esa URL sólo es aceptable con una
garantía dura, no con cuidado:

1. `metadatosDeEndpoint()` lee **únicamente** `.host` y `.pathname`.
   Nunca `.search`, nunca la URL completa. Lo que no se lee no se puede
   filtrar.
2. Los patrones del logger excluyen `?`, `=`, `&`, `@`, `%` y el espacio.
   Un pathname con query se rechaza **entero**, no truncado; un host con
   credenciales embebidas también. El email URL-encodeado (`%40`) tampoco
   pasa.

Las consultas pasaron a construirse en dos pasos —builder aparte, luego
`await`— porque awaitear la cadena directamente descarta el builder y con
él la URL. La auditoría verificó que eso no altera orden de evaluación,
respuesta HTTP ni efectos.

### El doble de pruebas mentía, y eso invalidaba los tests

Al escribir los tests apareció un defecto en `makeFakeSupabaseClient()`:
`limit()` y `single()` devolvían **una promesa pelada**, mientras el
cliente real devuelve un *thenable* que expone `.url`.

Con ese doble, los tests de la instrumentación **pasaban sin probar
nada**: el campo nunca se registraba y el test tampoco lo exigía. Se
corrigió el doble para replicar la forma real.

Es el tipo de fallo que un test verde esconde, y la razón de verificar
siempre en negativo: quitando la instrumentación, 3 tests fallan.

### `audit-1`: tres artefactos, tres candidatos, ninguno sobrescrito

| Artefacto | Candidato | Estado |
|---|---|---|
| `audit-1.md` | `26e2a68` | approved — liberado, falló en Production |
| `audit-1-intento-2.md` | `8611e96` | approved — liberado, el endpoint siguió fallando |
| `audit-1-intento-3.md` | `1991211` | approved — el que se libera ahora |

Cada uno es cierto para su SHA. Conservarlos los tres es lo que permite
leer la historia real de la etapa; quedarse con el último la falsearía.

### La causa era la configuración, y el diagnóstico no tocó el producto

Cinco rondas de diagnóstico, y la causa raíz estuvo siempre del lado del
entorno: la configuración de Supabase en Vercel. **No se cambió una sola
línea de código de producto para arreglarla.** La clasificación clase A
se sostuvo de principio a fin.

Las dos PRs de código del episodio —#26 (`supabase_status_code`) y #28
(`supabase_host` / `supabase_path`)— **no fueron intentos de arreglar el
fallo**, sino de poder verlo. Cada una nació de una pregunta que el log no
sabía responder, y ambas se pagaron solas: el `404` de la primera refutó
una hipótesis equivocada antes de que se convirtiera en un cambio inútil.

### Dos hipótesis mías refutadas, y por qué eso salió bien

| Hipótesis | Refutada por | Consecuencia de haberla dado por buena |
|---|---|---|
| "Variables ausentes; el fallo es previo a la red" (anexo A) | El evento era `supabase_duplicados_error`, no `supabase_cliente_error` | Habría buscado en la configuración equivocada |
| "Clave `sb_secret_` rechazada como Bearer" (anexo E) | `supabase_status_code = 404`, no `401` | Habría actualizado el paquete o envuelto `fetch` para arreglar algo que no estaba roto |

En ambos casos escribí explícitamente que no las declaraba causa raíz. Es
la única razón por la que no terminaron en código. El error del anexo A
—descartar la clave con un razonamiento falso— sí costó dos rondas, y por
eso quedó registrado como corrección propia y no como nota al pie.

### El envío que no ocurrió, y por qué importa

El primer clic sobre el botón no disparó el envío: fallo de la
automatización del navegador, no del sitio. Se detectó porque el estado
del formulario no coincidía con **ninguno** de los dos caminos del código
—ni el de éxito, que resetea, ni el de error, que deja los campos.

Si lo hubiera dado por bueno, el dataset oficial habría entrado en la
ventana de idempotencia de 5 minutos y el siguiente envío habría devuelto
**201 sin enviar correos**. Habría quedado un V6/V7 dado por válido que
nunca ocurrió, y con evidencia aparentemente correcta.

### V12 no se ejecutó, y no se disfraza

`resize_window` reportó éxito con 390×844 y con 414×896, pero
`window.innerWidth` siguió devolviendo **1696** en ambos casos. El envío
con el dataset móvil pasó, pero **llamar "móvil" a una prueba hecha a
1696 px sería falsear la evidencia**. Queda como pendiente explícito, no
como aprobado.

### Una sonda no planificada, registrada

Tras el envío que no se disparó hacía falta saber si la API había vuelto
a funcionar antes de volver a usar el dataset oficial. Se hizo una sonda
con datos propios (`PRUEBA MVP16 SONDA`), que devolvió 201 y **creó una
tercera fila** no prevista en el plan.

Fue la decisión correcta —evitó quemar el dataset oficial contra una API
que quizá seguía rota— pero es una fila de más, y se registra en el
inventario de limpieza en vez de disimularla.

### `audit-2` no se lanza con la evidencia incompleta

Seis de las doce comprobaciones dependen de paneles a los que este agente
no tiene acceso. Lanzar `audit-2` ahora sería pedirle al auditor que
valide huecos, y un veredicto sobre evidencia incompleta no vale nada
—precisamente el tipo de aprobación cómoda que este circuito existe para
evitar—.

### `audit-2`: aprobada, con lo pendiente declarado antes de auditar

Veredicto de OpenCode sobre `main` @ `9ad6874`: **`status: approved`**,
**sin bloqueantes**.

Al auditor se le declararon por escrito las dos cosas pendientes —V12 sin
ejecutar y la limpieza de las filas sintéticas— **antes** de auditar, y se
le pidió explícitamente que decidiera él si V12 era bloqueante. Su
respuesta: no lo es para cerrar el MVP, pero debe completarse antes de
HITL 2. Es la misma conclusión a la que se había llegado, pero ahora
sostenida por alguien que no construyó nada de esto.

Dos cosas que validó de forma específica y que conviene destacar:

- **V9 no es un atajo.** Se le pidió que evaluara si combinar dos
  requests distintas —una con la secuencia correlacionada observada, otra
  con ambos flags en `true`— era legítimo. Verificó la implicación en el
  código (cada flag se escribe sólo en la rama de éxito, justo después de
  su evento `_ok`) y lo aprobó como cobertura sin huecos lógicos.
- **Ningún fallo quedó oculto.** Enumeró los ocho —dos bloqueantes, tres
  hipótesis refutadas, el envío no disparado, el ETIMEDOUT transitorio y
  la sonda no planificada— y localizó cada uno en su artefacto.

### Dos imprecisiones menores en `audit-2.md`, no corregidas

El informe dice *"4 filas"* de limpieza; son **cinco** (se sumó
`PRUEBA MVP16 SMTP RETRY` en la prueba controlada del anexo H, posterior
al inventario que el auditor leyó). Y dice *"lista blanca estricta de
13/14 campos"*; son **16** desde la PR #28.

**No se editan.** Corregir el artefacto de otro auditor es justo lo que
la separación de autoría prohíbe, y ninguna de las dos afecta al
veredicto. Se anotan acá, que es donde corresponde.

### Tres hipótesis mías refutadas, y ninguna llegó al código

Es el resultado del que más vale la pena dejar constancia, porque no fue
suerte:

| Hipótesis | Refutada por | Qué habría costado darla por buena |
|---|---|---|
| "Variables ausentes; el fallo es previo a la red" | El evento era `supabase_duplicados_error` | Buscar en la configuración equivocada |
| "Clave `sb_secret_` rechazada como Bearer" | `supabase_status_code = 404`, no `401` | Actualizar el paquete o envolver `fetch` para arreglar algo intacto |
| "El segundo envío SMTP agota el timeout" | Ambos flags en `true` tras la prueba controlada | Meter `pool: true` sin causa demostrada |

En las tres escribí que eran probables **pero no probadas**, y pedí el
dato que las decidía. Las tres resultaron falsas. **El diagnóstico duró
más, y el código quedó intacto**: la causa raíz siempre estuvo en el
entorno, y las dos únicas PRs de código del episodio (#26 y #28) fueron
instrumentación para poder ver, no intentos de arreglar a ciegas.

### DESVIACIÓN TÉCNICA: `audit-1` sobre `e783b83` no pudo producir un artefacto íntegro

**No se declara `audit-1` aprobada para este candidato.** Se registra el
fallo en vez de presentarlo como aprobación.

#### Qué se intentó

Cuatro ejecuciones reales de OpenCode sobre el candidato `e783b83`, todas
con el mismo auditor independiente (`opencode/nemotron-3-ultra-free`,
modelo distinto al constructor, sobre copia aislada sin `.git`):

| # | Configuración | Resultado |
|---|---|---|
| 1 | Árbol completo (185 archivos) | **Killed** — 0 bytes de salida |
| 2 | Árbol completo, prompt sin pedir estado de git | **Timeout 10 min** — falló al intentar `git tag`: el agente pidió permiso de directorio externo y se auto-rechazó |
| 3 | Árbol completo, prompt ajustado | Emitió `status: approved` y **se cortó a mitad del informe**: 5.076 bytes, secciones 1 y 2 de 8 |
| 4 | **Árbol mínimo (7 archivos)** + todos los datos dados como contexto, sin git ni shell | **Timeout 9 min — 0 bytes**, sin registrar siquiera una llamada a herramienta |
| 5 | Árbol mínimo, modelo de pago `opencode-go/gpt-5.6-luna` (OpenCode Zen) | **Timeout 9 min — 0 bytes** |
| 6 | Ídem, **en segundo plano y sin límite de tiempo** | **Detenida por el humano tras >37 minutos en `running` con 0 bytes** |

La ejecución 4 se diseñó específicamente para eliminar las causas de las
tres anteriores: se le pasó un directorio con **sólo** los archivos
auditables más el diff exacto, y todos los datos de estado —SHA, suites,
tags, ROADMAP— entregados en el prompt para que no necesitara ejecutar
nada. Aun así no produjo salida.

#### Dos diagnósticos míos, ambos equivocados

Conviene registrarlo porque el patrón de error es el mismo que ya se
repitió en el diagnóstico del 500, y acá volvió a pasar dos veces
seguidas.

**Primer diagnóstico, equivocado**: atribuí los fallos a la
disponibilidad del **modelo gratuito**, único accesible tras agotarse
OpenRouter y `opencode-go`. **Refutado**: la ejecución 5 usó
`gpt-5.6-luna`, un modelo de pago en OpenCode Zen, y falló igual.

**Segundo diagnóstico, también equivocado**: al ver que las dos
ejecuciones con exactamente 0 bytes eran las que corrí en primer plano
con tope de 9-10 minutos, concluí que el problema era mío —OpenCode
vuelca su salida al final, así que un modelo lento produce un resultado
indistinguible de "no hizo nada"—. **Refutado**: la ejecución 6 corrió en
segundo plano, sin ningún límite, y a los **37 minutos** seguía en
`running` con 0 bytes.

Ninguna de las dos hipótesis se declaró como causa cerrada, y por eso
ninguna derivó en un cambio inútil. Pero la lección es la contraria a la
del episodio del 500: **ahí acerté al no cerrar hipótesis; acá directamente
no supe diagnosticar**, y el resultado es que la causa de fondo del fallo
de OpenCode sigue sin determinarse.

#### Lo que sí queda establecido

- **El candidato no es la causa.** Nada en `e783b83` explica que un
  proceso externo no emita salida, y el mismo auditor completó
  auditorías anteriores sobre árboles de este mismo repositorio.
- **OpenCode no puede producir un artefacto íntegro en este entorno**, ni
  con modelo gratuito ni de pago, ni en primer plano ni en segundo, ni
  sobre el árbol completo ni sobre uno de 7 archivos.
- La causa raíz de ese fallo **no se determinó**, y se deja dicho en vez
  de inventar una explicación.

#### Por qué no se usa el informe de la ejecución 3

Emitió `status: approved`, y sería cómodo tomarlo. **No se toma.** El
informe está truncado: contiene el veredicto y dos de las ocho secciones
que se le pidieron, y falta precisamente lo que más importa —el análisis
del scoping, la accesibilidad del menú, la no degradación de desktop y la
suficiencia de la evidencia—.

Un veredicto emitido antes de completar el análisis no es una auditoría;
es una primera impresión. Persistirlo como `audit-1-intento-5.md`
aprobada daría una garantía que nadie verificó, que es exactamente la
aprobación cómoda que este circuito existe para evitar. Con más razón
después de haber persistido íntegra la auditoría que **rechazó** el
candidato anterior.

#### Diagnóstico del fallo

No es un problema del candidato: es del entorno de auditoría. La
evidencia lo respalda —el mismo auditor, con el mismo modelo y el mismo
método, **completó sin problemas** las auditorías de `26e2a68`,
`8611e96`, `1991211`, la `audit-2` sobre `9ad6874` y el rechazo de
`689f480`—. La degradación es posterior y progresiva: primero un kill,
luego un timeout, luego un truncamiento, y por último ninguna salida.

La causa más probable es la disponibilidad del modelo gratuito, que es el
único al que hay acceso: OpenRouter está sin crédito y `opencode-go` sin
saldo, como ya se registró al ejecutar `audit-1.md`.

#### Estado en que queda el candidato

Lo que **sí** está verificado sobre `e783b83`, por medición directa y
reproducible:

| | |
|---|---|
| `npm test` | 213/213 |
| `pytest tests/` | 48/48 |
| `mkdocs build --strict` | OK |
| CI en `develop` | verde |
| Desborde a 320/360/390/412/430/768/1024/1440 y en las 3 páginas | **0 elementos fuera del viewport**, ya sin la máscara global |
| Desktop a 1024 y 1440 | idéntico a antes de la corrección |
| Tests de regresión | verificados en negativo: fallan cuando deben |

Y lo que **no** está: un dictamen independiente sobre este SHA.

#### Resolución: Codex CLI como auditor independiente de contingencia

El humano autorizó **excepcionalmente** usar **Codex CLI** como auditor
independiente de contingencia para cerrar el punto 16, y prohibió gastar
más créditos en OpenCode en esta etapa.

La independencia del control se mantiene, que es lo que importa:

| | |
|---|---|
| Constructor | Claude Code |
| Auditor de contingencia | **Codex CLI 0.151.0**, modelo `gpt-5.5`, perfil `reviewer-agent` (`model_reasoning_effort = high`) |
| Modo | `-s read-only`: la sandbox impide escribir, no es sólo una instrucción del prompt |
| Alcance | Árbol mínimo de 7 archivos, con el diff exacto y `test-report-4.md` |

Codex no es un sustituto improvisado: su cableado ya está versionado en
`.codex/` desde la migración inicial, con `CODEX_HOME` reproducible y un
perfil `reviewer-agent` propio. `AGENTS.md` lo contempla como uno de los
tres agentes del circuito. Lo excepcional es usarlo **en lugar de**
OpenCode, no usarlo.

El informe se persiste como **auditoría de contingencia**, etiquetado
como tal, para que quede claro que `audit-1` sobre este SHA no la produjo
el auditor habitual.

#### Dos errores de configuración míos con Codex, antes de que funcionara

Ninguno es del candidato, y conviene que no queden diluidos: el patrón de
esta tanda es que estoy fallando en el **andamiaje de la auditoría**, no
en el producto.

1. **`401 Unauthorized`.** Fijé `CODEX_HOME` al `.codex/` del
   repositorio siguiendo el README, y con eso anulé el home real
   (`~/.codex`) donde viven las credenciales. El `.codex/` versionado
   sólo contiene perfiles, no auth.
2. **Auditor sin acceso a los archivos.** El prompt le prohibía el shell
   por costumbre, cuando `-s read-only` ya impide escribir **por
   construcción**. Sin shell, Codex no tiene forma de leer un archivo: le
   quité su única vía a la evidencia y luego le pedí evidencia.

La segunda merece una nota, porque su respuesta fue mejor que la de
OpenCode en la misma situación:

> *"No pude leer los siete archivos: las herramientas disponibles no
> permiten acceso directo al sistema de archivos y el uso de shell está
> expresamente prohibido. **No emito conclusiones ni invento líneas de
> evidencia.**"* — y devolvió `NO APROBADA`.

Se negó a dictaminar sin haber leído nada. **No se cuenta como rechazo
del candidato**: no contiene un solo hallazgo sobre el código. Contrasta
con la ejecución 3 de OpenCode, que emitió `approved` **antes** de
completar el análisis — y es exactamente por eso que aquel informe
truncado no se usó.

#### Segunda ampliación de alcance: diálogo, éxito parcial y estado operativo

Después de que `audit-2` aprobara la evidencia sobre `4e86134`, el humano
reportó un **bloqueante** y amplió el alcance por segunda vez.

### El bloqueante: el diálogo se veía al entrar al sitio

Reproducido en Production antes de tocar nada. El atributo `hidden`
estaba puesto y `modal.hidden` era `true`, pero el `display` computado era
`flex`.

**La causa era de cascada, no de JavaScript:**

```
[hidden] { display: none }   <- hoja del NAVEGADOR (user agent)
.modal   { display: flex }   <- hoja del SITIO (autor)
```

Cualquier regla de autor le gana a la del agente de usuario, sin importar
la especificidad. Corregido con `[hidden] { display: none !important }`.

**Lo grave es que los tests decían que estaba bien.** Comprobaban
`modal.hidden === true`, que era cierto. jsdom devuelve `display: none`
con el mismo CSS porque su cascada no modela esa precedencia. Es la
quinta vez en esta etapa que un guard no ve su defecto, y la más
instructiva: los cuatro anteriores tenían errores de implementación;
**éste era correcto y aun así ciego**, porque corría en el motor
equivocado. El guard vive ahora sobre el CSS.

### Tres resultados terminales, no dos

Un `201` significa "el lead quedó registrado", **no** que las dos
notificaciones hayan salido. El endpoint lo informa en
`comunicacion_completa`, y el frontend lo traduce a tres mensajes con una
sola infraestructura de diálogo. La regla crítica: en el parcial el lead
**ya existe**, así que el mensaje dice explícitamente que no hace falta
reenviar. Ante la duda se elige lo conservador: parcial.

### Estado operativo: dos preguntas, no una

`audit-4` encontró que el estado podía quedar `completa` con la base
inconsistente: si un correo salía pero su `UPDATE` de flag fallaba, la
consulta operativa **no encontraba ese lead**. Ahora `completa` exige los
dos envíos **y** los dos flags persistidos.

### SMTP: la pregunta no era si el fallo fue pasajero

La versión anterior reintentaba `ETIMEDOUT`. Está mal: ese timeout puede
ocurrir *después* de que el servidor aceptó el mensaje, y reintentar manda
el correo dos veces. Ahora solo se reintenta lo demostrablemente no
entregado; lo ambiguo queda en `requiere_revision`.

Esto revierte una decisión anterior de esta misma etapa —"no pool, no
cambios de timeout"— que quedó levantada cuando el humano pidió resolver
la confiabilidad. Se hace constar en vez de tratarlo como si nunca se
hubiera decidido lo contrario.

### La migración, corregida por revisión humana

El humano revisó el SQL **antes** de aplicarlo y encontró dos defectos que
ninguna herramienta automática miraba:

- **faltaba el backfill**: las filas históricas quedaban todas en
  `pendiente`, que significa "el proceso todavía no terminó", cuando su
  resultado ya se conocía por los flags;
- la comprobación sobre `pg_constraint` buscaba **solo por nombre**, lo
  que daría un falso positivo con un constraint homónimo de otra tabla.

Aplicada por el humano, con backfill verificado: **5 filas a `completa`,
6 a `requiere_revision`, ninguna en `pendiente`**.

Sobre los `descartado`: la exclusión vive en la **cola operativa**
—consulta e índice parcial—, no en el dato. Un descartado con la
notificación fallida conserva `requiere_revision` porque eso es lo que
realmente pasó; marcarlo `resuelta_manual` afirmaría que alguien gestionó
esa comunicación, que es falso, y borraría la información.

### Los tests no deterministas: la causa no era la que dije

Había atribuido las fallas de `test_local_reconciler_scripts.py` a "la
máquina cargada". **Atribución incompleta: la suite se cargaba a sí
misma.** Varios de esos tests dejan el reconciliador corriendo a
propósito, y el teardown lo mataba **sin verificar**, así que los procesos
sobrevivían y se acumulaban entre tests.

Corregido: el teardown espera a que mueran, y barre huérfanos por línea de
comandos acotado al `tmp_path` del test. Acelerar el sondeo destapó además
una carrera latente —un test afirmaba que el `.log` existía sin
esperarlo—, que también se corrigió.

### Un error de empaquetado que costó una ronda de auditoría

`audit-6` rechazó en parte porque el test de la migración no encontraba su
documentación. Era cierto **dentro del directorio que le entregué**: al
armarlo aplané la ruta a `docs/` en vez de `docs/tecnica/`. En el árbol
real el archivo existe y el módulo pasa 10/10.

El auditor razonó bien sobre un árbol que armé mal. Desde entonces el
directorio de auditoría se extrae con `git archive`, conservando la
estructura real.

## Resultado

**Pendiente de HITL 2.** Estado real al cierre de todo lo automatizable:

| | |
|---|---|
| `main` | **`5f0fbe194d4363d8e5b5b1143b96b99740434eb3`** (PR #49) |
| Deployment | **`6312453790`**, Production, **success** |
| Migración | **aplicada** por el humano; backfill verificado, 0 filas en `pendiente` |
| Suites | `npm test` **272/272** · `pytest` **79/79 verde completa** · `mkdocs --strict` OK |
| Verificación en negativo | **28 defectos en rojo, 4 cambios inocuos en verde** |
| Tags | **ninguno** |
| `ROADMAP.md` | `[ ]` |
| Feature | sin mergear |

### Auditorías independientes, todas persistidas literalmente

| Serie | Alcance | Veredicto final |
|---|---|---|
| `audit-1` (9 intentos + contingencia) | responsive y contraste | **APROBADA** sobre `5c94dcf`, tras cinco rechazos |
| `audit-3` (3 intentos) | envío del formulario | **APROBADA** sobre `3c66c8a`, tras dos rechazos |
| `audit-4` / `audit-5` | diálogo, éxito parcial, estado | **APROBADA** sobre `a64c6e9`, tras un rechazo |
| `audit-6` / `audit-7` | SHA final | **APROBADA** sobre `5f0fbe1`, tras un rechazo |
| `audit-2` (serie) | la evidencia | ver el último intento de la serie |

### La validación C

Se hizo sobre el deployment de `571e999`. El release posterior (`5f0fbe1`)
toca **solo `tests/`**: se comprobó **hash a hash** que `index.html`,
`script.js`, `style.css`, `api/leads.js`, `api/_lib/mailer.js` y
`api/_lib/logger.js` son idénticos. La validación aplica sin
extrapolación.

Resultado, en `test-report-8.md`: modal cerrado al cargar y tras refresh;
feedback en 10 ms; **diez clicks y tres Enter → una sola request**; 201
con la variante `exito`; formulario reseteado; `Escape` y **Entendido**
cierran; el refresh posterior no reabre; 8 anchos entre 320 y 1440 sin
desbordes ni scroll horizontal.

### Las comprobaciones humanas que faltan

1. **Los flags y el `estado_comunicacion` del lead `V14-MTREJ5YZ`** en
   Supabase, y **los logs de esa request** en Vercel. Ni la CLI de Vercel
   ni la de Supabase están disponibles en la sesión — comprobado, no
   supuesto.
2. **El descarte de los leads sintéticos** (`estado = 'descartado'`).
3. **Los dos leads `nuevo + requiere_revision + true/false`**, que **no se
   tocaron**. Su firma coincide con el `ETIMEDOUT` documentado en el Anexo
   H, y todos los envíos sintéticos usaron la casilla controlada del
   humano con plus-addressing; pero confirmar que esas dos filas concretas
   coinciden **requiere leer la base**, así que quedan para resolución
   humana.

Sobre el reintento SMTP en la validación C: **no se afirma ni se descarta**
que haya ocurrido. Los 15,0 s frente a los 13,8 s del envío anterior no
prueban nada, y desde el navegador no se distingue. El log lo resuelve en
una línea.

**El MVP no está cerrado y no se afirmará que lo está hasta que las tres
señales existan: `[x]` en `ROADMAP.md`, tag `v1.0.0` publicado por el
humano, y evidencia completa en este directorio.**
