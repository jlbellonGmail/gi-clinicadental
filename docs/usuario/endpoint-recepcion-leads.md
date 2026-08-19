# Endpoint de recepción de leads (`POST /api/leads`) — documentación de usuario

## Qué hace

Es la puerta de entrada real (aunque todavía no conectada al
formulario del sitio — ver "Qué NO hace todavía" abajo) para que un lead
completado se guarde en la base de datos de la clínica (Supabase, tabla
`leads`). Valida que los datos recibidos tengan sentido (nombre, email,
teléfono si se envía, consentimiento de privacidad aceptado, etc.) antes
de guardar nada, y responde con un código claro según lo que haya
pasado.

## Qué NO hace todavía

- **No está conectado al formulario del sitio.** El formulario de
  `index.html` sigue simulando el envío (no llama a este endpoint
  todavía) — eso lo hace la feature `08-conexion-frontend-api`, después
  de que la feature `07` agregue el checkbox de consentimiento y la
  política de privacidad (este endpoint exige que el usuario haya
  aceptado un consentimiento explícito, y el formulario actual no lo
  recolecta).
- **No envía ningún email.** La notificación a la clínica y la
  confirmación al paciente son las features `05` y `06`.
- **No tiene protección robusta contra abuso.** Sí corta después de 5
  solicitudes por minuto desde la misma IP (ver abajo), pero es una
  protección mínima y "mejor esfuerzo" — la protección real (CAPTCHA,
  campo trampa, validación de origen) es la feature `04`.

## Cómo probarlo manualmente (desarrollo local)

Requiere tener `vercel dev` corriendo (o cualquier forma de ejecutar
funciones Serverless de Node.js localmente) y las variables de entorno
`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` configuradas
(ver `.env.example` y `docs/usuario/configuracion-variables-entorno.md`)
apuntando a un proyecto Supabase real con la migración de la feature
`02` ya aplicada.

```powershell
npm install
vercel dev
```

Con el servidor local corriendo (normalmente en `http://localhost:3000`),
un envío exitoso con `curl`:

```bash
curl -i -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana Pérez",
    "email": "ana@example.com",
    "telefono": "+54 11 4444-5555",
    "servicio": "ortodoncia",
    "mensaje": "Quisiera turno para la semana que viene",
    "consentimiento_privacidad": true,
    "version_politica_privacidad": "v1"
  }'
```

Respuesta esperada (éxito):

```
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":"<uuid-generado-por-supabase>"}
```

## Qué respuestas esperar

| Situación | Código | Cuerpo (ejemplo) |
|---|---|---|
| Todo válido, lead guardado | `201` | `{"id":"..."}` |
| Método distinto de `POST` (ej. `GET`) | `405` | `{"error":"metodo_no_permitido"}` |
| `Content-Type` no es `application/json` | `400` | `{"error":"content_type_invalido"}` |
| Body de más de 10 KB | `413` | `{"error":"payload_demasiado_grande"}` |
| JSON mal formado | `400` | `{"error":"json_invalido"}` |
| Una propiedad que el endpoint no reconoce (ej. `role`) | `400` | `{"error":"propiedad_desconocida","campo":"role"}` |
| Falta `nombre`, `email` o `version_politica_privacidad` | `400` | `{"error":"campo_requerido_faltante","campo":"nombre"}` |
| Un campo tiene el tipo incorrecto (ej. `nombre` numérico) | `400` | `{"error":"tipo_invalido","campo":"nombre"}` |
| `email` con formato inválido | `400` | `{"error":"formato_email_invalido"}` |
| `telefono` con formato inválido | `400` | `{"error":"formato_telefono_invalido"}` |
| Un campo supera la longitud máxima permitida | `400` | `{"error":"longitud_excedida","campo":"mensaje"}` |
| `consentimiento_privacidad` no es exactamente `true` (falta, es `false`, o no es booleano) | `400` | `{"error":"consentimiento_requerido"}` |
| Más de 5 solicitudes desde la misma IP en 60 segundos | `429` | `{"error":"demasiadas_solicitudes"}` (con header `Retry-After`) |
| Fallo interno (ej. Supabase no responde) | `500` | `{"error":"error_interno"}` |

Ninguna respuesta expone detalles técnicos internos (mensajes de
Postgres/Supabase, stack traces, ni ninguna credencial).

## Nota sobre `telefono`/`servicio`/`mensaje`

Son opcionales. Si no se envían, o se envían pero quedan vacíos después
de recortar espacios (ej. `"   "`), se guardan como vacío (`null`) en la
base — no hace falta enviar cadenas vacías a propósito.
