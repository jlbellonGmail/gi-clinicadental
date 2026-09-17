status: approved
attempt: 2
feedback:
  - "Sin objeciones bloqueantes. Las 3 correcciones de audit-1.md son reales y verificables: (1) el origen de `fecha_creacion` queda resuelto explícitamente (`.select('id, fecha_creacion')` en vez de generar el timestamp en Node), con justificación de fuente única de verdad; (2) el criterio 3 ahora exige explícitamente verificar `fecha_creacion` e `id` en el HTML, con un mecanismo de verificación concreto (fixture con valores conocidos); (3) el criterio 4 exige explícitamente un test de saneamiento de `\r`/`\n` en el `subject` contra header injection, con el vector de ataque descrito (`"Juan\r\nBcc: attacker@evil.com"`) y el assert exacto (`/[\r\n]/`)."

## Verificación de las 3 correcciones contra código real

- Corrección 1 (`fecha_creacion`): confirmado por lectura directa de
  `api/leads.js` línea 665 — el `INSERT` real hoy termina en
  `.select('id').single()`, exactamente como describe el spec ("hoy
  termina en `.select('id').single()`... línea 665"). El cambio
  propuesto (`.select('id, fecha_creacion')`) es coherente con la
  migración real (`supabase/migrations/20260819210130_create_leads_table.sql`,
  columna `fecha_creacion timestamptz not null default now()`) y no
  introduce cambio de esquema, tal como afirma la sección "Explícitamente
  NO incluye".
- Corrección 1 (continuación, fixture de test): el spec pide
  explícitamente actualizar el fixture de `api/leads.test.js`
  (`makeFakeSupabaseClient`) para que `.select().single()` devuelva
  también `fecha_creacion`. Confirmado por lectura del fixture real
  (línea 118: `return { data: { id }, error: null };`) — hoy solo
  devuelve `id`, consistente con que el spec identifique correctamente
  que este ajuste es necesario y lo documente como nota obligatoria para
  el `builder-agent` (no como ambigüedad abierta).
- Corrección 2 (criterio 3 ampliado): confirmado que el criterio 3 exige
  explícitamente `fecha_creacion` e `id` en el HTML, con un mecanismo de
  verificación de punta a punta (inyectar un Supabase falso con `id`/
  `fecha_creacion` conocidos y confirmar que aparecen en el HTML
  generado). Resuelve la inconsistencia señalada: ya no hay contenido
  exigido por el diseño que quede sin criterio verificable.
- Corrección 3 (criterio 4, header injection): confirmado que existe un
  criterio numerado explícito (4) con vector de ataque concreto y assert
  verificable, coherente con "Casos borde a contemplar" (misma
  explicación técnica) y con `escapeHtml()` real de
  `api/_lib/sanitize-html.js` (confirmado que no toca `\r`/`\n`, tal
  como asume el spec).

## Checklist completa (repasada de punta a punta, no solo lo corregido)

- Criterios de aceptación (19 en total): verificables uno por uno —
  cada uno especifica qué se inyecta/simula y qué assert se espera
  (contador de llamadas, inspección de argumentos de `.select()`/
  `.update()`, interceptar `console.error`, regex sobre `subject`, etc.).
  No hay criterios vagos tipo "debe funcionar correctamente".
- Alcance: límites claros y explícitos — excluye feature `06`
  (confirmación al paciente), reintentos, cambios al frontend, nueva
  tabla/columna, pruebas contra SMTP real de Ferozo, templating externo.
- Casos borde: cubre `null` en campos opcionales, mensajes multilínea,
  header injection, `SMTP_PORT` no numérico, config SMTP parcial, leads
  concurrentes, transporter cacheado con credenciales rotadas, emails de
  notificación mal configurados, `fecha_creacion` con formato inesperado
  en test. No aplica responsive/accesibilidad porque no es una feature
  de frontend (no hay UI nueva); no corresponde exigirlo aquí.
- Supuestos del analyst-agent: razonables y documentados como tales,
  invitando explícitamente a objeción del reviewer donde corresponde
  (`replyTo` sin validación adicional, no notificar en rama de
  duplicado, envío síncrono con timeout en vez de asíncrono/diferido).
  Ya evalué (en audit-1 y de nuevo ahora) el argumento de `replyTo`: es
  válido, `EMAIL_PATTERN` excluye `\r`/`\n`, no hay riesgo de header
  injection por esa vía.
- Nada relevante falta para que un `builder-agent` implemente sin
  ambigüedad: secuencia exacta de pasos post-INSERT, manejo de errores
  en cada paso, timeouts con nombre, DI para tests, mapeo completo de
  campos del email.
- Documentación exigida como criterio de aceptación: `docs/tecnica/notificacion-clinica-smtp-ferozo.md`
  (criterio 15) y `docs/usuario/notificacion-clinica-smtp-ferozo.md`
  (criterio 16) — ambos presentes, no aplica rechazo automático.
- `decision.md` (criterio 17) y enlaces exactos en ambos índices
  (criterios 18/19, con el texto literal que usa
  `scripts/update-doc-indexes.ps1`) — presentes, verificados contra el
  formato real de `docs/tecnica/index.md`/`docs/usuario/index.md`
  (mismo patrón `- [Título](slug.md)` ya usado por las features
  previas).
- Datos personales / formulario de contacto: la spec declara con
  precisión a dónde van los datos (email a `LEADS_NOTIFICATION_EMAIL`,
  remitente `SMTP_FROM`), qué campos se envían, y qué sanitización
  aplica (`escapeHtml()` para el cuerpo HTML, saneamiento de `\r`/`\n`
  para el `subject`). El consentimiento en sí ya fue recabado en la
  captura del lead (feature `03`); esta feature solo transporta datos ya
  consentidos, no introduce un destino nuevo no declarado.
- Contenido médico/clínico inventado: ninguno — la spec prohíbe
  explícitamente marketing/precios/tratamientos/certificaciones en el
  correo y solo usa el nombre de negocio ya establecido ("Sonríe más").

## Notas no bloqueantes

- `id` y `fecha_creacion` pasan por `escapeHtml()` "por consistencia y
  sin costo" aunque son valores generados por el sistema. Es una
  decisión razonable y de bajo riesgo (UUID y fecha no contienen
  caracteres del `ESCAPE_PATTERN` en la mayoría de los formatos
  legibles), y el criterio 3(b) ya lo contempla al pedir "alguna
  representación legible derivada" en vez de una igualdad literal
  estricta — no hay ambigüedad real que bloquee al builder.
- La mitigación de `\r`/`\n` se acota deliberadamente a `nombre` en el
  `subject` (único vector real, dado que `mensaje` nunca se usa en
  headers y `email` ya excluye whitespace por `EMAIL_PATTERN`). Correcto
  y suficientemente acotado; no hace falta generalizar a otros
  caracteres de control (``, etc.) para esta feature.

Archivos revisados: `runs/05-notificacion-clinica-smtp-ferozo/spec.md`,
`runs/05-notificacion-clinica-smtp-ferozo/audit-1.md`, `api/leads.js`,
`api/_lib/supabase-client.js`, `api/_lib/sanitize-html.js`,
`api/leads.test.js`, `supabase/migrations/20260819210130_create_leads_table.sql`,
`.env.example`, `docs/tecnica/arquitectura.md`,
`docs/tecnica/endpoint-recepcion-leads.md`,
`docs/tecnica/proteccion-antispam-y-abuso.md`, `docs/tecnica/index.md`,
`docs/usuario/index.md`, `package.json`, `package-lock.json`,
`ROADMAP.md`.
