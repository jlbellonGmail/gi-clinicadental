status: rejected
attempt: 1
feedback:
  - "Gap de integración CI: el spec exige tests unitarios reales (criterios
    21 y 22: tests de `escapeHtml()`, tests del handler con cliente
    Supabase inyectado vía `node --test`), pero en ningún criterio de
    aceptación exige actualizar `.github/workflows/ci.yml` para instalar
    dependencias Node y ejecutar esos tests. Verifiqué el workflow actual
    (`.github/workflows/ci.yml`): solo corre `pytest -v` sobre `tests/`.
    El circuito exige 'CI verde' (AGENTS.md, paso 7) como gate obligatorio
    antes del HITL — con el spec tal como está, ese gate seguiría siendo
    verde ejecutando *solo* pytest, sin correr ni una sola vez los tests
    del endpoint que este spec exige escribir. Es la primera pieza de
    código de aplicación real del repo: si no se corrige ahora, cualquier
    regresión futura en `api/leads.js` pasaría CI sin ser detectada.
    Acción concreta: agregar un criterio de aceptación explícito que
    exija actualizar `.github/workflows/ci.yml` (o agregar un job nuevo)
    para instalar Node ≥18, y ejecutar `node --test` (o `npm test`,
    definiendo el script correspondiente en `package.json`) como parte
    del mismo pipeline de CI que ya audita `pytest`."
  - "Ambigüedad no resuelta en campos opcionales con string vacío tras
    `trim()`: el criterio 7 dice que si `telefono`/`servicio`/`mensaje`
    'están ausentes, se insertan como null', y el criterio 11 solo define
    qué pasa si quedan vacíos tras `trim()` para `nombre` y
    `version_politica_privacidad` (obligatorios). No queda definido qué
    debe pasar si el cliente envía `telefono: \"   \"` (presente, pero
    vacío tras trim) — ¿se trata como 'ausente' y se inserta `null`, o se
    inserta el string vacío `\"\"`? Esto es directamente verificable por
    QA y hoy no lo es: agregar una regla explícita, ej. 'todo campo
    opcional string cuyo valor quede vacío tras trim() se inserta como
    null, igual que si estuviera ausente'."
  - "Ambigüedad en el criterio 3 (validación de `Content-Type`): el spec
    dice 'Si Content-Type no es application/json, devuelve 400' sin
    aclarar si se acepta un sufijo de charset (ej.
    `application/json; charset=utf-8`, común en algunos clientes/
    librerías HTTP) o si se exige igualdad estricta del header completo.
    Sin esta definición, un implementador y un QA-agent pueden llegar a
    interpretaciones distintas y escribir tests contradictorios. Definir
    explícitamente la regla (ej. 'se acepta cualquier valor cuyo tipo
    MIME, ignorando parámetros como charset, sea exactamente
    application/json')."
  - "Nota técnica a incorporar (no bloqueante por sí sola, pero relevante
    para que el builder-agent no se sorprenda): el criterio 13 exige
    devolver 413 por tamaño de payload > 10 KB 'sin necesidad de
    parsear/validar el contenido primero'. Las Serverless Functions de
    Vercel con el runtime Node.js por defecto parsean automáticamente
    `req.body` cuando el `Content-Type` es `application/json` (helper de
    `@vercel/node`), lo que puede interferir con medir el tamaño del
    payload crudo antes de parsear. El spec debería mencionar
    explícitamente que el handler necesita deshabilitar ese
    auto-parseo (`config.api.bodyParser = false` o equivalente) y leer el
    stream/buffer crudo para poder cortar en 10 KB antes de intentar
    `JSON.parse`. Si no se aclara, es razonable que el builder lo resuelva
    de otra forma, pero conviene que quede explícito para que el criterio
    13 sea implementable tal como está redactado."

## Auditoría — `03-endpoint-recepcion-leads`, intento 1

### Verificación de los rechazos automáticos (checklist AGENTS.md)

- **Docs técnica/usuario**: el spec exige explícitamente
  `docs/tecnica/endpoint-recepcion-leads.md` (criterio 24) y
  `docs/usuario/endpoint-recepcion-leads.md` (criterio 25), ambos "no
  vacío" y con contenido mínimo definido. **No dispara rechazo
  automático.**
- **`decision.md` y enlaces en ambos índices**: criterios 27 y 28 exigen
  `runs/03-endpoint-recepcion-leads/decision.md` y enlaces exactos en
  `docs/tecnica/index.md` y `docs/usuario/index.md` (más el enlace de
  `arquitectura.md` en el índice técnico si no existía ya). **No dispara
  rechazo automático.**
- **Destino de datos personales y consentimiento**: el spec declara con
  precisión a dónde van los datos (Supabase, tabla `leads`, exclusivamente
  server-side vía `SUPABASE_SERVICE_ROLE_KEY`) y qué validación de
  consentimiento aplica (`consentimiento_privacidad` boolean obligatorio,
  debe ser exactamente `true`, si no `400` y no se inserta — criterios 6 y
  14). **No dispara rechazo automático.**
- **Contenido médico/clínico inventado**: el spec es puramente técnico
  (validación, contrato HTTP, persistencia); no introduce tratamientos,
  precios ni certificaciones. **No dispara rechazo automático.**

Ninguno de los cuatro disparadores de rechazo automático del checklist
aplica. El rechazo de este intento es por los puntos listados en el
bloque `feedback` (gap de CI + dos ambigüedades verificables), no por
estos disparadores obligatorios.

### Puntos específicos pedidos en la tarea

1. **Docs/decision/índices obligatorios**: cumplidos (criterios 24–28).
   Ver arriba.

2. **Decisión de NO tocar `index.html`/`script.js`**: verifiqué
   directamente el formulario actual (`index.html` líneas 146–169): campos
   `name`, `email`, `service` (select con 4 opciones fijas: `implantes`,
   `ortodoncia`, `blanqueamiento`, `otro`), `message`. **No existe** campo
   `telefono`, ni checkbox de consentimiento, ni ningún campo
   `version_politica_privacidad`. El `script.js` confirma la simulación
   (`// Simulate API call`, `setTimeout`). La justificación del spec es
   sólida y verificable: conectar el frontend ahora forzaría un `400`
   sistemático (falta `consentimiento_privacidad`) o a inventar un
   consentimiento falso, lo cual el propio spec identifica correctamente
   como violación de la regla de dominio de `AGENTS.md`. Además, el
   roadmap ya separa esto explícitamente en `07` (agrega el checkbox +
   política) y `08` (conecta `fetch()`), slugs verificados en
   `ROADMAP.md` líneas 101 y 103. **No es una forma de esquivar trabajo:
   es la secuenciación correcta dado el estado real del formulario.**

3. **Rate limiting best-effort en memoria**: interpretación razonable del
   ítem `03` del roadmap ("implementar respuestas controladas para
   códigos... 429"), que en efecto no dice explícitamente que sea
   provisional pero tampoco exige mecanismo persistente/distribuido — eso
   se reserva textualmente para `04-proteccion-antispam-y-abuso`
   ("rate limiting, validación de origen... antispam... idempotencia").
   El spec documenta el trade-off en la sección "Riesgos / supuestos" e
   invita explícitamente al reviewer a objetar. Acepto la división
   propuesta: es consistente con el orden del roadmap y no le pide a `03`
   nada que el roadmap reserve para `04`.

4. **`docs/tecnica/arquitectura.md` disparado por esta feature**:
   correcto. Verifiqué que `docs/tecnica/inicializacion-supabase-schema.md`
   (feature `02`, ya mergeada) documenta la tabla `leads` pero no crea
   `arquitectura.md`, y que ese archivo no existe todavía en el repo. La
   regla de dominio de `AGENTS.md` ("No agregar un backend, base de
   datos o dependencia de build sin que quede como una decisión de
   arquitectura explícita en `docs/tecnica/arquitectura.md`") nunca se
   cumplió formalmente para Supabase (`02`) ni para las variables SMTP
   (`01`) — esta feature es la primera en introducir *código* de backend
   y una dependencia npm real (`@supabase/supabase-js`), así que es
   razonable (y deseable) que dispare la creación de ese documento ahora,
   documentando retroactivamente también la decisión de usar Supabase
   como base de datos. Correcto que lo haga `03`.

5. **Límites numéricos (longitudes, 10 KB, 5 req/60s)**: el propio spec
   los marca explícitamente como supuestos propios del analyst, ajustables
   por el reviewer ("Riesgos / supuestos"). Los valores son razonables
   para un formulario de contacto de una clínica (nombre hasta 150,
   mensaje hasta 2000, payload hasta 10 KB, 5 req/60s). No encuentro
   motivo para objetarlos numéricamente; están correctamente señalizados
   como ajustables, no impuestos como verdad absoluta.

6. **Consistencia interna / verificabilidad para QA**: en general los
   códigos de error están bien nombrados y son deterministas
   (`content_type_invalido`, `json_invalido`, `propiedad_desconocida`,
   `campo_requerido_faltante`, `tipo_invalido`, `formato_email_invalido`,
   `formato_telefono_invalido`, `longitud_excedida`,
   `consentimiento_requerido`, `demasiadas_solicitudes`,
   `error_interno`), lo cual es un punto fuerte del spec. Sin embargo,
   encontré dos ambigüedades concretas que impiden que un QA-agent escriba
   tests sin tener que inventar una interpretación propia — ver
   `feedback` (manejo de string vacío en campos opcionales, y definición
   exacta de `Content-Type` válido). Ambas son fácilmente corregibles con
   una frase adicional cada una.

7. **Contradicción Alcance / Fuera de alcance**: no encontré ninguna. La
   utilidad `escapeHtml` se menciona consistentemente en ambas secciones
   (se crea en `03`, se usa recién en `05`/`06`); el rate limiting se
   menciona consistentemente (respuestas `429` sí, protección robusta no);
   no se pide crear en "Alcance" nada que "Fuera de alcance" luego prohíba
   tocar.

### Verificación del mapeo campo → columna contra la migración real

Comparé el criterio 15 del spec contra
`supabase/migrations/20260819210130_create_leads_table.sql` línea por
línea:

| Columna migración | NOT NULL / default | Mapeo del spec | Correcto |
|---|---|---|---|
| `nombre` | NOT NULL, sin default | `nombre`→`nombre`, obligatorio | Sí |
| `email` | NOT NULL, sin default | `email`→`email`, obligatorio | Sí |
| `telefono` | nullable | `telefono`→`telefono` o `null` | Sí |
| `servicio` | nullable | `servicio`→`servicio` o `null` | Sí |
| `mensaje` | nullable | `mensaje`→`mensaje` o `null` | Sí |
| `estado` | NOT NULL default `'nuevo'` | no se envía, se deja default | Sí |
| `origen` | NOT NULL default `'formulario_web'` | no se envía, se deja default | Sí |
| `consentimiento_privacidad` | NOT NULL, **sin default** | obligatorio, debe ser `true` | Sí |
| `version_politica_privacidad` | NOT NULL, sin default | obligatorio string | Sí |
| `notificacion_clinica_enviada` | NOT NULL default `false` | no se envía | Sí |
| `confirmacion_paciente_enviada` | NOT NULL default `false` | no se envía | Sí |
| `fecha_creacion` / `fecha_actualizacion` | NOT NULL default `now()` | no se envía | Sí |

No hay discrepancias. El mapeo es exacto y respeta los `NOT NULL`/
defaults reales de la migración de `02`. **No es motivo de rechazo.**

### Verificación de referencias a features futuras del roadmap

Confirmé en `ROADMAP.md` que existen exactamente con esos números/slugs:
`04-proteccion-antispam-y-abuso` (línea 95), `05-notificacion-clinica-smtp-ferozo`
(línea 97), `06-confirmacion-automatica-paciente` (línea 99),
`07-seguridad-y-politica-privacidad` (línea 101),
`08-conexion-frontend-api` (línea 103), `09-rediseño-estetico-y-assets`
(línea 105). Ninguna referencia inventada.

### Verificación de `.env.example`

`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, tal como los
asume el spec, existen exactamente con esos nombres en `.env.example`
(líneas 31 y 38). Correcto.

### Conclusión

El spec está mayormente bien construido: contrato del endpoint detallado
y verificable, mapeo campo→columna verificado exacto contra la migración
real, decisión de no tocar el frontend bien justificada con evidencia
concreta del estado actual del formulario, disparo correcto de
`arquitectura.md`, y referencias al roadmap todas verificadas. Rechazo
este intento únicamente por el gap de integración CI (que compromete la
garantía central del circuito: "CI verde" antes del HITL) y dos
ambigüedades puntuales y fácilmente corregibles en los criterios de
aceptación. No veo indicios de que el bloqueo esté en el pedido original
(roadmap ítem `03`) — es un ajuste acotado al spec, no una limitación del
alcance pedido por el negocio.
