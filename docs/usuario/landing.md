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
   Tarda unos segundos porque, además de guardar la solicitud, el sistema
   avisa a la clínica y le confirma la recepción a la persona.
2. Volver a tocar el botón, o apretar Enter otra vez, **no genera una
   segunda solicitud**.
3. Al terminar aparece uno de tres carteles, según lo que haya pasado.

| Situación | Cartel | Qué pasa con el formulario |
|---|---|---|
| Todo salió bien | **Solicitud enviada** | se limpia |
| La solicitud se guardó pero falló algún correo | **Solicitud registrada** | se limpia |
| La solicitud no se pudo guardar | **No pudimos registrar tu solicitud** | **se conservan los datos** para reintentar |

El cartel se cierra con **Entendido** o con `Escape`, y la persona se
queda en la misma página.

En el segundo caso el mensaje dice explícitamente **"No es necesario que
vuelvas a enviar el formulario"**: la solicitud ya está guardada y
reenviarla crearía una duplicada. Esas solicitudes quedan marcadas para
revisión — ver
[Solicitudes que necesitan revisión](estado-comunicacion-leads.md).

Solo en el tercer caso se invita a reintentar, porque ahí no quedó nada
guardado.

**Ningún cartel dice que se haya enviado un correo**, y es a propósito: el
sitio confirma lo único que puede asegurar en ese momento, que recibió la
solicitud.

Los mensajes de error nunca muestran detalles técnicos.
