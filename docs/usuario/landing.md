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
