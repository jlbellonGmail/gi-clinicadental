# Specification: 13-pruebas-integrales-y-seguridad

## Overview

Crear un conjunto completo de pruebas automatizadas que cubran: migraciones de base de datos, validaciones del endpoint POST /api/leads, consentimiento obligatorio, sanitización de entradas, límites de longitud, solicitudes malformadas, rate limiting, detección de duplicados, inserción en Supabase y fallos SMTP. Ejecutar una prueba end-to-end completa desde el formulario hasta la persistencia y el envío de ambos correos (notificación a la clínica y confirmación al paciente). Verificar que ninguna credencial sensible aparezca en el frontend, respuestas HTTP, logs, historial Git o artefactos de compilación.

## Acceptance Criteria

1. **Tests de migración**: Verificar que la migración SQL de la tabla `leads` se aplica correctamente y que todas las constraints, defaults y RLS están en su lugar.

2. **Cobertura de validaciones del endpoint**: Todas las validaciones implementadas en `api/leads.js` tienen tests unitarios incluidos (método HTTP, Content-Type, tamaño de body, JSON válido, whitelist de propiedades, campos obligatorios, tipos de datos, formatos de email/telefono, longitudes máximas, campos opcionales → null, consentimiento obligatorio).

3. **Validación de consentimiento obligatorio**: Tests que verifiquen que `consentimiento_privacidad` sea obligatorio y que su ausencia, valor `false` o tipo no-booleano siempre respondan `400 consentimiento_requerido`, nunca `campo_requerido_faltante` ni `tipo_invalido`.

4. **Sanitización y escape HTML**: Tests que verifiquen que el contenido tipo `<script>`, comillas y ampersands se escapen correctamente en los correos HTML generados, y que los datos se inserten tal cual en Supabase (sin sanitizar en persistencia, pero escapados en la presentación de email).

5. **Límites de longitud**: Tests para todos los límites de campo (nombre: 2-150, email: max 254, telefono: 6-30, servicio: max 100, mensaje: max 2000, version_politica_privacidad: 1-50) y comportamiento correcto cuando se exceden o cuando fields vacíos tras `trim()`.

6. **Solicitudes malformadas**: Tests para JSON inválido, body vacío, métodos HTTP no permitidos, Content-Type inválido, propiedades desconocidas, y cualquier otro escenario de entrada mal formada.

7. **Rate limiting**: Tests que verifiquen el límite de 5 solicitudes por IP por ventana de 60 segundos, y que IPs distintas tengan contadores independientes. Verificar también que la ventana se resetea después de pasar el tiempo.

8. **Detección de duplicados**: Tests que verifiquen que email+nombre coincidentes dentro de una ventana de 5 minutos devuelvan 201 con el ID existente sin insertar de nuevo. También tests para que leads antiguos (>5 min) se inserten como nuevos, y que email distinto con mismo nombre se inserten de forma independiente.

9. **Inserción en Supabase**: Tests que verifiquen la inserción correcta de leads con todos los campos mapeados, campos opcionales como null cuando están vacíos, y que solo se devuelva el ID en la respuesta 201 sin metadatos internos.

10. **Fallos SMTP**: Tests que verifiquen que:
    - Un fallo en `mailerFactory` (config SMTP incompleta) no altera la respuesta 201
    - Un fallo en `sendMail()` a la clínica no impide el intento a el paciente (independencia)
    - Un fallo en `sendMail()` al paciente no afecta el resultado ya decidido del envío a la clínica
    - Un fallo en el UPDATE de flags no cambia la respuesta HTTP 201
    - Las credenciales SMTP nunca aparecen en los logs de `console.error`

11. **End-to-end test**: Ejecutar una prueba completa desde la recepción del formulario, persistencia en Supabase, y envío de ambos correos (clínica + paciente), verificando que el lead se crea, ambos emails se envían y la respuesta 201 se devuelve correctamente.

12. **Prevención de exposición de credenciales**: Tests y verificaciones para asegurar que:
    - Ninguna respuesta HTTP incluye `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `SMTP_USER`, ni cualquier valor de `.env`
    - Los logs de `console.error`/warning no contienen PII (nombre, email, teléfono, mensaje) ni credenciales SMTP en texto plano
    - El frontend (`index.html`, `script.js`) no incluye ni referencia a credenciales server-side
    - El historial de Git no contiene credenciales reales (verificar que `.gitignore` excluye `.env` y variantes)
    - Los artefactos de compilación (si los hay) no contienen credenciales

## Technical Requirements

- Tests deben estar en `api/leads.test.js` usando el test runner nativo de Node (`node --test`)
- Cliente Supabase inyectable/falso para tests unitarios (patrón factory/dependency injection)
- Mailer falso para simular envío de emails sin conexión real
- Tests de integración que ejecuten el flujo completo: handler → Supabase insert → mailer sendMail
- Verificación de seguridad: inspección de respuestas HTTP, logs de consola, y contenido de archivos
- El test runner nativo de Node descubre tests que matchean `**/*.test.js`

## Deliverables

- `spec.md` - Este archivo
- `docs/tecnica/13-pruebas-integrales-y-seguridad.md` - Documentación técnica detallada
- `docs/usuario/13-pruebas-integrales-y-seguridad.md` - Documentación de usuario
- `runs/v1.0.0-producto/13-pruebas-integrales-y-seguridad/decision.md` - Decisiones del circuito
- `runs/v1.0.0-producto/13-pruebas-integrales-y-seguridad/audit-1.md` - Veredicto del revisor
- `runs/v1.0.0-producto/13-pruebas-integrales-y-seguridad/test-report-1.md` - Reporte de QA
- Enlaces exactos en `docs/tecnica/index.md` y `docs/usuario/index.md`
- Todos los tests existentes en `api/leads.test.js` deben seguir pasando (158/158)
