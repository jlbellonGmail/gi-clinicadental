# Landing page — documentación de usuario

Página de presentación y captación de pacientes para Savia Dental.

## Cómo verla localmente

Es un sitio estático, no necesita servidor ni build. Cualquiera de estas
opciones sirve:

```powershell
# Opción 1: abrir directo en el navegador
start index.html

# Opción 2: servirlo por HTTP (recomendado, evita restricciones de file://)
python -m http.server 8000
# luego abrir http://localhost:8000/
```

## Qué incluye hoy

- Presentación de la clínica y sus números (hero + stats).
- 6 servicios destacados (implantes 24h, ortodoncia invisible, diseño de
  sonrisa digital, blanqueamiento, odontología infantil, armonización
  orofacial).
- Sección de equipo / enfoque humano.
- Formulario de contacto para pedir una "consulta diagnóstica gratuita"
  (nombre, email, servicio de interés, mensaje opcional).

## Importante: el formulario todavía no envía nada

Al completarlo y enviarlo, el botón muestra "¡Solicitud Enviada!" pero
es una simulación (`setTimeout` en `script.js`) — **ningún dato se
guarda ni se envía a la clínica**. Conectarlo a un destino real (email,
CRM, base de datos) es la próxima feature natural — ver `ROADMAP.md`.

## Qué pasa al enviar el formulario

Cuando alguien completa el formulario y toca **Enviar Solicitud**:

1. El botón se bloquea al instante y pasa a decir **"Enviando
   solicitud..."**, con un indicador de que el sistema está trabajando.
   El envío tarda unos segundos porque, además de guardar la solicitud,
   el sistema avisa a la clínica y le confirma la recepción al paciente.
2. Volver a tocar el botón, o apretar Enter otra vez, **no genera una
   segunda solicitud**. Antes sí podía pasar: como el proceso tarda,
   parecía que no había ocurrido nada.
3. Si todo sale bien aparece un cartel de confirmación: *"Solicitud
   enviada — Recibimos tu solicitud correctamente. Tu turno todavía no
   está confirmado. Nos comunicaremos con vos para coordinarlo."* Se
   cierra con el botón **Entendido** o con la tecla `Escape`, y el
   formulario queda limpio.
4. Si algo falla aparece un mensaje en rojo encima del botón, **los datos
   escritos se conservan** y se puede reintentar sin volver a tipear
   nada.

El cartel de confirmación **no dice que se haya enviado un correo**, y es
a propósito: el sitio confirma que recibió la solicitud, que es lo único
que puede asegurar en ese momento. Los correos se envían inmediatamente
después y, si uno fallara, la solicitud igual quedó registrada y la
clínica la ve.

Los mensajes de error nunca muestran detalles técnicos.
