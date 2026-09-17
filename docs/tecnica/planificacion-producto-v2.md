# Planificación funcional de ClínicaDental v2

## Propósito y límites

Esta página diseña la evolución funcional de ClínicaDental; no implementa
ClínicaDental v2. Template v2.0.0 es únicamente el mecanismo de gobernanza.
La base analizada es `develop@35737852297ee7d02c7f2e8023d1ff4e5b423b46`, con
producto funcional `1.0.1` y release operativa `v1.0.2`.

## Baseline v1 verificado

| Capacidad | Estado real | Evidencia |
|---|---|---|
| Sitio público | EXISTENTE | `index.html`, `style.css`, `script.js`, assets WebP y generador `scripts/build-site.js` |
| Captación | EXISTENTE | formulario `#leadForm`, `POST /api/leads`, validación, rate limit e idempotencia |
| Persistencia | EXISTENTE | Supabase `public.leads`, migraciones SQL, RLS y acceso server-side |
| Notificaciones | EXISTENTE | Nodemailer/SMTP en `api/_lib/mailer.js`, estados y reintentos acotados |
| Consentimiento y privacidad | EXISTENTE/PARCIAL | checkbox, política, versión y modo demo; la configuración legal real aún requiere insumos del responsable |
| Clínica configurable | PARCIAL | `config/clinic.json` genera contenido público; no es todavía tenancy ni configuración operativa |
| Usuarios/autenticación | AUSENTE | no hay login, sesiones, RBAC ni gestión de usuarios |
| Profesionales/pacientes | AUSENTE | no hay entidades ni casos de uso |
| Agenda/turnos | AUSENTE | no hay disponibilidad, reservas, bloqueos ni concurrencia |
| Seguimiento operativo | PARCIAL | estados del lead y estado de comunicación; no hay tareas, responsables ni bandeja |
| Mensajería multicanal | AUSENTE | sólo correo transaccional del lead; no WhatsApp, SMS ni conversaciones |
| Historia clínica | AUSENTE | no hay historia, odontograma, tratamientos ni documentos clínicos |
| Finanzas | AUSENTE | no hay pagos, facturación, saldos ni conciliación |
| Panel operativo | AUSENTE | no hay aplicación autenticada ni indicadores internos |
| Chatbot/voz | AUSENTE | no existen canales automáticos de atención |
| Seguridad operativa | PARCIAL | secretos fuera del repo, RLS, logs seguros y CI; faltan identidad/autorización/auditoría de usuario |
| CI/deployment | EXISTENTE | pytest, Node, integridad, identidad, supply chain, MkDocs y Vercel Preview; Production no está validado en esta unidad |

La landing contiene una advertencia explícita de demo y no debe usarse para
datos reales hasta completar controles de identidad, autorización, privacidad
y operación. Que una capacidad aparezca en `ROADMAP.md` no se considera
implementación.

## Matriz de brechas v1 → v2

| Dominio | Capacidad | Estado v1 | Reutilizable | Gap v2 | Dependencias | Riesgo |
|---|---|---|---|---|---|---|
| Plataforma | aislamiento de clínicas/sedes | AUSENTE | configuración como semilla | tenancy, claves de partición y controles de acceso | identidad | crítico |
| Identidad | usuarios y RBAC | AUSENTE | secretos/CI como controles operativos | autenticación, roles y autorización por acción | tenancy | crítico |
| Configuración | sedes, consultorios, servicios | PARCIAL | `clinic.json` sólo público | modelo operativo administrable | tenancy | alto |
| Profesionales | horarios, ausencias, especialidades | AUSENTE | ninguna | disponibilidad versionada | configuración, identidad | alto |
| Pacientes | ficha administrativa | AUSENTE | validación de contacto del lead | identidad, deduplicación y consentimiento | tenancy | crítico |
| Agenda | disponibilidad y turnos | AUSENTE | ninguna | fuente única, invariantes y concurrencia | configuración, profesionales, pacientes | crítico |
| Canales | reserva web/recepción | AUSENTE/PARCIAL | API de leads y validación | casos de uso comunes de agenda | agenda | alto |
| Captación | lead → paciente/turno | PARCIAL | `leads`, estados y correo | pipeline, responsable, tareas y trazabilidad | paciente, agenda | alto |
| Mensajería | correo/WhatsApp/SMS | PARCIAL | mailer, logger | conversación, entrega, reintentos y derivación | paciente, lead, turno | alto |
| Bandeja | cola unificada | AUSENTE | estado de comunicación como antecedente | asignación y próxima acción | mensajería, captación | alto |
| Clínico | historia y evolución | AUSENTE | consentimiento/privacidad como principio | separación clínica-administrativa y auditoría | paciente, identidad | crítico |
| Clínico | odontograma/tratamientos | AUSENTE | ninguna | modelo clínico por etapas | historia | crítico |
| Documentos | imágenes, recetas, consentimientos | AUSENTE | secretos/RLS como patrón | almacenamiento, acceso, retención y exportación | historia, permisos | crítico |
| Finanzas | pagos/facturación | AUSENTE | ninguna | dominio separado y conciliación | paciente, tratamiento, turno | alto |
| Operación | panel e indicadores | AUSENTE | logs de API | vistas autorizadas y métricas sin BI excesivo | identidad, agenda, bandeja | medio |
| IA | chatbot administrativo | AUSENTE | reglas de privacidad y servicios existentes | adaptador controlado, sin lógica paralela | casos de uso comunes | alto |
| Voz | asistente telefónico | AUSENTE | mismo núcleo futuro | canal de voz y transferencia humana | chatbot/casos comunes, mensajería | alto |

## Mapa funcional de v2

1. **Plataforma y tenancy:** clínica, sede, consultorio, aislamiento y configuración de contexto.
2. **Identidad y permisos:** administración, recepción, profesionales y futuros perfiles; RBAC o equivalente aplicado también a automatizaciones.
3. **Configuración:** servicios, especialidades, duración, horarios, restricciones, anticipación y canales habilitados.
4. **Profesionales:** perfil, especialidades, servicios, sedes, disponibilidad, vacaciones, ausencias y bloqueos.
5. **Pacientes administrativos:** identificación, contacto, preferencias, consentimientos y turnos; sin mezclar historia clínica ni finanzas.
6. **Agenda y turnos:** disponibilidad, reserva, confirmación persistida, reprogramación, cancelación, espera, concurrencia y trazabilidad.
7. **Captación y seguimiento:** consulta entrante, origen, responsable, prioridad, próxima acción, tareas y conversiones.
8. **Mensajería y bandeja:** conversaciones multicanal, entrega, errores, reintentos, asignación, derivación y cierre.
9. **Clínica:** historia, odontograma, diagnósticos, tratamientos, evolución, documentos, imágenes, recetas e indicaciones, consentimientos y auditoría.
10. **Finanzas:** pagos/facturación como dominio separado, incorporado sólo cuando los flujos y controles estén definidos.
11. **Operación:** agenda del día, consultas, tareas, cancelaciones, ausencias, espera, conversiones e incidencias.
12. **Asistentes:** chatbot administrativo y voz como adaptadores del mismo núcleo, con fallback humano.
13. **Integraciones:** correo, WhatsApp, SMS, voz, almacenamiento y proveedores; contratos idempotentes y secretos fuera del cliente.
14. **Seguridad/privacidad/observabilidad:** controles transversales, auditoría, mínimo privilegio, protección de datos y telemetría segura.

## Dependencias y arquitectura funcional

```text
tenancy + identidad
        ├── configuración de clínica
        │       ├── profesionales ──┐
        │       └── servicios/sedes  ├── agenda central ── casos de uso de reserva
        └── pacientes ──────────────┘             ├── recepción/web
                                                  ├── captación
                                                  ├── mensajería/bandeja
                                                  ├── chatbot
                                                  └── voz

pacientes → historia clínica → odontograma → diagnóstico → tratamiento/evolución → documentos
agenda + pacientes → recordatorios, conversiones y operación
```

La agenda será un único módulo de dominio y una única fuente de verdad. Los
canales no calcularán disponibilidad ni confirmarán antes de persistir. Los
casos de uso deberán devolver un resultado durable; sólo entonces un adaptador
podrá comunicar la confirmación. La IA interpreta intención y llama
capacidades autorizadas: no posee reglas, datos, permisos ni información
clínica. Un fallo produce contexto, tarea o transferencia humana.

## Roadmap incremental propuesto

Todas las unidades siguen Planner → Builder → Reviewer → QA → CI → HITL →
merge/cierre. Cada una conserva spec, decisión, pruebas, auditoría y
evidencia; ASSESS vuelve a seleccionar LIGHT/STANDARD/FULL según rutas reales.

### Fichas mínimas verificables

La siguiente tabla hace explícitos los campos mínimos de cada unidad; las
secciones posteriores amplían las unidades con mayor riesgo.

| Unidad | Objetivo y valor | Alcance | Exclusiones | Dependencias | Riesgo | Aceptación | Evidencia y cierre |
|---|---|---|---|---|---|---|---|
| 20 tenancy-identidad | aislar clínicas y usuarios | contexto, identidad, roles, autorización | agenda, clínica, finanzas | ninguna | crítico | dos clínicas/roles aislados y denegaciones | tests, auditoría, CI, cleanup seguro |
| 21 configuracion-operativa | configurar operación | sedes, consultorios, servicios, reglas | reserva, UI completa | 20 | alto | configuración por sede, permisos, auditoría | casos límite, rollback, CI y cierre |
| 22 profesionales-pacientes | disponer actores administrativos | perfiles, fichas, preferencias, consentimientos | historia, tratamientos, finanzas | 20–21 | crítico | CRUD autorizado y separación de datos | tests de acceso/exportación, auditoría y cierre |
| 23 agenda-central | única disponibilidad | horarios, duración, bloqueos, ausencias | canales externos, pagos | 21–22 | crítico | sin superposición bajo concurrencia | pruebas de invariantes, auditoría y cierre |
| 24 casos-de-turnos | operaciones durables de turno | reservar, confirmar, mover, cancelar, espera | chatbot y voz | 23 | crítico | persistencia antes de confirmar e idempotencia | pruebas concurrentes, trazas, auditoría y cierre |
| 25 reserva-web-recepcion | primer acceso compartido | adaptadores web y recepción | lógica propia por canal | 24, 20 | alto | mismos casos de uso y consentimiento | integración, seguridad, CI y cierre |
| 26 captacion-bandeja | convertir consultas en tareas | origen, responsable, prioridad, seguimiento | BI | 22, 24 | alto | sin duplicados ni consultas huérfanas | pruebas de flujo, auditoría y cierre |
| 27 mensajeria | comunicar estados | correo y primer canal adicional | IA | 24, 26 | alto | entrega, error, reintento e idempotencia | simulaciones, privacidad, auditoría y cierre |
| 28 historia-clinica | proteger registro clínico | historia, evolución, diagnósticos, consentimientos | odontograma avanzado, finanzas | 20, 22 | crítico | acceso profesional y trazabilidad | pruebas de autorización/retención, auditoría y cierre |
| 29 odontograma-tratamientos | modelar atención odontológica | odontograma, planes, tratamientos | facturación automática | 28 | crítico | versionado, permisos y consistencia clínica | fixtures ficticios, backup, auditoría y cierre |
| 30 documentos | custodiar adjuntos clínicos | imágenes, recetas, documentos | repositorio público | 28–29 | crítico | URLs temporales, permisos, retención y recuperación | pruebas de storage, restauración, auditoría y cierre |
| 31 panel-operativo | visibilidad diaria | agenda, consultas, tareas, incidencias | BI corporativo | 24, 26, 27 | medio | indicadores autorizados consistentes | snapshots, seguridad, auditoría y cierre |
| 32 chatbot | autoservicio administrativo | información aprobada y reservas | diagnóstico e indicaciones clínicas | 24, 26, 27 | alto | no inventa, persiste antes de confirmar y deriva | escenarios, prompt-injection, auditoría y cierre |
| 33 voz | mismo servicio por teléfono | voz, identificación, transferencia, tareas | reglas exclusivas de voz | 32, 27 | alto | acciones trazables y fallback humano | simulación de llamadas, auditoría y cierre |
| 34 finanzas | evaluar operación financiera separada | pagos, facturación, conciliación | mezclar datos clínicos | 22, 24, 29 | alto | ledger, permisos, idempotencia y conciliación | decisión comercial/legal, pruebas, auditoría y cierre |

### Fichas individuales de control

Para evitar que una tabla compacta o una futura edición oculte campos, cada
unidad queda además expresada con la misma ficha contractual:

- **20-fundacion-tenancy-identidad:** objetivo aislar clínicas y usuarios; valor proteger datos reales; alcance contexto, identidad, roles y autorización; exclusiones agenda, historia y finanzas; dependencias ninguna; riesgo aislamiento incorrecto; aceptación dos clínicas/roles aislados y denegaciones; evidencia fixtures, auditoría, CI y cleanup.
- **21-configuracion-operativa-clinica:** objetivo configurar operación; valor habilitar reglas reutilizables; alcance sedes, consultorios, servicios y reglas; exclusiones reservas y UI completa; dependencias 20; riesgo configuración cruzada; aceptación permisos, versionado y auditoría; evidencia casos límite, rollback, CI y cierre.
- **22-profesionales-pacientes-administrativos:** objetivo disponer actores administrativos; valor preparar agenda y seguimiento; alcance perfiles, fichas, preferencias y consentimientos; exclusiones historia, tratamientos y finanzas; dependencias 20–21; riesgo exposición de PII; aceptación CRUD autorizado y separación; evidencia pruebas de acceso/exportación, auditoría y cierre.
- **23-agenda-central-y-disponibilidad:** objetivo fundar disponibilidad única; valor eliminar agendas paralelas; alcance horarios, duración, bloqueos y ausencias; exclusiones canales y pagos; dependencias 21–22; riesgo solapamientos; aceptación invariantes bajo concurrencia; evidencia pruebas de carrera, trazas, auditoría y cierre.
- **24-casos-de-uso-de-turnos:** objetivo operar turnos durables; valor compartir reglas; alcance reservar, confirmar, mover, cancelar y espera; exclusiones chatbot y voz; dependencias 23; riesgo confirmar sin persistir; aceptación persistencia previa e idempotencia; evidencia pruebas concurrentes, autorización, auditoría y cierre.
- **25-reserva-web-y-recepcion:** objetivo exponer reserva común; valor entregar primer canal útil; alcance adaptadores web y recepción; exclusiones lógica propia de canal; dependencias 24 y 20; riesgo divergencia de reglas; aceptación mismos casos de uso y consentimiento; evidencia integración, seguridad, CI y cierre.
- **26-captacion-seguimiento-bandeja:** objetivo convertir consultas en trabajo; valor evitar olvidos y duplicados; alcance origen, responsable, prioridad y tareas; exclusiones BI; dependencias 22 y 24; riesgo consulta huérfana; aceptación responsable y próxima acción; evidencia flujo, auditoría y cierre.
- **27-mensajeria-y-recordatorios:** objetivo comunicar estados; valor continuidad con pacientes; alcance correo, canal adicional, entrega y reintentos; exclusiones IA; dependencias 24 y 26; riesgo envío duplicado o indebido; aceptación consentimiento, idempotencia y errores; evidencia simulaciones, privacidad, auditoría y cierre.
- **28-historia-clinica-y-consentimientos:** objetivo proteger registro clínico; valor atención trazable; alcance historia, evolución, diagnósticos y consentimientos; exclusiones odontograma avanzado y finanzas; dependencias 20 y 22; riesgo acceso clínico indebido; aceptación acceso profesional y rechazo a recepción no autorizada; evidencia pruebas de autorización/retención, auditoría y cierre.
- **29-odontograma-tratamientos:** objetivo modelar atención dental; valor continuidad clínica; alcance odontograma, planes, diagnósticos y tratamientos; exclusiones cobro automático; dependencias 28; riesgo inconsistencia o modificación sin rastro; aceptación versionado, permisos y consistencia; evidencia fixtures ficticios, auditoría y cierre.
- **31-panel-operativo:** objetivo mostrar operación diaria; valor priorizar trabajo; alcance agenda, consultas, tareas e incidencias; exclusiones BI corporativo; dependencias 24, 26 y 27; riesgo indicador inconsistente o PII excesiva; aceptación vistas autorizadas consistentes; evidencia snapshots, seguridad, auditoría y cierre.
- **32-chatbot-administrativo:** objetivo automatizar consultas permitidas; valor ampliar atención sin inventar respuestas; alcance información aprobada y reservas; exclusiones diagnóstico e indicaciones clínicas; dependencias 24, 26 y 27; riesgo alucinación o bypass de permisos; aceptación no inventa, persiste y deriva; evidencia escenarios, prompt-injection, auditoría y cierre.
- **33-asistente-telefonico:** objetivo reutilizar el núcleo por voz; valor atender otro canal; alcance identificación, agenda, transferencia y tareas; exclusiones reglas exclusivas de voz; dependencias 32 y 27; riesgo identificación errónea; aceptación trazabilidad, aviso de asistente y fallback humano; evidencia simulación de llamadas, auditoría y cierre.
- **34-finanzas-integradas:** objetivo evaluar finanzas separadas; valor ordenar cobros sin contaminar clínica; alcance pagos, facturación, conciliación y ledger; exclusiones cobros reales no aprobados y mezcla clínica; dependencias 22, 24 y 29; riesgo duplicados, errores monetarios y regulación; aceptación idempotencia, permisos y conciliación; evidencia decisión comercial/legal, pruebas, auditoría y cierre.

### 20 — fundacion-tenancy-identidad

**Objetivo/valor:** establecer el contexto de clínica y usuarios sin exponer
datos entre organizaciones. **Alcance:** modelo mínimo de clínica/sede,
identidad, roles y autorización de lectura/escritura. **Exclusiones:** agenda,
historia, pagos y canales automáticos. **Dependencias:** ninguna de v2.
**Aceptación:** dos clínicas y dos roles aislados en pruebas; denegaciones
verificadas; auditoría de cambios; secretos y logs seguros. **Evidencia/cierre:**
migraciones y tests aislados, revisión independiente APPROVED, CI verde y
sin datos reales.

### 21 — configuracion-operativa-clinica

**Objetivo/valor:** administrar sedes, consultorios, servicios, especialidades,
duraciones, reglas y canales. **Exclusiones:** reserva y UI completa.
**Dependencias:** 20. **Aceptación:** configuraciones válidas por sede,
versionado/auditoría y permisos; no se filtra otra clínica. Evidencia de
casos límite y rollback; cierre con CI y auditoría aprobados.

### 22 — profesionales-pacientes-administrativos

**Objetivo/valor:** disponer de actores administrativos que puedan participar
en turnos. **Alcance:** perfiles profesionales, ficha de paciente,
preferencias y consentimientos administrativos. **Exclusiones:** historia
clínica, tratamientos, finanzas y deduplicación automática irreversible.
**Dependencias:** 20–21. **Aceptación:** CRUD autorizado, separación de datos,
consentimientos trazables y exportación/eliminación controlada.

### 23 — agenda-central-y-disponibilidad

**Objetivo/valor:** crear la única fuente de disponibilidad. **Alcance:**
horarios, duración, sedes, consultorios, ausencias, bloqueos, reglas y
consulta de disponibilidad. **Exclusiones:** canales externos y pagos.
**Dependencias:** 21–22. **Aceptación:** no superposición bajo concurrencia,
bloqueos respetados, resultados deterministas y auditoría de cambios.

### 24 — casos-de-uso-de-turnos

**Objetivo/valor:** reservar, confirmar, reprogramar, cancelar y lista de
espera mediante un núcleo común. **Dependencias:** 23. **Exclusiones:**
chatbot/voz. **Aceptación:** persistencia atómica antes de confirmar,
idempotencia, autorización, trazabilidad y fallos seguros.

### 25 — reserva-web-y-recepcion

**Objetivo/valor:** exponer reservas a web y recepción sin lógica paralela.
**Dependencias:** 24 y 20. **Aceptación:** ambos consumidores llaman los
mismos casos de uso; no confirman turnos no persistidos; consentimiento,
rate-limit y pruebas de concurrencia.

### 26 — captacion-seguimiento-bandeja

**Objetivo/valor:** convertir leads y consultas en trabajo asignable.
**Dependencias:** 22, 24. **Alcance:** origen, responsable, prioridad, tareas,
próxima acción, conversación y estados. **Aceptación:** una consulta no queda
sin responsable ni duplicada; conversión trazable a paciente/turno.

### 27 — mensajeria-y-recordatorios

**Objetivo/valor:** correo y primer canal adicional con entrega y reintentos.
**Dependencias:** 24 y 26. **Exclusiones:** IA. **Aceptación:** plantillas
aprobadas, consentimiento, idempotencia, estado de entrega, errores,
reintentos acotados y derivación humana.

### 28 — historia-clinica-y-consentimientos

**Objetivo/valor:** registrar información clínica separada y protegida.
**Dependencias:** 20 y 22. **Alcance:** historia, evolución, diagnósticos,
consentimientos y auditoría. **Exclusiones:** odontograma avanzado y finanzas.
**Aceptación:** acceso profesional autorizado, recepción sin acceso clínico no
necesario, trazabilidad, retención y exportación definidas antes de datos reales.

### 29 — odontograma-tratamientos

**Objetivo/valor:** completar el registro clínico estructurado por módulos.
**Dependencias:** 28. **Alcance:** odontograma, diagnósticos vinculados,
planes y tratamientos, con sus estados, permisos y versionado. **Exclusiones:**
custodia de archivos binarios, imágenes, documentos y recetas, que pertenecen a
30. **Aceptación:** consistencia entre piezas dentales, diagnósticos,
tratamientos y evolución, con permisos y trazabilidad probados. Puede dividirse
nuevamente por ASSESS.

### 30 — documentos-clinicos

**Objetivo/valor:** custodiar adjuntos clínicos sin convertirlos en archivos
públicos. **Alcance:** imágenes, recetas, documentos, metadatos, URLs
temporales, versionado, retención, eliminación y recuperación. **Exclusiones:**
repositorio público y facturación. **Dependencias:** 28–29. **Riesgos:** fuga
de información sensible y pérdida de evidencia. **Aceptación:** permisos por
rol, acceso temporal, backup/restauración y eliminación verificables.
**Evidencia/cierre:** pruebas de storage y auditoría independiente APPROVED,
CI verde y cleanup sin objetos pendientes.

### 31 — panel-operativo

**Objetivo/valor:** dar visibilidad a agenda, consultas, tareas, cancelaciones,
espera e incidencias. **Dependencias:** 24, 26, 27. **Exclusiones:** BI.
**Aceptación:** indicadores consistentes con la fuente de verdad, filtros
autorizados, sin PII innecesaria en logs o vistas.

### 32 — chatbot-administrativo

**Objetivo/valor:** automatizar consultas y reservas administrativas.
**Dependencias:** 24, 26, 27. **Aceptación:** usa servicios comunes, nunca inventa
disponibilidad, confirma sólo tras persistencia, deriva consultas clínicas y
crea tareas con contexto. Evaluar prompt injection y telemetría.

### 33 — asistente-telefonico

**Objetivo/valor:** ofrecer el mismo servicio por voz. **Dependencias:** 31 o
sus casos de uso compartidos, 27. **Aceptación:** identificación como virtual,
transferencia humana, acciones trazables y cero reglas exclusivas de voz.

### 34 — finanzas-integradas

**Objetivo/valor:** resolver pagos/facturación cuando el modelo operativo y
legal estén definidos. **Dependencias:** 22, 24 y, si aplica, 29.
**Alcance:** pagos, facturación, conciliación, permisos e idempotencia.
**Exclusiones:** no mezclar finanzas con historia clínica ni activar cobros
reales en esta planificación. **Riesgos:** errores monetarios, duplicados y
requisitos regulatorios. **Aceptación:** ledger/auditoría, conciliación,
permisos, idempotencia y tratamiento de errores; requiere decisión HITL
específica sobre alcance comercial. **Evidencia/cierre:** decisión
comercial/legal, pruebas de error, auditoría independiente, CI verde y cierre
sin datos reales.

## Seguridad, privacidad y pacientes reales

Cada unidad debe demostrar aislamiento por `clinic_id` y, cuando corresponda,
`site_id`; autorización por rol y recurso; mínimo privilegio para recepción,
profesionales, administración y asistentes; secretos sólo en entornos
seguros; logs con identificadores opacos; y acciones de IA auditables.

Los datos administrativos, clínicos y financieros tendrán módulos, permisos,
retención y exportación separados. Documentos e imágenes requieren controles
de almacenamiento, URLs temporales, backups, recuperación y eliminación. El
consentimiento debe registrar finalidad y versión. Antes de Production con
personas reales se requiere validación legal/regulatoria aplicable a datos de
salud, responsable del tratamiento, plazos de conservación, derechos,
transferencias, incidentes y proveedores. Esta página no constituye opinión
legal.

## Cuestiones realmente pendientes

- proveedor y contrato de autenticación/almacenamiento que se seleccionarán
  durante la unidad 20 sin cambiar los principios de aislamiento;
- definición legal y operativa de retención, eliminación, exportación,
  backups y respuesta a incidentes;
- alcance comercial de finanzas y sus integraciones;
- canales que cada clínica habilitará y sus consentimientos/proveedores;
- reglas clínicas y contenido aprobado que no puede ser inventado por IA.

## Primera unidad implementable posterior

La siguiente unidad debe ser `20-fundacion-tenancy-identidad`. No debe crear
agenda todavía: entrega aislamiento y autorización verificables, reduce el
mayor riesgo de datos reales y habilita configuración, pacientes y agenda sin
hacer irreversible el modelo. Su spec deberá partir del modelo mínimo,
mantener el producto público v1 sin cambios y probar dos clínicas, dos sedes
y varios roles con datos ficticios.

## Criterios globales de aceptación de la planificación

- Las cuatro decisiones funcionales confirmadas están incorporadas: multi-
  clínica/multi-sede, historia odontológica, reserva directa y pacientes
  reales con seguridad transversal.
- La agenda es única; web, recepción, WhatsApp, chatbot, voz y futuros canales
  consumen el mismo núcleo.
- Historia clínica, administración y finanzas permanecen separados.
- Cada unidad tiene alcance, exclusiones, dependencias, riesgos, aceptación,
  evidencias y cierre.
- No se implementó funcionalidad nueva, no se agregaron tablas/endpoints ni se
  modificó infraestructura.
