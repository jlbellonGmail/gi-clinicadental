```yaml
status: rejected
attempt: 1
feedback:
  - "Item 4 (Idempotencia/dedupe) tiene una condición de carrera (TOCTOU) no abordada ni documentada: el diseño propuesto es 'SELECT para ver si existe un duplicado reciente, y si no existe, INSERT' como dos pasos separados, sin transacción ni constraint único a nivel de base de datos. Dos solicitudes casi simultáneas (el caso más común y realista de 'envío duplicado accidental': doble clic en el botón antes de que la primera respuesta vuelva) pueden ejecutar ambas el SELECT antes de que cualquiera haga el INSERT, viendo ambas 'no hay duplicado' y terminando en dos leads insertados — exactamente el escenario que este criterio de aceptación (ROADMAP: 'evitar envíos duplicados accidentales') debería prevenir. La sección 'Riesgos / supuestos' es muy exhaustiva documentando otras limitaciones conocidas (honeypot evadible, timing evadible, hash de IP sin sal, fusión de nombre+email) pero omite esta, que es la más relevante para el caso de uso principal del punto 4. Acción concreta: agregar un párrafo explícito en 'Riesgos / supuestos' que reconozca esta ventana de carrera como riesgo aceptado (dado que no se permite agregar una migración con constraint único ni infraestructura nueva), o alternativamente ajustar el diseño para mitigarla (ej. un índice único parcial sobre email+nombre+ventana temporal, si eso se considera dentro de alcance como excepción documentada en docs/tecnica/arquitectura.md). No puede quedar simplemente sin mencionar."
  - "Ambigüedad de implementación en el punto 3 (control temporal, formulario_mostrado_en): la spec dice que un valor 'no es un string parseable como fecha válida' se omite el chequeo sin rechazar la solicitud completa (\"no se rechaza la solicitud completa por un timestamp malformado\"), pero no aclara explícitamente si formulario_mostrado_en debe excluirse del arreglo genérico STRING_FIELDS de api/leads.js (el que dispara tipo_invalido para cualquier campo presente con tipo incorrecto). El paso 10 del 'Orden de evaluación extendido' dice que los chequeos de tipos de la feature 03 quedan 'sin cambios de comportamiento' — pero STRING_FIELDS es justamente la lista que el builder podría ampliar o no con el campo nuevo, y la spec nunca lo dice en ninguna dirección. Si un builder agrega formulario_mostrado_en a STRING_FIELDS, un valor no-string (ej. un número) pasaría silenciosamente el chequeo de control temporal en el paso 9 (Date.parse coacciona a NaN) pero luego sería rechazado como tipo_invalido en el paso 10 — contradiciendo literalmente 'no se rechaza la solicitud completa'. Si otro builder no lo agrega, la solicitud pasa sin rechazo alguno. Ambas lecturas son razonables con el texto actual, lo cual es exactamente el tipo de ambigüedad que dos implementadores distintos resolverían distinto. Comparar con cómo la feature 03 sí fue explícita para consentimiento_privacidad ('queda excluido de las reglas generales de campos obligatorios... y de tipos'). Acción concreta: agregar una frase equivalente y explícita para formulario_mostrado_en (y, aunque menos ambiguo porque el honeypot ya define su propio manejo de tipo, conviene decirlo también explícitamente para sitio_web por simetría): 'formulario_mostrado_en queda excluido del chequeo genérico de tipos (STRING_FIELDS) de la feature 03; su validación de tipo/formato es exclusivamente la descrita en el punto 3, nunca produce tipo_invalido.'"
```

## Auditoría de `runs/04-proteccion-antispam-y-abuso/spec.md`

### Qué revisé

- `AGENTS.md` (raíz) — contrato del circuito y reglas de dominio no negociables.
- `scripts/feature-contract.ps1` — contrato ejecutable (`Assert-FeatureContract`, `Assert-IndexLink`, formato exacto de enlaces de índice).
- `runs/04-proteccion-antispam-y-abuso/spec.md` completo (23 criterios de aceptación, diseño en 5 puntos, orden de evaluación extendido, casos borde, riesgos/supuestos, casos de prueba esperados).
- `api/leads.js` (implementación real de la feature 03) para verificar que el spec de la 04 es consistente con el código existente, no solo con su documentación.
- `docs/tecnica/endpoint-recepcion-leads.md` (doc técnica de la feature 03), en particular la sección "Rate limiting best-effort — limitaciones", que la propia spec de la 04 cita y contesta explícitamente en "Riesgos / supuestos".
- Entrada `04-proteccion-antispam-y-abuso` en `ROADMAP.md`.
- `.env.example` para verificar el estilo de documentación de variables nuevas.

### Contrato obligatorio (AGENTS.md / feature-contract.ps1)

Todo presente y correcto:
- Criterios 19/20 exigen `docs/tecnica/proteccion-antispam-y-abuso.md` y `docs/usuario/proteccion-antispam-y-abuso.md` no vacíos.
- Criterio 21 exige `runs/04-proteccion-antispam-y-abuso/decision.md` no vacío ni ornamental.
- Criterios 22/23 exigen el enlace exacto (`- [Protección antispam y abuso](proteccion-antispam-y-abuso.md)`) en ambos índices, con nota explícita de usar `scripts/update-doc-indexes.ps1 04-proteccion-antispam-y-abuso "Protección antispam y abuso"`, formato compatible con `Assert-IndexLink`.
- No se detecta contenido médico/clínico inventado (tratamientos, precios, certificaciones): la feature es puramente de protección de endpoint.
- No hay dato personal nuevo en juego (no se agrega recolección de PII); el manejo de datos de contacto ya está declarado desde la feature 03 y esta spec no lo altera. El único dato "nuevo" es un campo trampa (`sitio_web`) que por diseño nunca debería llevar contenido real de usuario.
- No se agrega dependencia npm, tabla ni migración Supabase nueva sin decisión explícita: la spec reitera esto varias veces y condiciona cualquier desvío a documentarlo en `docs/tecnica/arquitectura.md` (criterio 18), cumpliendo la regla dura de "Reglas de dominio" de `AGENTS.md`.

No hay motivo de rechazo automático por ninguno de los ítems no negociables del checklist.

### Fortalezas del spec

- Extremadamente verificable: cada uno de los 23 criterios tiene código de respuesta exacto, cuerpo JSON exacto, y condición de disparo sin ambigüedad de redacción.
- El "orden de evaluación extendido" es explícito, numerado y reemplaza formalmente el de la feature 03, con un caso de test combinado (`origen inválido + rate limit excedido → 403, no 429`) que fuerza a validar el orden real, no solo cada chequeo aislado.
- La decisión de no implementar CAPTCHA es consistente con el propio texto de `ROADMAP.md` ("...CAPTCHA cuando resulte necesario", una alternativa entre varias, no un mandato), con el stack declarado en `AGENTS.md` (sin proveedor de CAPTCHA listado) y con la regla de dominio de no agregar servicios externos sin decisión de arquitectura explícita. La justificación en "Riesgos / supuestos" es sólida.
- La decisión de no reemplazar el rate limiter en memoria por almacenamiento persistente/distribuido está justificada de forma razonable (evita agregar Redis/Upstash/Vercel KV sin necesidad probada, prioriza defensas independientes del estado compartido) y, aunque contradice una expectativa fijada en la propia documentación de la feature 03 ("alcance completo" incluía esto), el propio analyst-agent lo señala explícitamente como punto a objetar si el reviewer no está de acuerdo. Evalué este punto con detenimiento: el texto real de `ROADMAP.md` para el ítem 04 no exige explícitamente almacenamiento persistente, solo "rate limiting"; la persistencia era una nota aspiracional de la doc de la 03, no un criterio de aceptación de esa feature. No lo considero motivo de rechazo.
- "Casos borde" es notablemente completo: cadena de proxies en `x-forwarded-for`, `Origin` no parseable, espacios en `ALLOWED_ORIGINS`, `VERCEL_URL` ausente, prioridad honeypot vs. campo obligatorio faltante, reloj de cliente adelantado (delta negativo), herramientas sin `Origin`/`Referer` bloqueadas por diseño.
- El uso de un código de rechazo genérico compartido (`solicitud_rechazada`) entre honeypot y control temporal, para no darle a un bot una forma de calibrar contra cada defensa por separado, es una decisión de seguridad razonada y explícita, no accidental.
- Correctamente fuera de alcance: no toca `index.html`/`script.js` (eso es la feature `08`), y dado que es una feature puramente de backend, la ausencia de consideraciones de accesibilidad/responsive no es un defecto — está correctamente delegada a `08` (incluso con una nota concreta sobre no usar `display:none` puro para el honeypot).

### Motivos de rechazo (accionables)

Encontré dos gaps de implementabilidad genuinos, ambos de bajo costo de corrección (no requieren cambiar el alcance ni agregar infraestructura), detallados en el bloque YAML:

1. **Condición de carrera (TOCTOU) no documentada en el mecanismo de idempotencia (punto 4).** El diseño de "consultar y luego insertar si no hay duplicado" en dos pasos separados, sin constraint único ni transacción, no protege contra el caso más común de "envío duplicado accidental" (doble clic casi simultáneo), que es precisamente el motivo por el que este ítem existe en `ROADMAP.md`. La sección "Riesgos / supuestos" es muy prolija documentando otras limitaciones (honeypot evadible, timing evadible, hash de IP sin sal, fusión nombre+email) pero no menciona esta, la más relevante para el caso de uso principal del punto 4.

2. **Ambigüedad sobre si `formulario_mostrado_en` (y, por simetría, `sitio_web`) participan del chequeo genérico de tipos (`STRING_FIELDS`) heredado de la feature 03.** La spec afirma que un timestamp malformado "no rechaza la solicitud completa", pero no dice explícitamente si ese campo queda excluido del arreglo `STRING_FIELDS` existente en `api/leads.js` (que sí dispararía `tipo_invalido` para un valor no-string). La feature 03 sí fue explícita en este punto para `consentimiento_privacidad` ("queda excluido de las reglas generales..."); esta spec necesita el mismo nivel de explicitud para el campo nuevo, para que dos builders no lo implementen de formas distintas.

### Veredicto

`rejected`, intento 1. Ambos puntos son correcciones acotadas al propio `spec.md` (agregar dos párrafos de precisión/documentación), no requieren replantear el diseño ni el alcance. El circuito vuelve a `analyst-agent` con este feedback; no hay checkpoint humano intermedio.

Rutas relevantes:
- `D:\proyectos\gi-clinicadental\runs\04-proteccion-antispam-y-abuso\spec.md`
- `D:\proyectos\gi-clinicadental\api\leads.js`
- `D:\proyectos\gi-clinicadental\docs\tecnica\endpoint-recepcion-leads.md`
- `D:\proyectos\gi-clinicadental\ROADMAP.md`
- `D:\proyectos\gi-clinicadental\scripts\feature-contract.ps1`
