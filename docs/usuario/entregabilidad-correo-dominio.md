# Entregabilidad de correo dominio

## ¿Qué verificamos?

Confirmamos que los correos electrónicos enviados desde el formulario de la clínica dental lleguen correctamente a los destinatarios sin ser bloqueados o clasificados como spam.

## Configuración técnica

Los siguientes registros deben estar configurados en la zona DNS de tu dominio:

### Registro SPF (Sender Policy Framework)

- Autoriza los servidores permitidos para enviar correo en nombre de tu dominio.
- Ejemplo de valor: `v=spf1 include:_spf.google.com ~all`
- Si usas Ferozo SMTP, consulta con ellos la cadena SPF correcta para agregar.

### Registro DKIM (DomainKeys Identified Mail)

- Firma los correos salientes para validar que no han sido alterados.
- Debe activarse en el panel de control de Ferozo y la clave pública publicada en DNS.

### Registro DMARC (Domain-based Message Authentication, Reporting, and Conformance)

- Política de qué hacer cuando los correos no pasan SPF/DKIM.
- Valor inicial recomendado: `v=DMARC1; p=none; rua=mailto:dmarc@tudominio.com; ruf=mailto:dmarc-failure@tudominio.com`
- Luego se puede subir a `p=quarantine` y finalmente a `p=reject`.

## Conexiones SMTP seguras

- **Servidor**: Proporcionado por Ferozo (generalmente `smtp.ferozo.com`)
- **Puerto**: 465 (SSL/TLS) o 587 (STARTTLS)
- **Credenciales**: Almacenadas en las variables de entorno de Vercel (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Nunca en el código frontend.

## Pasos para probar la recepción

1. Envía un mensaje de prueba desde el formulario de contacto
2. Revisa la bandeja de entrada y la carpeta de spam en: Gmail, Outlook, Yahoo
3. Si el correo aparece en spam, marca como "No es spam" y agrega el remitente a tus contactos
4. Revisa los encabezarios del correo recibido para verificar SPF/DKIM/DMARC

## ¿Qué hacer si los correos van a spam?

- Verifica que los registros SPF, DKIM y DMARC estén correctamente publicados (puede tardar hasta 48 horas en propagarse)
- Contacta a Ferozo para confirmar la configuración SMTP
- Asegúrate de que la dirección de remitente (`SMTP_FROM`) sea del dominio propio y no un servicio externo no autorizado