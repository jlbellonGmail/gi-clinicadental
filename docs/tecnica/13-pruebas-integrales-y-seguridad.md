# 13-pruebas-integrales-y-seguridad

## Propósito

Este documento describe la implementación y uso de las pruebas automatizadas integrales y de seguridad para el endpoint `POST /api/leads` y el flujo completo de captación de leads. Tiene como objetivo asegurar que todas las validaciones, inserciones y envíos de correo funcionen correctamente y que ninguna credencial sensible se exponga en ningún punto del sistema.

## ¿Cómo usar las pruebas

### Ejecutar tests unitarios (Node.js)

Los tests unitarios residen en `api/leads.test.js` y se ejecutan con:

```bash
npm test
```

o directamente:

```bash
node --test api/leads.test.js
```

Estos tests cubren:
- Validaciones de método HTTP, Content-Type, tamaño de body
- JSON inválido, propiedades desconocidas
- Campos obligatorios y tipos de datos
- Formatos de email y teléfono
- Límites de longitud en todos los campos
- Consentimiento obligatorio
- Inserción en Supabase (exitoso y fallido)
- Envío de correos (éxito y fallo)
- Rate limiting
- Detección de duplicados
- Prevención de exposición de credenciales

### Verificar cobertura de seguridad

Los tests incluyen verificaciones específicas para asegurar que no se filtren credenciales:

- `test('ninguna respuesta incluye texto de variables sensibles')` — comprueba que las respuestas JSON y headers no contengan `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS` ni `service_role`
- `test('fallo de sendMail() no filtra credenciales SMTP en console.error')` — verifica que los logs de error no exponen contraseñas SMTP
- `test('config SMTP faltante: el mensaje logueado no incluye SMTP_PASS/SMTP_USER ni el objeto de config completo')` — asegura que los logs de error no contengan credenciales

### Flujo end-to-end

Las tests de integración verifican el flujo completo desde la recepción del formulario hasta la persistencia y los correos. Para ejecutar un flujo end-to-end manual:

1. Levantar el servidor local o usar `vercel dev`
2. Enviar un POST a `http://localhost:3000/api/leads` con un body JSON válido
3. Verificar la respuesta `201` con `{ "id": "<uuid>" }`
4. Revisar los logs de consola para confirmar que los correos se intentaron enviar (sin exponer credenciales)
5. Verificar en Supabase que el lead fue insertado con los datos correctos

## Criterios de aceptación de las pruebas

1. **Cobertura total**: Todas las rutas de código en `api/leads.js` deben estar cubiertas por tests, incluidos los caminos de error y los escenarios edge case.

2. **Sin credenciales en respuestas**: Ninguna respuesta HTTP (éxito o error) debe incluir `SUPABASE_SERVICE_ROLE_KEY`, credenciales SMTP, o cualquier variable de entorno.

3. **Sin PII en logs**: Los logs de `console.warn` y `console.error` deben estar libres de datos personales (nombre, email, teléfono, mensaje) y credenciales SMTP.

4. **Sin exposición en frontend**: El código servido en `index.html` y `script.js` debe no contener ni reflejar credenciales server-side.

5. **Historial limpio**: `git log --all --oneline` y cualquier diff público deben estar libres de credenciales reales (asegurarse de que `.gitignore` excluye `.env` y variantes).

6. **End-to-end exitoso**: Un lead completo con todos los campos válidos y consentimiento debe:
   - Responder `201` con `{ "id": "<uuid>" }`
   - Insertar el lead en la tabla `leads` de Supabase
   - Intentar enviar ambos correos (notificación a clínica + confirmación al paciente)
   - Actualizar los flags `notificacion_clinica_enviada` y `confirmacion_paciente_enviada` en caso de éxito

7. **Idempotencia**: Solicitudes duplicadas (mismo email+nombre dentro de 5 minutos) deben retornarse 201 con el ID existente sin insertar un nuevo registro.

8. **Independencia de emails**: Un fallo en el envío a la clínica no debe impedir el intento de envío al paciente, y viceversa.

## Riesgos / supuestos

- **Rate limiting best-effort**: El límite en memoria no persiste entre cold starts de Vercel. Las pruebas unitarias pueden verificarlo dentro del mismo proceso, pero la protección contra abuso requiere la feature `04-proteccion-antispam-y-abuso`.

- **Sin proyecto Supabase real en desarrollo**: La verificación de inserción real se hace con clientes Supabase mockeables en tests unitarios, no contra un proyecto Supabase en vivo durante el desarrollo.

- **Runtime Node.js ≥18**: Se asume el runtime Node.js ≥18 para el test runner nativo (`node --test`). Si Vercel usa otra versión, es un ajuste de configuración, no un cambio de diseño.

- **Tests vs Circuito**: Estos tests de producto (Node.js) son distintos de los tests del circuito agéntico (pytest en `tests/`). Ambos deben aprobar para que la CI se considere verde.