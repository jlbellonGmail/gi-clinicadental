# Decision: 13-pruebas-integrales-y-seguridad - Pruebas integrales y seguridad

## Estado

MERGE aprobado por evidencias del circuito agéntico.

## Evidencias revisadas

- `runs/13-pruebas-integrales-y-seguridad/spec.md` - Specification completa con 12 criterios de aceptación
- `runs/13-pruebas-integrales-y-seguridad/audit-1.md` - Verediclo approval del reviewer-agent
- `runs/13-pruebas-integrales-y-seguridad/test-report-1.md` - Reporte QA con todos los tests pasando (158/158)
- `api/leads.test.js` - Tests unitarios e integración que cubren validaciones, inserción, SMTP, seguridad
- `docs/tecnica/13-pruebas-integrales-y-seguridad.md` - Documentación técnica
- `docs/usuario/13-pruebas-integrales-y-seguridad.md` - Documentación de usuario
- Enlaces exactos en `docs/tecnica/index.md` y `docs/usuario/index.md`

## Decisiones demostrables

1. **Cobertura de tests**: Todos los tests existentes (158) pasan exitosamente, cubriendo todas las validaciones del endpoint `POST /api/leads`.

2. **Prevención de credenciales**: Tests verificados que aseguran que `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `SMTP_USER` nunca aparecen en respuestas HTTP, logs o frontend.

3. **End-to-end completo**: Flujo verificado desde formulario → persistencia Supabase → envío de ambos correos (clínica + paciente) con respuesta 201 correcta.

4. **Orden de evaluación**: Orden documentado y testable de validaciones (método → Content-Type → tamaño → JSON → whitelist → campos obligatorios → tipos → formatos/longitudes → consentimiento).

5. **Sin modificar frontend**: `index.html` y `script.js` permanecen sin cambios, sin exponer credenciales.

6. **Migración SQL versionada**: La migración `20260819210130_create_leads_table.sql` existe y está versionada en `supabase/migrations/`.

7. **Documentación completa**: Los archivos `spec.md`, `docs/tecnica/`, `docs/usuario/` y los índices actualizados existen y tienen enlaces exactos.

## Resultado

La feature queda apta para integrarse/cerrarse cuando GitHub confirme merge contra `develop` y el cierre automático marque `ROADMAP.md`. Los tests sirven como documentación viviente y garantía de que el endpoint `POST /api/leads` cumple con todos los requisitos de validación, inserción y seguridad específicados.