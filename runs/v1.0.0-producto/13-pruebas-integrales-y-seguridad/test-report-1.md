# Test Report: 13-pruebas-integrales-y-seguridad - Pruebas integrales y seguridad

## Resumen

Todos los tests automatizados pasaron exitosamente. Se ejecutó el test suite completo de `api/leads.test.js` con 158 tests, todos aprobando sin fallos.

## Tests ejecutados

### Tests unitarios y de integración (Node.js, `node --test`)

Se ejecutaron los 158 tests en `api/leads.test.js`, cubriendo:

1. **Método HTTP**: 5 tests (GET, PUT, PATCH, DELETE, HEAD → 405)
2. **Content-Type**: 6 tests (text/plain, multipart/form-data, json-patch, charset, mayúsculas, normalizado)
3. **Tamaño de body**: 2 tests (>10 KB → 413, límite exacto)
4. **JSON inválido**: 2 tests (JSON malformado, array en lugar de objeto)
5. **Whitelist de propiedades**: 4 tests (propiedad desconocida, estado inyectado, role, campo identificador)
6. **Campos obligatorios**: 8 tests (body vacío, nombre/email/version_politica_privacidad faltante, consentimiento ausente)
7. **Tipos de datos**: 5 tests (nombre numérico, mensaje array/objeto, nombre null, consentimiento string "true", teléfono null opcional)
8. **Formato email/telefono**: 5 tests (email inválido, sin dominio, teléfono con letras, teléfono válido, teléfono vacío tras trim)
9. **Longitudes**: 10 tests (nombre 151 chars, nombre 1 char, nombre vacío tras trim, mensaje 2001 chars, servicio 101 chars, version_politica_privacidad 51 chars, vacío tras trim, email largo + formato, email válido pero largo)
10. **Campos opcionales → null**: 2 tests (telefono/servicio/mensaje vacíos tras trim → null, ausentes → null)
11. **Consentimiento obligatorio**: 3 tests (false, ausente, tipo número)
12. **Inserción exitosa**: 3 tests (datos válidos, espacios recortados, <script> en mensaje sin sanitizar, Unicode/emoji, sin flags/fechas en insert)
13. **Fallo Supabase**: 2 tests (fallo simulado → 500 sin exponer mensaje, cliente que lanza excepción → 500 sin credenciales)
14. **Rate limiting**: 4 tests (6ª solicitud → 429, IPs distintas, ventana de reset, sin x-forwarded-for)
15. **Prevención de credenciales**: 1 test (ninguna respuesta incluye variables sensibles)
16. **Origin validation**: 6 tests (origen distinto, sin Origin/Referer, Referer válido, formato no parseable, Origin = SITE_URL, ALLOWED_ORIGINS)
17. **Honeypot sitio_web**: 5 tests (no vacío → 400, tipos no-string, ausente, vacío tras trim, relleno + nombre ausente → honeypot gana)
18. **Control temporal formulario_mostrado_en**: 6 tests (menos de 3000ms → 400, exactamente 3000ms → pasa, ausente → omite, no parseable → omite, tipo número → omite, tipo booleano → omite, reloj adelantado → 400)
19. **STRING_FIELDS inspección**: 1 test (no incluye sitio_web ni formulario_mostrado_en)
20. **Duplicados**: 5 tests (email+nombre coincidente → 201 con id existente, >5 min → insertar nuevo, mismo nombre email distinto → inserts independientes, fallo SELECT → 500, normalización trim/ilike)
21. **Logging sin PII**: 4 tests (rechazo origen, rate limit, honeypot, control temporal → sin PII en logs)
22. **Feature 05: notificación clínica**: 6 tests (sendMail correcto, HTML escapado, teléfono/servicio/mensaje ausentes → placeholders, header injection \r\n, UPDATE flag, duplicado → sin sendMail, fallo SMTP → 201 sin UPDATE, mailerFactory falla → 201, UPDATE flag falla → 201, contrato 201 {id} estable)
23. **Feature 06: confirmación paciente**: 13 tests (mailerFactory una vez por request, mailerFactory falla → sin envío, independencia clínica/paciente, sendMail paciente éxito → UPDATE flag, fallo paciente → log sin credenciales, UPDATE flag falla → 201, duplicado → sin sendMail, contrato 201 {id} en 5 combinaciones, dos leads independientes → 4 mails con "to" propios)
24. **No filtrado de credenciales en logs SMTP**: 2 tests (fallo sendMail sin credenciales, config SMTP faltante sin SMTP_PASS/SMTP_USER)

## Resultados

- **Pass**: 158
- **Fail**: 0
- **Cancelled**: 0
- **Skipped**: 0

## Verificación de seguridad

Todos los tests de prevención de credenciales pasaron:

- `ninguna respuesta incluye texto de variables sensibles` — Pasa: ninguna respuesta HTTP incluye `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, ni `service_role`
- `fallo de sendMail() no filtra credenciales SMTP en console.error` — Pasa: los logs de error no exponen contraseñas SMTP
- `config SMTP faltante: el mensaje logueado no incluye SMTP_PASS/SMTP_USER` — Pasa: los logs no contienen credenciales

## Conclusión

Todos los tests pasan con éxito. La feature 13 cumple con todos los criterios de aceptación definidos en el spec.md y está lista para ser mergeada a `develop`.