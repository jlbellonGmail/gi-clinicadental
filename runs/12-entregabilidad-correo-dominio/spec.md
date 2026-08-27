# Specification: 12-entregabilidad-correo-dominio

## Overview

Verificar y configurar la entregabilidad de correos electrónicos del dominio remitente para el sitio de la clínica dental. Esto incluye la configuración de SPF, DKIM y DMARC, la validación de conexiones SMTP seguras desde funciones Serverless de Vercel, y pruebas de recepción en diferentes proveedores de correo para asegurar que las notificaciones no sean rechazadas ni clasificadas como spam.

## Acceptance Criteria

1. **Configuración SPF**: El dominio remitente debe tener un registro TXT SPF válido que autorice el envío de correos desde las funciones Serverless de Vercel y el servicio de SMTP de Ferozo.

2. **Configuración DKIM**: El dominio remitente debe tener registros DKIM configurados y firmes para validar la autenticidad del remitente.

3. **Configuración DMARC**: El dominio remitente debe tener un registro DMARC publicado con una política de monitoreo o rechazo adecuada.

4. **Conexiones SMTP seguras**: Ferozo debe permitir conexiones SMTP seguras (TLS) desde funciones Serverless de Vercel (puerto 465 o 587 con STARTTLS).

5. **Pruebas de recepción**: Los correos de notificación de leads deben ser recibidos correctamente en al menos los siguientes proveedores de correo: Gmail, Outlook/Yahoo.

6. **No clasificación como spam**: Las notificaciones deben llegar a la bandeja de entrada y no ser clasificadas sistemáticamente como correo no deseado/spam.

7. **Sin credenciales expuestas**: Las credenciales SMTP deben permanecer únicamente en variables de entorno de Vercel y nunca exponerse en el frontend, logs o artefactos del cliente.

8. **Documentación técnica**: `docs/tecnica/entregabilidad-correo-dominio.md` debe existir y contener la configuración y hallazgos.

9. **Documentación de usuario**: `docs/usuario/entregabilidad-correo-dominio.md` debe existir y explicar cómo verificar y interpretar los resultados.

## Technical Requirements

- Verificar y publicar registros SPF, DKIM y DMARC en la zona DNS del dominio
- Configurar las credenciales SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) en Vercel para los entornos Preview y Production
- Probar conexiones SMTP desde el entorno de funciones Serverless de Vercel
- Enviar mensajes de prueba a múltiples proveedores de correo y analizar los resultados
- Implementar monitoreo de entregabilidad y alertas para fallos de envío

## Deliverables

- `spec.md` - Este archivo
- `docs/tecnica/entregabilidad-correo-dominio.md` - Documentación técnica detallada
- `docs/usuario/entregabilidad-correo-dominio.md` - Documentación de usuario
- `runs/12-entregabilidad-correo-dominio/decision.md` - Decisiones del circuito
- `runs/12-entregabilidad-correo-dominio/audit-1.md` - Veredicto del revisor
- `runs/12-entregabilidad-correo-dominio/test-report-1.md` - Reporte de QA
- Enlaces exactos en `docs/tecnica/index.md` y `docs/usuario/index.md`