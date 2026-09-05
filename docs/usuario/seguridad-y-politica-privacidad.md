# Seguridad y política de privacidad — documentación de usuario

## Para qué sirve

Antes de esta feature, el formulario de contacto de la clínica
(`index.html`) no le pedía a la persona que lo completa ningún tipo de
consentimiento explícito para que la clínica use sus datos, ni existía
ninguna página donde explicar qué se hace con esa información. Esta
feature agrega:

- Una casilla obligatoria ("He leído y acepto la política de privacidad
  y autorizo a la clínica a contactarme...") que la persona debe marcar
  antes de poder enviar el formulario.
- Una página nueva, `politica-privacidad.html`, que explica en lenguaje
  claro qué datos se guardan, para qué se usan, quién los puede ver y
  cómo pedir acceder a ellos, corregirlos o eliminarlos.

## Cómo verlo

1. Abrí `index.html` en el navegador y bajá hasta el formulario de
   contacto ("Empecemos a trabajar en tu nueva sonrisa").
2. Justo antes del botón "Enviar Solicitud" vas a ver la nueva casilla de
   consentimiento, con un enlace a "política de privacidad".
3. Hacé click en ese enlace (o en "Privacidad", en el pie de página del
   sitio) para abrir `politica-privacidad.html` en una pestaña nueva.

## Cómo se comporta el formulario

- **Si no marcás la casilla**, el formulario no se puede enviar: el
  navegador muestra su propio mensaje de "completá este campo" y el
  botón nunca cambia a "Enviando...". Esto funciona incluso si por algún
  motivo el JavaScript del sitio no llegara a cargar.
- **Si marcás la casilla** y completás nombre y email (los otros campos
  obligatorios que ya existían), el formulario funciona exactamente igual
  que antes: simula el envío, muestra "¡Solicitud Enviada!" y se
  restablece — incluida la casilla de consentimiento, que vuelve a quedar
  destildada para un próximo envío.
- Hacer click específicamente en el enlace "política de privacidad" (no
  en el resto del texto) abre la página de la política, sin marcar ni
  desmarcar la casilla.

## Qué dice la página de política de privacidad

La página explica, con un título por sección:

1. **Finalidad**: para qué se usan los datos que dejás en el formulario
   (contactarte para responder tu consulta y, si corresponde, coordinar
   un turno).
2. **Datos almacenados**: qué información se guarda (nombre, email,
   servicio de interés, mensaje, fecha, y el registro de que diste tu
   consentimiento).
3. **Responsable del tratamiento**, **Plazo de conservación** y **canal
   para ejercer tus derechos** (acceso, rectificación, eliminación): estos
   tres puntos todavía no tienen un dato real de la clínica cargado —
   ver "Qué debe completar la clínica" abajo.
4. **Destinatarios**: quién puede ver tus datos (personal administrativo
   de la clínica, y los proveedores técnicos que hacen posible guardarlos
   y notificar por email — Supabase y el servicio de correo de Ferozo).
5. Un número de versión visible al pie del título ("Versión: ..."), para
   poder identificar qué versión de la política aceptó cada persona.

## Qué debe completar la clínica antes de publicar en producción

La página marca claramente, con un fondo destacado y el texto **"[A
COMPLETAR POR EL CLIENTE: ...]"**, los datos que todavía no están
confirmados porque nadie del negocio real los proveyó todavía:

- **Responsable del tratamiento**: razón social, CUIT/identificación
  fiscal y domicilio legal de la clínica.
- **Plazo de conservación**: durante cuánto tiempo se guardan los datos
  de un contacto (por ejemplo, "6 meses desde el último contacto" o
  "hasta que el paciente pida su eliminación" — a decidir por la
  clínica).
- **Canal de contacto para ejercer derechos** (acceso, rectificación,
  eliminación): un email o medio oficial dedicado a este tipo de
  solicitudes. Todavía no se usa el email general del sitio
  (`hola@saviadental.com`) porque es un dato de plantilla no verificado
  (ver el ítem `10-actualizacion-datos-contacto` del `ROADMAP.md`).

**Importante**: ninguno de estos tres puntos se completó con un valor
inventado. Antes de que el sitio se use en producción con pacientes
reales, alguien de la clínica (o su asesor legal/administrativo) debe
revisar y completar esos tres puntos directamente en
`politica-privacidad.html`, reemplazando el texto entre corchetes por el
dato real.

## Qué NO cambia todavía

- El formulario **sigue sin enviar datos reales a ningún lado**: sigue
  siendo una simulación (mismo comportamiento que antes de esta feature).
  La conexión real con el sistema de recepción de leads es una etapa
  posterior del proyecto (feature `08-conexion-frontend-api`).
- No se agregó ningún campo nuevo al formulario (nombre, email, servicio
  y mensaje siguen siendo los únicos datos que se piden, además de la
  nueva casilla de consentimiento) — no se pide ningún dato clínico o de
  salud adicional.
