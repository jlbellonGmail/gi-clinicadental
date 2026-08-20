# Roadmap: gi-clinicadental

Cada feature nueva se implementa siguiendo el circuito agéntico de
[AGENTS.md](AGENTS.md): Analyst → Reviewer → Builder → QA →
`[-] READY_FOR_PR` → PR → CI verde → HITL (único punto de aprobación
humana) → Merge → `[x]`, con su carpeta de evidencia en
`runs/<NN>-<slug>/` y su documentación en `docs/tecnica/<slug>.md` +
`docs/usuario/<slug>.md`.

Este archivo refleja el estado **verificado** del proyecto (código
real, no expectativas). No se marca `[x]` antes del merge a `develop`.

## Propósito del producto

Sitio web de captación de pacientes para Sonríe más (clínica dental):
landing page informativa + formulario de contacto/leads, con el
objetivo final de que cada lead completado llegue realmente a la
clínica (email, CRM o base de datos — a definir).

---

## Estado actual verificado (2026-08-19)

No había Git inicializado hasta esta migración. El repo llegó como 3
archivos sueltos (`index.html`, `style.css`, `script.js`): una landing
page completa y funcional **a nivel visual**, verificada por lectura
directa del código:

- Hero, stats, 6 tarjetas de servicios, sección de equipo, formulario de
  contacto (nombre/email/servicio/mensaje), footer.
- Scroll suave, efecto de header, animaciones de aparición al hacer
  scroll — todo funcional (JS vanilla sin dependencias, salvo Font
  Awesome por CDN para íconos).

Gaps verificados (ver [docs/tecnica/landing.md](docs/tecnica/landing.md)
para el detalle):

- **El formulario de contacto está simulado** (`setTimeout` en
  `script.js`, comentario literal `// Simulate API call`): ningún lead
  se guarda ni se envía a ningún lado. Es el gap más importante para un
  MVP operable real.
- 3 imágenes referenciadas en `index.html` no existen en el repo
  (rotas).
- Datos de contacto (teléfono, dirección, email) y enlaces de footer
  son placeholders de plantilla, no verificados como reales.

No hay backend, no hay tests de producto, no había CI. Se preservó el
código existente sin modificarlo (commit baseline
`chore(baseline): landing page estática existente`), y se agregó el
circuito AI-Native encima.

---

## Backlog (circuito `AGENTS.md`)

- [ ] 01-formulario-leads-real — Conectar `#leadForm` a un destino real
      (definir en la spec: email transaccional, CRM o base de datos +
      validación server-side + qué pasa con los datos personales/de
      salud que se recolectan). Es el gap más crítico para que el sitio
      cumpla su propósito (captar pacientes reales, no simulados).
- [ ] 02-assets-y-contenido-real — Reemplazar las 3 imágenes rotas y
      verificar/actualizar los datos de contacto y enlaces de footer con
      información real del negocio (no se inventa contenido — requiere
      insumos del cliente real, ver "Reglas de dominio" en `AGENTS.md`).

## Cómo se usa este archivo

1. El humano mantiene el backlog: agrega, renombra o reordena items.
2. Ningún item se marca `[x]` antes del merge a `develop`.
3. Después de QA aprobado, la automatización cambia `[ ]` → `[-]` en la
   rama de la feature (`scripts/ready-for-pr.ps1`) y lo lleva dentro de
   la PR.
4. Después del merge, GitHub Actions ejecuta
   `post-merge-close-feature.yml`, que invoca `scripts/close-feature.ps1`
   desde `develop` para cambiar `[-]` → `[x]`, commitear y pushear a
   `origin/develop`.
5. Al arrancar una feature se usa el número/slug de este archivo para
   crear `runs/<NN>-<slug>/` y la rama `feature/<NN>-<slug>` (en worktree
   propio bajo `../worktrees/<slug>/`).

**Patrón del ítem**: `NN` (dos dígitos, numeración secuencial), `slug` en
minúsculas con guiones, seguido de `—` y descripción corta en español.


## Roadmap

- [x] 00-aprovisionamiento-entorno-vercel — Rotar inmediatamente la contraseña SMTP y la clave secreta de Supabase que fueron expuestas. Actualizar sus nuevos valores exclusivamente en la interfaz segura de Vercel para los entornos Production y Preview. Confirmar el hostname SMTP real proporcionado por Ferozo. Ninguna credencial deberá quedar almacenada en el repositorio, documentación, historial Git, logs o prompts.

- [x] 01-configuracion-variables-entorno — Crear `.env.example` en la raíz del repositorio utilizando únicamente valores vacíos o placeholders ficticios. Documentar las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `LEADS_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `SITE_URL`. Verificar que `.env`, `.env.local` y todas sus variantes confidenciales estén excluidas mediante `.gitignore`.

- [x] 02-inicializacion-supabase-schema — Crear una migración SQL declarativa y versionada para la tabla `leads`. La estructura deberá incluir: `id` uuid como llave primaria automática, `nombre` text no nulo, `email` text no nulo, `telefono` text, `servicio` text, `mensaje` text, `estado` text no nulo con valor inicial `nuevo`, `origen` text no nulo con valor inicial `formulario_web`, `consentimiento_privacidad` boolean no nulo, `version_politica_privacidad` text no nulo, `notificacion_clinica_enviada` boolean no nulo con valor inicial false, `confirmacion_paciente_enviada` boolean no nulo con valor inicial false, `fecha_creacion` timestamp with time zone con valor predeterminado `now()` y `fecha_actualizacion` timestamp with time zone con valor predeterminado `now()`. Limitar `estado` a los valores `nuevo`, `contactado`, `confirmado` y `descartado`. Habilitar RLS y bloquear todas las operaciones directas del rol `anon`.

- [x] 03-endpoint-recepcion-leads — Desarrollar la función API Serverless `POST /api/leads` utilizando Node.js. Validar campos obligatorios, tipos, formato del correo, teléfono, consentimiento, longitudes máximas, tamaño de la solicitud y rechazo de propiedades desconocidas. Escapar cualquier contenido que posteriormente se incorpore a correos HTML. Insertar el lead en Supabase exclusivamente desde el servidor y devolver HTTP 201 sin exponer información técnica. Implementar respuestas controladas para códigos 400, 405, 413, 429 y 500.

- [x] 04-proteccion-antispam-y-abuso — Proteger el endpoint público mediante rate limiting, validación de origen y un mecanismo antispam como campo trampa, control temporal o CAPTCHA cuando resulte necesario. Evitar envíos duplicados accidentales mediante una estrategia de idempotencia o detección de solicitudes repetidas. Registrar los rechazos sin almacenar innecesariamente datos personales.

- [ ] 05-notificacion-clinica-smtp-ferozo — Integrar Nodemailer después de la inserción exitosa del lead. Enviar una notificación HTML a la dirección definida en `LEADS_NOTIFICATION_EMAIL` utilizando exclusivamente las variables SMTP de Vercel y conexión TLS segura para el puerto 465. Incluir los datos relevantes del paciente correctamente escapados. Actualizar `notificacion_clinica_enviada` cuando el envío sea exitoso. Un fallo SMTP no deberá eliminar ni duplicar el lead almacenado.

- [ ] 06-confirmacion-automatica-paciente — Enviar al paciente un correo transaccional confirmando que su solicitud fue recibida. El mensaje deberá aclarar que el turno todavía no está confirmado y que la clínica se comunicará posteriormente. No deberá incluir información clínica sensible. Actualizar `confirmacion_paciente_enviada` cuando el envío sea exitoso y evitar reenvíos duplicados.

- [ ] 07-seguridad-y-politica-privacidad — Incorporar al formulario `#leadForm` un checkbox obligatorio de consentimiento activo antes del botón de envío. Crear una política de privacidad accesible que informe finalidad, datos almacenados, responsable, destinatarios, plazo de conservación y procedimiento para solicitar acceso, rectificación o eliminación. Registrar la versión de la política aceptada y evitar solicitar información clínica sensible que no sea indispensable para el primer contacto.

- [ ] 08-conexion-frontend-api — Eliminar de `script.js` la simulación basada en `setTimeout` y el comentario `// Simulate API call`. Implementar una petición asíncrona mediante `fetch()` hacia `/api/leads`. Bloquear el botón durante el envío, evitar solicitudes duplicadas y mostrar los estados “Enviando solicitud...”, “Demasiados intentos, espere unos minutos” y “Error en la conexión, intente más tarde”. Ante un resultado exitoso mostrar: “Solicitud recibida. La clínica se comunicará para confirmar el turno”. Reactivar siempre el botón al finalizar.

- [ ] 09-rediseño-estetico-y-assets — Renovar la landing page aplicando criterios profesionales de UI/UX orientados a odontología moderna. Corregir las imágenes rotas, incorporar recursos visuales con licencia válida, convertirlos a WebP y optimizar peso, dimensiones, textos alternativos y carga diferida. Actualizar colores, tipografías, espaciados y diseño responsive sin alterar el funcionamiento del formulario.

- [ ] 10-actualizacion-datos-contacto — Reemplazar todos los placeholders por información institucional validada de Sonríe más: denominación, teléfono, WhatsApp, correo, dirección, horarios y redes sociales. Eliminar textos genéricos como `555-XXXX` y comprobar el funcionamiento de enlaces telefónicos, WhatsApp, mapas y redes sociales.

- [ ] 11-seo-accesibilidad-y-navegacion — Incorporar título, descripción, favicon, etiquetas Open Graph, URL canónica y metadatos básicos para buscadores y redes sociales. Verificar navegación mediante teclado, contraste, etiquetas asociadas a campos, mensajes accesibles, foco después de errores, textos alternativos y comportamiento responsive. Incorporar una página 404 coherente con el diseño del sitio.

- [ ] 12-entregabilidad-correo-dominio — Verificar la configuración SPF, DKIM y DMARC del dominio remitente. Confirmar que Ferozo permita conexiones SMTP seguras desde funciones Serverless de Vercel. Realizar pruebas de recepción en diferentes proveedores de correo y comprobar que las notificaciones no sean rechazadas ni clasificadas sistemáticamente como spam.

- [ ] 13-pruebas-integrales-y-seguridad — Crear pruebas automatizadas para migraciones, validaciones, consentimiento obligatorio, sanitización, límites de longitud, solicitudes malformadas, rate limiting, duplicados, inserción en Supabase y fallos SMTP. Ejecutar una prueba end-to-end desde el formulario hasta la persistencia y los dos correos. Verificar que ninguna credencial aparezca en el frontend, respuestas HTTP, logs, historial Git o artefactos de compilación.

- [ ] 14-pipeline-despliegue-vercel — Configurar `develop` como rama de integración con despliegues Preview y `main` como rama estable con despliegue Production. Cada Pull Request deberá generar una URL Preview para auditoría técnica y aprobación HITL. Solamente después de la aprobación humana y del merge autorizado hacia `main` deberá actualizarse el sitio público. Priorizar la integración Git nativa de Vercel y crear `.github/workflows/deploy.yml` únicamente si existe una necesidad no cubierta por ella.

- [ ] 15-observabilidad-y-operacion — Incorporar logs estructurados y seguros para solicitudes, validaciones, inserciones y errores de Supabase o SMTP. No registrar contraseñas, claves ni mensajes sensibles completos. Definir un procedimiento para diagnóstico, recuperación, rotación de credenciales, revisión de leads pendientes y detección de notificaciones fallidas. Utilizar inicialmente el panel protegido de Supabase para administrar los estados `nuevo`, `contactado`, `confirmado` y `descartado`, sin construir todavía un panel administrativo propio.

- [ ] 16-validacion-mvp-produccion — Ejecutar una validación funcional completa en producción utilizando datos de prueba controlados: completar el formulario, aceptar la política, enviar la solicitud, verificar la respuesta de la API, confirmar la creación del lead en Supabase, comprobar la notificación a la clínica y recibir la confirmación como paciente. Verificar además la visualización desde computadora y celular. El MVP solamente podrá cerrarse cuando todo el circuito funcione sin credenciales expuestas, errores críticos ni pasos manuales no documentados.







