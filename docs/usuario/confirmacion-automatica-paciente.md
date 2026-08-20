# Confirmación automática al paciente por email — documentación de usuario

## Para qué sirve

Cuando alguien completa el formulario de contacto del sitio (una vez que
esté conectado, ver "Qué falta todavía" en
`docs/usuario/proteccion-antispam-y-abuso.md`), además de que la clínica
recibe su notificación interna (ver
`docs/usuario/notificacion-clinica-smtp-ferozo.md`), esa misma persona
recibe **en su propia casilla de email** un correo confirmando que su
solicitud fue recibida. Así, quien completó el formulario tiene la
tranquilidad inmediata de saber que su mensaje llegó, sin tener que
esperar a que alguien de la clínica lo llame o le escriba para
confirmárselo.

## Qué ve el paciente en su bandeja de entrada

Un email con:

- Un saludo con su nombre.
- La confirmación de que su solicitud de contacto fue recibida
  correctamente.
- **Una aclaración clara y destacada de que su turno todavía NO está
  confirmado** — el email deja explícito que la clínica se va a
  comunicar próximamente para coordinar la fecha y el horario reales.
  Esto es intencional: el correo confirma que el *mensaje* llegó, no
  que ya hay un turno agendado.
- Una firma de "Sonríe más".

El email **no incluye** el teléfono, el servicio de interés ni el
mensaje que la persona escribió en el formulario — se mantiene
deliberadamente breve y sin repetir esos datos, para no reenviar por
email información que la persona ya completó unos segundos antes.

## Cómo funciona, en criollo

1. Alguien completa el formulario de contacto del sitio y lo envía.
2. El sistema guarda ese contacto de forma segura.
3. Inmediatamente después, el sistema envía dos correos: uno a la
   clínica (con los datos del contacto) y otro a la propia persona que
   completó el formulario (con el mensaje de confirmación descrito
   arriba). Ambos envíos son independientes: si uno falla, el otro se
   intenta igual.
4. Si el paciente responde a este correo de confirmación (por ejemplo,
   para agregar una aclaración), esa respuesta llega directo a la
   clínica, no se pierde en una casilla automatizada.

## Si llega dos veces el mismo contacto en pocos minutos

Igual que con la notificación a la clínica: si la misma persona (mismo
nombre y email) envía el formulario dos veces dentro de una ventana de 5
minutos, el sistema no lo trata como un contacto nuevo, y por lo tanto
**no se envía una segunda confirmación** por ese envío repetido.

## Qué hacer si un contacto no generó la confirmación al paciente

En algún caso puntual, el envío de este correo puede fallar (por ejemplo,
si el email que la persona escribió no existe o su casilla está llena).
Esto **no afecta al contacto en sí**: el dato de la persona queda igual
guardado de forma segura, solo que la confirmación por email no le llegó
a ella.

No hay, todavía, un panel propio del sitio para ver esto de un vistazo
(está previsto para más adelante, ítem `15` de la hoja de ruta del
proyecto). Mientras tanto, la forma de detectar estos casos es entrar al
panel de administración de Supabase (la base de datos donde se guardan
los contactos) y revisar la columna `confirmacion_paciente_enviada` de la
tabla `leads`: si dice `false`, ese contacto llegó y quedó guardado, pero
la confirmación por email a esa persona no se pudo enviar (o se envió
pero no se pudo marcar como enviada) — puede ser un buen indicio de que
conviene contactar a esa persona igual, por las dudas. Quien necesite
acceso al panel de Supabase para hacer esta revisión puede pedirlo a
quien administra técnicamente el sitio.

## Qué NO hace (por ahora)

- **No reintenta el envío automáticamente** si falla la primera vez.
- **No confirma un turno real**: solo confirma que el mensaje fue
  recibido. La coordinación de fecha y horario la sigue haciendo la
  clínica directamente con la persona.
- **No incluye** el teléfono, el servicio de interés ni el mensaje que
  la persona escribió — solo un saludo, la confirmación de recepción y
  la aclaración de que el turno todavía no está confirmado.
- **No cambia nada de lo que ve o completa la persona en el sitio**: este
  envío ocurre puertas adentro, después de que el contacto ya se guardó;
  la persona no ve ninguna diferencia en el formulario en sí, solo
  recibe el correo de confirmación después.

## Dónde ver esto en funcionamiento

No hay nada que configurar manualmente para que esta confirmación
funcione, más allá de que las credenciales del servidor de correo
(`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) y la casilla
`LEADS_NOTIFICATION_EMAIL` ya estén cargadas en la configuración de
Vercel (`docs/tecnica/configuracion-variables-entorno.md`) — son las
mismas variables ya necesarias para la notificación a la clínica. Con eso
cargado, cada contacto nuevo dispara ambos correos automáticamente, sin
intervención manual.
