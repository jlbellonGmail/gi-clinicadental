# Arquitectura — decisiones estructurales del repositorio

`AGENTS.md` (sección "Reglas de dominio") exige que ningún backend, base
de datos o dependencia de build se incorpore al repositorio sin que
quede como una decisión explícita en este archivo. Este documento
todavía no existía: la feature `03-endpoint-recepcion-leads` es la
primera en disparar esa obligación, porque es la primera pieza de
**código de aplicación** ejecutable del repo (hasta entonces todo era
estático — HTML/CSS/JS sin build — o declarativo — SQL, `.env.example`).

## Decisión: primer backend Node.js del repo (`api/leads.js`)

- **Qué se agrega**: una función Serverless de Node.js
  (`api/leads.js`, runtime Node.js — no Edge) que Vercel expone
  automáticamente como `POST /api/leads`, siguiendo la convención de
  archivo-como-ruta de Vercel (cualquier archivo `.js` bajo `api/` que
  exporte un handler se convierte en un endpoint; los archivos bajo
  `api/_lib/` quedan excluidos de ese routing por la convención de
  prefijo `_`, ver criterio 21 de
  `runs/03-endpoint-recepcion-leads/spec.md`).
- **Por qué ahora**: sin este endpoint no hay nada a lo que conectar el
  formulario (`index.html`/`script.js`) en la feature `08`. Es el primer
  paso indispensable del backend objetivo que `AGENTS.md` ya declaraba
  como stack planeado desde el inicio del proyecto (funciones Serverless
  de Node.js en Vercel, base de datos Supabase Postgres).
- **Por qué no otro enfoque**: no se introduce un framework de
  aplicación (Express, Fastify, Next.js API routes) porque el contrato
  de Vercel Serverless Functions ya resuelve el ruteo sin necesitar uno,
  y `AGENTS.md` pide mantener el sitio simple salvo decisión explícita
  de arquitectura — agregar un framework de servidor no estaba pedido
  por ningún spec ni ítem del roadmap.
- **Sigue sin build**: el frontend (`index.html`, `style.css`,
  `script.js`) permanece sin proceso de build, sin tocar. El backend
  Node.js es código server-side puro (`require`/`module.exports`,
  CommonJS), sin transpilación ni bundling: Vercel ejecuta cada archivo
  de `api/` directamente con el runtime Node.js configurado.

## Decisión: primera dependencia npm real (`@supabase/supabase-js`)

- **Qué se agrega**: `package.json` (primero del repo) con
  `@supabase/supabase-js` como dependencia de producción, y
  `package-lock.json` commiteado para instalación reproducible
  (`npm ci` en CI).
- **Por qué esta librería y no acceso HTTP directo a la API REST de
  Supabase**: es el cliente oficial recomendado por Supabase, ya
  documentado como parte del stack objetivo en `AGENTS.md` desde antes
  de esta feature ("Integración Supabase: cliente oficial
  `@supabase/supabase-js`"). Evita reimplementar autenticación,
  serialización y manejo de errores de la API REST de Postgres a mano.
- **Alcance del uso**: exclusivamente server-side, inicializado con
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (esta última
  nunca se expone al frontend, a logs, ni a la respuesta HTTP — ver
  `docs/tecnica/endpoint-recepcion-leads.md`, sección "Manejo de errores
  500"). No se agrega el cliente al bundle de frontend en esta feature.
- **Superficie mínima agregada**: una sola dependencia directa; sus
  transitivas (`node_modules/`) quedan excluidas de Git vía
  `.gitignore` (no se commitea código de terceros).

## Decisión: test runner nativo de Node, sin dependencia de testing nueva

- Se usa `node --test` (disponible nativamente desde Node 18) para los
  tests de esta feature (`api/leads.test.js`,
  `api/_lib/sanitize-html.test.js`), en vez de sumar Jest/Vitest/Mocha
  como dependencia nueva. Evita ampliar la superficie de dependencias
  del repo más allá de lo estrictamente necesario
  (`@supabase/supabase-js`).

### Revisión (punto 16): se suma `jsdom`, y solo como dependencia de desarrollo

La decisión de arriba se mantiene para el **runner**: se sigue usando
`node --test`, no se sumó Jest, Vitest ni Mocha. Lo que cambia es que
aparece la primera dependencia de *testing* del repo, y conviene decirlo
explícitamente en vez de colarla en un `package.json`.

**Por qué.** El punto 16 corrige tres defectos del envío del formulario
—doble submit, falta de feedback y confirmación poco visible— y los tres
son comportamientos del DOM. Hasta ese momento `script.js` tenía **cero
cobertura**: los 213 tests eran todos de backend, y los tres defectos se
encontraron usando el sitio a mano. El guard de doble envío, además,
estaba **invertido** desde antes y nadie lo notó.

Las alternativas que se descartaron:

- **No testear el frontend.** Es lo que había, y es exactamente cómo
  llegó a Production un guard invertido.
- **Extraer la lógica a un módulo puro con una vista inyectada.** Testea
  la máquina de estados sin DOM, pero no verifica el cableado real: si
  el `id` del botón cambia en `index.html`, el test sigue verde.
- **Verificar solo en un navegador.** No es reproducible en CI.

`jsdom` va en `devDependencies`: **no se despliega**. El bundle de las
funciones serverless no cambia, y `script.js` sigue siendo JavaScript
plano sin proceso de build. `script.test.js` monta el `index.html` real
del repositorio, así que un cambio de markup que rompa el cableado hace
fallar los tests.

**Límite declarado**: jsdom no pinta. Verifica estado, atributos y
llamadas —no el aspecto visual—, y el layout se sigue validando por
separado con mediciones en viewport real.

## Decisión: `maxDuration` explícito para `api/leads.js`

`vercel.json` fija `maxDuration: 30` para esa función. Antes no declaraba
ninguno y quedaba en el valor por defecto de la plataforma.

El motivo es que la ruta larga de la request —INSERT en Supabase, correo
a la clínica, UPDATE del flag, correo al paciente, UPDATE final— ahora
puede incluir **un reintento acotado** de cada envío SMTP. Sin un margen
explícito, ese reintento podía chocar contra el límite por defecto y
convertir un fallo de correo recuperable en un 504 de la request entera,
que es peor: el lead ya está insertado.

## Decisión: runtime Node.js asumido ≥18 (CI fija Node 20)

- No existía ninguna declaración previa en el repo sobre la versión de
  Node.js del runtime de Vercel. Se documenta como supuesto (`node --test`
  nativo requiere Node ≥18) y `package.json#engines` lo declara
  (`"node": ">=18"`). `.github/workflows/ci.yml` usa Node 20 (LTS)
  concretamente vía `actions/setup-node@v4`. Si el proyecto Vercel real
  requiere otra versión LTS, es un ajuste de configuración, no del
  diseño del endpoint.

## Decisión: CI ejecuta ambas suites (Python + Node) en el mismo job

- `.github/workflows/ci.yml` ya tenía un job `test` que corría
  `pytest -v` sobre `tests/` (tests del circuito agéntico). Esta feature
  agrega, dentro del **mismo job**, pasos para instalar Node.js 20,
  correr `npm ci` y `npm test`, sin quitar ni debilitar el paso de
  pytest existente. Se optó por extender el job existente (en vez de
  crear un job Node separado) porque ambas suites son rápidas y no hay
  necesidad de paralelizarlas en jobs distintos — mantiene el archivo
  simple y el gate de CI ("verde") sigue siendo un único check.

## Qué NO cambia con esta decisión

- El sitio estático (`index.html`/`style.css`/`script.js`) sigue sin
  build ni framework.
- No se agrega Nodemailer/SMTP todavía (features `05`/`06`): esta
  feature solo deja lista `api/_lib/sanitize-html.js` para que esas
  features la consuman.
- No se agrega CORS explícito, validación de origen robusta, ni
  antispam más allá del rate limiting best-effort mínimo (feature `04`).

## Decisión: segunda dependencia npm real (`nodemailer`)

- **Qué se agrega**: `nodemailer` (`^9.x`) como dependencia de
  producción en `package.json`, con `package-lock.json` actualizado en
  consecuencia (`npm install nodemailer`, reproducible con `npm ci`).
  Feature `05-notificacion-clinica-smtp-ferozo`
  (`runs/05-notificacion-clinica-smtp-ferozo/spec.md`).
- **Por qué esta librería**: es el cliente de correo saliente Node.js más
  usado y estable del ecosistema, ya documentado como parte del stack
  objetivo del proyecto en `AGENTS.md` desde antes de esta feature
  ("Correo transaccional: Nodemailer conectado al servidor SMTP de
  Ferozo mediante TLS"). No existía alternativa a evaluar: era la
  decisión de stack ya tomada, esta feature es la primera en incorporar
  la dependencia real y usarla.
- **Alcance del uso**: exclusivamente server-side, dentro de
  `api/_lib/mailer.js` (ver
  `docs/tecnica/notificacion-clinica-smtp-ferozo.md`). El transporter se
  construye únicamente con variables de entorno (`SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) ya documentadas en
  `.env.example` desde la feature `01`; nunca se agrega al bundle de
  frontend, que sigue sin build.
- **Sin conexión SMTP real en tests ni en CI**: toda la cobertura
  automática (`api/_lib/mailer.test.js`, sección "Feature 05" de
  `api/leads.test.js`) usa un transporter inyectado/simulado vía
  `mailerFactory` (mismo patrón de inyección de dependencias que
  `supabaseClientFactory`). `nodemailer.createTransport()` en sí no abre
  conexión de red — solo arma el objeto transporter — por lo que los
  tests de `createTransporter()` pueden ejercitar la construcción real
  del transporter (host/port/secure/auth/timeouts) sin necesitar un
  servidor SMTP real ni mocks adicionales del módulo.
- **Superficie agregada**: una sola dependencia directa más; sus
  transitivas quedan excluidas de Git vía `.gitignore`, igual que
  `@supabase/supabase-js`.
