status: rejected
attempt: 2
feedback:
  - "Contradicción real entre el criterio 6 y el criterio 14 sobre el
    código de error cuando `consentimiento_privacidad` está ausente: el
    criterio 6 lo incluye sin excepción en la lista de 'campos
    obligatorios' cuya ausencia produce `400 campo_requerido_faltante`
    ('Ausencia de cualquiera de estos → 400 (campo_requerido_faltante,
    identificando el campo)'); el criterio 14 dice, para el mismo caso
    exacto de ausencia, `400 consentimiento_requerido` ('Si es false, si
    falta, o si no es booleano → 400 (consentimiento_requerido)'). Son
    dos códigos de error distintos para el mismo escenario, sin ninguna
    frase de excepción en el criterio 6 que remita al 14 (a diferencia
    de cómo sí se resolvió correctamente esta misma clase de conflicto en
    el criterio 7, que dice explícitamente 'los campos obligatorios...
    siguen la regla del criterio 11'). Un builder-agent y un qa-agent no
    pueden decidir sin inventar cuál código usar, y es exactamente el
    tipo de ambigüedad que ya motivó el rechazo del intento 1. Acción
    concreta: agregar al criterio 6 una excepción explícita para
    `consentimiento_privacidad` que remita al criterio 14 (ej. '...
    excepto `consentimiento_privacidad`, cuya ausencia sigue
    exclusivamente la regla del criterio 14 y siempre responde
    `consentimiento_requerido`, nunca `campo_requerido_faltante`')."
  - "El mismo conflicto se repite entre el criterio 8 (validación de
    tipos: `consentimiento_privacidad` debe ser boolean; tipo incorrecto
    → `400 tipo_invalido`) y el criterio 14 ('si no es booleano → 400
    consentimiento_requerido'). Si el cliente envía
    `consentimiento_privacidad: \"true\"` (string, no boolean), el
    criterio 8 dicta `tipo_invalido` y el criterio 14 dicta
    `consentimiento_requerido` para el mismo input. La sección 'Casos
    borde' tampoco lo resuelve (solo dice '→ 400', sin código). Acción
    concreta: la misma excepción explícita agregada al criterio 6 debe
    cubrir también el criterio 8, dejando claro que para
    `consentimiento_privacidad` el único código posible en cualquier
    escenario de falla (ausente, `false`, tipo no-booleano) es
    `consentimiento_requerido`, y que los criterios 6/8 no aplican a este
    campo específico."
  - "Hallazgo menor, no bloqueante por sí solo pero conviene resolverlo en
    la misma revisión ya que se está tocando el orden de validaciones: el
    spec no define un orden/precedencia de validación cuando un mismo
    body dispara más de una condición de error simultáneamente (ej. un
    body con una propiedad desconocida 'role' Y sin 'nombre' — ¿responde
    `propiedad_desconocida` o `campo_requerido_faltante`?). Con los
    códigos de error ya bien nombrados y deterministas, falta solo la
    secuencia en que se evalúan los criterios 2 a 14 para que el
    comportamiento sea 100% reproducible en tests. Sugerencia: numerar
    explícitamente el orden de validación (ej. método → Content-Type →
    tamaño del body → JSON válido → propiedades desconocidas → campos
    obligatorios → tipos → formatos → consentimiento) o aclarar que el
    orden es indistinto porque cada validación es mutuamente excluyente
    en la práctica (si es así, decirlo explícitamente)."

## Auditoría — `03-endpoint-recepcion-leads`, intento 2

### Verificación de los 4 puntos corregidos (foco principal de esta auditoría)

**1. Gap de CI (criterio 24, nuevo)** — Verifiqué `.github/workflows/ci.yml`
actual: efectivamente hoy solo tiene el job `test` con
`actions/setup-python@v5` + `pip install -r requirements-dev.txt` +
`pytest -v`, tal como describe el spec. El criterio 24 es concreto y
accionable: exige `actions/setup-node@v4` con `node-version: '20'` (o
≥18), un paso de instalación de dependencias Node (`npm ci` o
`npm install`, con la decisión documentada en "Riesgos/supuestos" según
exista o no `package-lock.json`), un script `"test": "node --test"` en
`package.json`, convención de nombrado `*.test.js` para los archivos de
test, un paso `npm test`, y exige explícitamente que el paso falle
(exit code ≠ 0) si algún test Node falla, sin debilitar el paso de
`pytest` existente. Esto cierra exactamente el gap que señalé en
`audit-1.md`: "CI verde" certificará ambas suites en el mismo pipeline.
**Correctamente resuelto.**

**2. Campos opcionales vacíos tras `trim()` (criterio 7)** — La regla
ahora es inequívoca: cualquiera de los tres campos opcionales
(`telefono`, `servicio`, `mensaje`) presente pero vacío tras `trim()` se
trata "exactamente igual que si el campo estuviera ausente": se inserta
`null`, nunca `""`. El criterio 7 además incluye la frase de excepción
explícita que evita cualquier lectura contradictoria con el criterio 11:
"Esta regla aplica solo a estos tres campos opcionales; los campos
obligatorios de tipo string (`nombre`, `version_politica_privacidad`)
siguen la regla del criterio 11 (vacío tras `trim()` → `400
campo_requerido_faltante`...)". Esta es exactamente la forma correcta de
resolver un conflicto potencial entre dos criterios — y es, por
contraste, el patrón que faltó aplicar al conflicto que encontré entre
los criterios 6/8/14 (ver `feedback`). **Correctamente resuelto, sin
contradicción con el criterio 11.**

**3. Content-Type con charset (criterio 3)** — Ahora define un algoritmo
determinista e implementable: tomar la porción del header antes del
primer `;`, `trim().toLowerCase()`, comparar por igualdad estricta contra
`"application/json"`. Cubre explícitamente el caso de header ausente
(→ 400) y de subtipos distintos como `application/json-patch+json` o
`application/json+ld` (no matchean por igualdad estricta → 400). La
sección "Casos borde" reproduce el mismo criterio con ejemplos
concretos (`application/json; charset=utf-8` aceptado,
`application/json-patch+json` rechazado). Es testeable sin ambigüedad:
un QA-agent puede escribir el test directamente desde la redacción del
criterio. **Correctamente resuelto.**

**4. Auto-parseo de body en Vercel (criterio 13)** — La nota de
implementación ahora es explícita y coherente con el resto del contrato:
exige deshabilitar el auto-parseo (`config.api.bodyParser = false` o
equivalente), leer el stream/buffer crudo, acumular bytes y cortar con
`413` al superar 10240 bytes, **antes** de invocar `JSON.parse`. Verifiqué
que esto no entra en conflicto con el criterio 4 (JSON inválido → 400):
el orden implícito es medir tamaño crudo primero, parsear después, lo
cual es consistente entre ambos criterios. Tampoco conflictúa con el
criterio 3 (`Content-Type`), que se valida contra `req.headers`,
inafectado por deshabilitar el body parser automático de Vercel. **Nota
coherente y sin contradicciones con otros criterios.**

### Pasada general de consistencia (más allá de los 4 puntos)

Encontré la contradicción listada en `feedback` (criterios 6 vs 8 vs 14
sobre el código de error de `consentimiento_privacidad`). Es un hallazgo
nuevo, no relacionado con los 4 puntos que motivaron el rechazo del
intento 1, pero cae directamente dentro del alcance de esta auditoría
("¿los criterios de aceptación son verificables, o vagos?" y "pasada
general de consistencia"). Es objetivamente accionable: no requiere
rediseñar nada, solo agregar la misma clase de frase de excepción que ya
se usó correctamente en el criterio 7.

**Numeración de criterios**: secuencial y correcta, 1–23 (Contrato del
endpoint), 24 (Integración con CI), 25–29 (Documentación y artefactos).
Sin huecos ni duplicados.

**Verificación cruzada con el repo real** (no delegada solo a la memoria
de `audit-1.md`):
- `ROADMAP.md` línea 93, ítem `03-endpoint-recepcion-leads`: el spec
  cubre todos los elementos que pide el ítem (validaciones, escape para
  emails futuros, inserción server-side, `201`, respuestas controladas
  `400/405/413/429/500`). Coincide.
- `.github/workflows/ci.yml`: confirmado tal cual lo describe el spec
  (solo Python + pytest hoy). El criterio 24 parte de una base real, no
  de una suposición.
- `docs/tecnica/index.md` y `docs/usuario/index.md`: confirmado que hoy
  solo listan `landing.md`, `configuracion-variables-entorno.md` e
  `inicializacion-supabase-schema.md` — ningún enlace a
  `endpoint-recepcion-leads.md` ni `arquitectura.md` todavía, consistente
  con lo que el criterio 29 exige agregar.

### Verificación de los 4 disparadores de rechazo automático (checklist `AGENTS.md`)

- **Docs técnica/usuario exigidas**: criterios 25 y 26 exigen
  `docs/tecnica/endpoint-recepcion-leads.md` y
  `docs/usuario/endpoint-recepcion-leads.md`, ambos "no vacío" con
  contenido mínimo definido con precisión (incluyendo, en el criterio 25,
  la obligación de documentar la regla de `Content-Type` y la regla de
  campos opcionales vacíos tras `trim()` — ambas corregidas en este
  intento). **No dispara rechazo automático.**
- **`decision.md` + enlaces exactos en ambos índices**: criterio 28
  (`decision.md`) y criterio 29 (enlaces exactos en
  `docs/tecnica/index.md` y `docs/usuario/index.md`, incluyendo
  `arquitectura.md` si no estaba ya enlazado). **No dispara rechazo
  automático.**
- **Destino de datos personales y consentimiento**: declarado con
  precisión desde "Alcance" y los criterios 6/14/15 (Supabase, tabla
  `leads`, exclusivamente server-side con `SUPABASE_SERVICE_ROLE_KEY`,
  consentimiento boolean obligatorio que debe ser exactamente `true`).
  **No dispara rechazo automático** (aunque el código de error exacto
  para su ausencia/tipo inválido queda contradictorio — ver `feedback`,
  el *destino* y la *exigencia* de consentimiento en sí están bien
  declarados, por eso esto no cae en este disparador específico sino en
  un hallazgo de consistencia aparte).
- **Contenido médico/clínico inventado**: ninguno; el spec sigue siendo
  puramente técnico. **No dispara rechazo automático.**

### Conclusión

Los 4 puntos que motivaron el rechazo del intento 1 (gap de CI,
ambigüedad de campos opcionales vacíos, ambigüedad de `Content-Type` con
charset, nota de auto-parseo de Vercel) están resueltos de forma
concreta, verificable e implementable — trabajo sólido del
analyst-agent en esta revisión. Sin embargo, la pasada general de
consistencia que pide esta auditoría encontró una contradicción real y
accionable, no señalada antes, entre los criterios 6, 8 y 14 sobre qué
código de error `400` corresponde quándo `consentimiento_privacidad`
está ausente o tiene tipo incorrecto. Es una corrección acotada (agregar
una frase de excepción, igual al patrón ya usado en el criterio 7), no
un rediseño del spec ni evidencia de que el bloqueo esté en el pedido
original del roadmap — el ítem `03` no exige nada de esto en particular,
es puramente un defecto de redacción del spec corregible en un tercer
intento.
