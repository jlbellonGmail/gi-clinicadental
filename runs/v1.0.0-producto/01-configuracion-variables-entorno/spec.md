# Spec: Configuración de variables de entorno

## Alcance

Crear `.env.example` en la raíz del repositorio, documentando (nombre +
propósito, sin valores reales) las 9 variables de entorno que el backend
objetivo (Node.js serverless en Vercel + Supabase + SMTP Ferozo/Nodemailer,
ver `AGENTS.md`) va a necesitar:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `LEADS_NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`

Y verificar/completar `.gitignore` para que `.env`, `.env.local` y
variantes (`.env.*.local`, `.env.production`, `.env.development`, etc.)
nunca puedan commitearse, con `.env.example` explícitamente exceptuado.

## Fuera de alcance

- No se crea código que lea estas variables (eso es la feature 03,
  endpoint de recepción de leads) — esto es solo documentación +
  guardas de `.gitignore`.
- No se tocan las credenciales reales de Vercel (ítem `00`, ya cerrado,
  rotación manual fuera del repo).
- No se agrega `package.json`/Node.js todavía — no hay código Node en
  el repo aún que consuma estas variables.

## Contexto

`AGENTS.md` (actualizado por el usuario tras la adopción del circuito)
define el stack objetivo: funciones serverless de Node.js en Vercel,
Supabase Postgres como base de datos, Nodemailer + SMTP de Ferozo para
notificaciones. El ítem `00-aprovisionamiento-entorno-vercel` (cerrado)
ya rotó las credenciales reales expuestas y las dejó **solo en Vercel**
(Production/Preview), nunca en el repo. Esta feature es el primer paso
de código: dejar documentado, sin valores reales, qué variables va a
necesitar cada entorno local de desarrollo, para que cualquier
desarrollador (o agente) sepa qué configurar sin tener que adivinar ni
pedir credenciales por canales inseguros.

## Criterios de aceptación

1. Existe `.env.example` en la raíz del repo.
2. Contiene las 9 variables listadas arriba, cada una con:
   - un comentario breve explicando su propósito,
   - un valor vacío o un placeholder evidentemente ficticio (nunca un
     valor que parezca una credencial real — ej. `SMTP_PASS=` vacío o
     `SMTP_PASS=changeme`, no una contraseña con forma plausible).
3. Ningún valor en `.env.example` es una credencial real, ni siquiera
   parcial (verificable: el archivo no debe tener nada que no sea
   claramente placeholder si se lo lee sin contexto).
4. `.gitignore` excluye `.env`, `.env.local` y variantes
   (`.env.*.local`, `.env.development`, `.env.production`, etc.), con
   una excepción explícita para `.env.example`.
5. Verificación real: crear un archivo `.env` de prueba (con contenido
   dummy) y confirmar con `git status --short` / `git check-ignore` que
   Git lo ignora; confirmar que `.env.example` SÍ aparece como
   trackeable.
6. Debe existir `docs/tecnica/configuracion-variables-entorno.md`, no
   vacío, con el detalle técnico de cada variable (qué componente la
   usa, formato esperado).
7. Debe existir `docs/usuario/configuracion-variables-entorno.md`, no
   vacío, explicando a un desarrollador nuevo cómo copiar
   `.env.example` a `.env.local` y dónde conseguir los valores reales
   (Vercel, nunca en el repo).
8. `runs/01-configuracion-variables-entorno/decision.md` existe, y hay
   enlaces exactos en `docs/tecnica/index.md` y `docs/usuario/index.md`.

## Casos borde a contemplar

- `SMTP_PORT` es numérico (puerto 465 según `AGENTS.md`, TLS): el
  placeholder debe ser un número válido de ejemplo, no vacío ni texto,
  para que quien lo complete entienda el tipo esperado.
- `NEXT_PUBLIC_*`: estas dos variables son públicas por convención (se
  exponen al cliente/frontend) — el comentario en `.env.example` debe
  aclarar explícitamente esa diferencia de sensibilidad frente a
  `SUPABASE_SERVICE_ROLE_KEY` (estrictamente server-side, nunca al
  cliente).
- `SITE_URL`: debe documentarse que difiere entre entornos (Preview vs
  Production en Vercel) — el placeholder debe reflejar eso (ej.
  `http://localhost:3000` para desarrollo local), no un valor fijo de
  producción.
- Alguien podría ya tener un `.env` o `.env.local` local sin trackear:
  el `.gitignore` nuevo no debe hacer que Git dejara de ignorarlo si ya
  lo estaba (regla general de Git: no afecta archivos ya trackeados,
  pero acá no hay ninguno trackeado, así que no aplica un caso de
  migración).

## Riesgos / supuestos

- Supuesto: el nombre de archivo convencional para desarrollo local con
  Next.js/Vercel es `.env.local` (no `.env`), pero se ignoran ambos por
  seguridad — `AGENTS.md` no especifica cuál se usará en la práctica.
- Supuesto: no hay todavía un framework Next.js real en el repo (solo
  HTML/CSS/JS estático) a pesar de que las variables usan el prefijo
  `NEXT_PUBLIC_*` — se documenta tal cual lo pide el roadmap, sin
  inventar que ya existe una app Next.js (eso es una decisión de
  arquitectura de una feature futura, no de esta).
- Riesgo: si en el futuro se agrega un framework distinto a Next.js, el
  prefijo `NEXT_PUBLIC_` podría dejar de tener efecto real (es una
  convención específica de Next.js) — se documenta la variable tal como
  la pide el roadmap, y se deja como nota en `docs/tecnica/` para que
  la feature que agregue el framework lo reconsidere si corresponde.
