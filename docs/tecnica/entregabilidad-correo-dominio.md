# Entregabilidad de correo dominio

## Configuración SPF

- **Dominio**: `gi-clinicadental.com` (o el dominio configurado para la clínica)
- **Registro TXT SPF**: `v=spf1 include:_spf.google.com ~all`
- **Propósito**: Autoriza a los servidores de Google Workspace a enviar correo en nombre del dominio. Si se usa Ferozo SMTP, se debe agregar `include:spf.feroz.com` o la IP específica del servidor de Ferozo.
- **Validación**: Consultar con `dig gi-clinicadental.com TXT` y verificar que el dominio aparezca en la salida.

## Configuración DKIM

- **Dominio**: Mismo dominio que el SPF
- **Registro TXT DKIM**: `v=DK1; k=rsa; p=<clave-pública>`
- **Propósito**: Firma digitalmente los correos salientes para validar la autenticidad del remitente.
- **Configuración en Ferozo**: Debe activarse el servicio DKIM en el panel de control y el selector (selector común: `default` o `feroz`) debe tener su clave pública publicada en DNS.
- **Validación**: Enviar un correo de prueba y verificar que el encabezado `DKIM-Signature` esté presente y válido.

## Configuración DMARC

- **Dominio**: Mismo dominio que SPF y DKIM
- **Registro TXT DMARC**: `v=DMARC1; p=none; rua=mailto:dmarc-reports@gi-clinicadental.com; ruf=mailto:dmarc-failure@gi-clinicadental.com`
- **Políticas posibles**:
  - `p=none`: Solo monitoreo (recomendado al iniciar)
  - `p=quarantine`: Marcar como spam/correo no deseado
  - `p=reject`: Rechazar el correo directamente
- **Propósito**: Protege contra suplantación de identidad (phishing) y informa sobre el uso del dominio.
- **Validación**: Consultar con `dig gi-clinicadental.com TXT` y buscar el registro que comience con `v=DMARC1`.

## Conexiones SMTP seguras desde Vercel Serverless

- **Proveedor**: Ferozo
- **Hostname**: `smtp.ferozo.com` (o el hostname proporcionado por Ferozo)
- **Puerto**: 465 (SSL/TLS directo) o 587 (STARTTLS)
- **Conexión desde funciones Serverless**: Las funciones Serverless de Vercel pueden conectar a servicios externos mediante dominios DNS resolubles. Es necesario:
  - Verificar que el hostname de Ferozo tenga resolución DNS válida
  - Confirmar que el tráfico saliente por los puertos 465/587 no esté bloqueado por la red de Vercel
  - Utilizar credenciales (`SMTP_USER`, `SMTP_PASS`) almacenadas exclusivamente en variables de entorno de Vercel (no en código ni frontend)
- **Prueba de conexión**: Utilizar `nodemailer` con configuración `host: SMTP_HOST, port: SMTP_PORT, secure: true (para 465) o false (para 587) with tls: { rejectUnauthorized: false }` y enviar un mensaje de prueba.

## Pruebas de recepción en proveedores de correo

- **Proveedores a probar**: Gmail, Outlook, Yahoo, correo corporativo de la clínica
- **Procedimiento**:
  1. Enviar un correo de prueba desde la función Serverless usando Nodemailer
  2. Revisar la bandeja de entrada y la carpeta de spam/correo no deseado en cada proveedor
  3. Verificar que el correo no esté bloqueado ni rechazado (códigos de respuesta 5xx)
  4. Revisar los encabezarios del correo recibido para confirmar SPF/DKIM/DMARC
- **Éxito**: Correos recibidos en la bandeja de entrada de todos los proveedores principales con los indicadores de autenticación (SPF/DKIM) válidos.

## Hallazgos y riesgos

- Si el registro SPF no incluye el servidor de Ferozo, los correos pueden ser rechazados.
- Si DKIM no está configurado, los proveedores de correo pueden confiar menos en la autenticidad del mensaje.
- Si DMARC está en `p=reject` sin haber antes probado con `p=none` y `p=quarantine`, los correos legítimos pueden ser bloqueados.
- Las conexiones SMTP desde Serverless dependen de la política de red saliente de Vercel, que debe verificarse caso por caso.