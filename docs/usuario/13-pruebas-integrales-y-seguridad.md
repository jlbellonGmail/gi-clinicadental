# 13-pruebas-integrales-y-seguridad

## Propósito

Este documento explica cómo usar y entender las pruebas automatizadas de seguridad y funcionalidad para el formulario de contacto y el endpoint de leads. Está dirigido a quien administra el sitio o quiere verificar que todo funciona correctamente.

## Ejecutar las pruebas

### Tests automáticos

Los tests se ejecutan con `npm test` en la raíz del proyecto. Este comando corre todos los tests de Node.js en `api/leads.test.js` y validará:

- Que el endpoint responde correctamente a requests válidos e inválidos
- Que las validaciones de campo funcionan (longitudes, formatos, tipos)
- Que el consentimiento es obligatorio
- Que los correos se envían correctamente (o fallan de forma controlada)
- Que no se filtran credenciales en respuestas o logs
- Que la inserción en Supabase es correcta

### Verificar manualmente

Para verificar el flujo end-to-end manualmente:

1. **Completar el formulario** en la landing page con datos reales (nombre, email, teléfono opcional, servicio, mensaje)

2. **Aceptar la política de privacidad** (checkbox obligatorio)

3. **Enviar la solicitud**

4. **Verificar la respuesta**: Deberías ver un mensaje "Solicitud recibida. La clínica se comunicará para confirmar el turno"

5. **Revisar el correo electrónico de la clínica**: Debe llegar a la bandeja de entrada con los datos del paciente correctamente escapados (sin etiquetas HTML sin procesar)

6. **Revisar el correo de confirmación al paciente**: Debe llegar al email proporcionado confirmando la recepción de la solicación y aclarando que el turno aún no está confirmado

7. **Confirmar en la base de datos** (si tienes acceso): El lead debe aparecer en la tabla `leads` con los datos correctos

## ¿Qué verificar si algo falla

### Si el formulario no envía:

- Revisa la consola del navegador por errores de red (status 400, 405, 429, 500)
- Verifica que hayas llenado todos los campos obligatorios: nombre, email, y el checkbox de consentimiento
- Confirma que el email tenga un formato válido (usuario@dominio.tld)

### Si no llegan los correos:

- Revisa los logs del lado del servidor (errores de SMTP, configuración incorrecta)
- Verifica que las variables de entorno SMTP estén configuradas en Vercel
- Confirma que el dominio tenga los registros SPF/DKIM/DMARC configurados

### Si ves información sensible en la UI o logs:

- Esto debería imposible debido a las validaciones de seguridad
- Reporta inmediatamente para rotar credenciales si las hubo

## Credenciales y seguridad

- **Ninguna credencial SMTP** (`SMTP_PASS`, `SMTP_USER`, `SUPABASE_SERVICE_ROLE_KEY`) debería aparecer nunca en:
  - La página web vista en el navegador
  - Las respuestas HTTP del API
  - Los logs de la consola del navegador
  - El historial de Git (asegúrate de que `.env` no esté commiteado)
  - Los artefactos de compilación

- Los datos del paciente (nombre, email, mensaje) sí pueden aparecer en los correos y en la base de datos, pero siempre protegidos por RLS en Supabase y acceso exclusivo desde el backend.

## Preguntas frecuentes

**¿Por qué a veces el formulario dice "Demasiados intentos, espere unos minutos"?**

Esto significa que desde tu IP se han enviado más de 5 solicitudes en los últimos 60 segundos. Espera un poco y vuelve a intentarlo.

**¿Por qué el checkbox de consentimiento es obligatorio?**

Es un requisito legal y de protección de datos para asegurarnos de que el paciente acepta que sus datos sean procesados para la captación médica. Sin este consentimiento, la solicitud no puede ser procesada.