# Plan del producto ClínicaDental v2

Esta es una planificación, no una pantalla ni una funcionalidad disponible.
El proyecto actual sigue siendo el sitio de captación de leads de la versión
1.0.1. La release `v1.0.2` identifica la base de gobernanza y herramientas.

## Qué existe hoy

El sitio permite presentar servicios y enviar una consulta de contacto. El
backend valida el formulario, guarda leads en Supabase y gestiona correo,
consentimiento y estados de comunicación. No existen todavía cuentas de
usuarios, pacientes, turnos, agenda, historia clínica, pagos, WhatsApp,
chatbot ni asistente telefónico.

## Qué se planifica

ClínicaDental v2 crecerá por unidades: primero aislamiento e identidad, luego
configuración, profesionales y pacientes administrativos; después una agenda
central para todos los canales; y más adelante seguimiento, mensajería,
historia clínica, operación y asistentes.

La agenda será única. Ningún canal podrá inventar horarios o confirmar un
turno antes de que el sistema lo haya guardado correctamente. El chatbot y la
voz serán asistentes administrativos y derivarán a una persona cuando no
puedan completar una solicitud.

## Seguridad

El diseño contempla clínicas y sedes aisladas, permisos por función,
separación entre datos administrativos, clínicos y financieros, auditoría,
consentimiento y uso exclusivo de datos ficticios o anonimizados durante
desarrollo y pruebas. Antes de usar pacientes reales deberán completarse las
validaciones legales, operativas y de proveedores correspondientes.

## Próximo ciclo

El siguiente trabajo propuesto es `20-fundacion-tenancy-identidad`. Esta
planificación debe ser revisada y aprobada antes de construirlo. No se
aprueba todavía ninguna funcionalidad de ClínicaDental v2.
