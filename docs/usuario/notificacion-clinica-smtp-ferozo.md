# Notificación de nuevo lead a la clínica — documentación de usuario

## Para qué sirve

Cada vez que se recibe un contacto nuevo a través del sistema (una vez
que el formulario del sitio se conecte, ver "Qué falta todavía" en
`docs/usuario/proteccion-antispam-y-abuso.md`), la clínica recibe
automáticamente un email a la casilla configurada, con los datos de esa
persona: nombre, email, teléfono (si lo dejó), qué servicio le interesa
(si lo indicó), su mensaje (si escribió alguno), y la fecha y hora en
que llegó el contacto. Así, quien administra los contactos de la clínica
no necesita entrar a ningún panel para enterarse de que llegó un nuevo
interesado — se entera por email, como con cualquier otro correo.

## Cómo funciona, en criollo

1. Alguien completa el formulario de contacto del sitio (cuando esté
   conectado) y lo envía.
2. El sistema guarda ese contacto de forma segura.
3. Inmediatamente después, el sistema envía un email a la casilla
   configurada como "casilla de notificaciones de la clínica"
   (`LEADS_NOTIFICATION_EMAIL`, configurada en Vercel — ver
   `docs/tecnica/configuracion-variables-entorno.md` / `.env.example`),
   con los datos de ese contacto.
4. Ese email tiene como "Responder a" (`Reply-To`) la dirección de email
   de la propia persona que se contactó: quien lee la notificación puede
   apretar "Responder" en su cliente de correo y el mensaje va derecho
   al paciente, sin tener que copiar y pegar su dirección a mano.

## Si un dato no se completó

El teléfono, el servicio de interés y el mensaje son opcionales al
completar el formulario. Si alguno no se completó, el email de
notificación lo indica claramente ("No proporcionado", "No especificado"
o "Sin mensaje adicional", según el campo) — nunca aparece vacío ni con
la palabra "null".

## Si llega dos veces el mismo contacto en pocos minutos

Como ya explica `docs/usuario/proteccion-antispam-y-abuso.md`, si la
misma persona (mismo nombre y email) envía el formulario dos veces
dentro de una ventana de 5 minutos, el sistema no lo trata como un
contacto nuevo — y por lo tanto **no se envía una segunda notificación**
por ese envío repetido. La clínica solo recibe una notificación por
contacto real.

## Qué hacer si un contacto no generó la notificación por email

En algún caso puntual, el envío del correo puede fallar (por ejemplo, si
el servidor de correo estuvo momentáneamente caído). Esto **no afecta al
contacto en sí**: el dato de la persona que se contactó queda igual
guardado de forma segura, solo que la notificación por email no llegó.

No hay, todavía, un panel propio del sitio para ver esto de un vistazo
(está previsto para más adelante, ítem `15` de la hoja de ruta del
proyecto). Mientras tanto, la forma de detectar estos casos es entrar al
panel de administración de Supabase (la base de datos donde se guardan
los contactos) y revisar la columna `notificacion_clinica_enviada` de la
tabla `leads`: si dice `false`, ese contacto llegó pero la notificación
por email no se pudo enviar (o el envío se envió pero no se pudo marcar
como enviado) — igual está ahí, disponible, solo hay que revisarlo
manualmente esa vez. Quien necesite acceso al panel de Supabase para
hacer esta revisión puede pedirlo a quien administra técnicamente el
sitio.

## Qué NO hace (por ahora)

- **No reintenta el envío automáticamente** si falla la primera vez. Si
  en el futuro se detectan fallos frecuentes de envío, agregar un
  reintento automático es una mejora a evaluar más adelante, no algo que
  esta versión resuelva.
- **No envía todavía una confirmación al paciente** (un email
  "recibimos tu mensaje" para quien completó el formulario) — esa es una
  etapa posterior del proyecto, independiente de esta.
- **No cambia nada de lo que ve o completa la persona en el sitio**: todo
  este envío de notificación ocurre puertas adentro, después de que el
  contacto ya se guardó; la persona que completó el formulario no ve
  ninguna diferencia.

## Dónde ver esto en funcionamiento

No hay nada que configurar manualmente para que la notificación
funcione, más allá de que la casilla `LEADS_NOTIFICATION_EMAIL` y las
credenciales del servidor de correo (`SMTP_HOST`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_FROM`) ya estén cargadas en la configuración de
Vercel (`docs/tecnica/configuracion-variables-entorno.md`). Con eso
cargado, cada contacto nuevo dispara su notificación automáticamente, sin
intervención manual.
