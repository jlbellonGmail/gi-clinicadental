# Decision — 19-planificacion-producto-v2

## Decisiones

- **Multi-clínica/multi-sede:** el modelo futuro aislará clínicas, sedes,
  usuarios, profesionales, pacientes, consultorios, agenda, configuración,
  comunicaciones y permisos; la primera unidad implementará el mínimo sin
  bloquear ese aislamiento.
- **Historia clínica odontológica:** forma parte de v2 y se separará del
  registro administrativo y financiero, por unidades de historia,
  odontograma, diagnóstico, tratamiento y documentos.
- **Reserva directa del paciente:** estará disponible por canales habilitados,
  siempre contra una agenda central y reglas comunes, con persistencia antes
  de confirmar.
- **Pacientes reales:** el diseño incorpora privacidad, autenticación,
  autorización, mínimo privilegio, auditoría, trazabilidad, secretos,
  documentos, backups, recuperación y consentimiento desde el inicio; las
  pruebas y demos usarán datos ficticios o anonimizados.

Estas son las cuatro decisiones funcionales confirmadas y se reflejan en las
secciones de seguridad, mapa, dependencias y roadmap del documento técnico.

- La unidad es `Feature` por corresponder al hito `19-` del ROADMAP; no es
  una release de mantenimiento y su campo `version` queda vacío.
- ASSESS determinó `HIGH/FULL` para el conjunto documental transversal.
- La agenda central será la única fuente de verdad para disponibilidad y
  turnos; todos los canales consumirán los mismos casos de uso.
- Multi-clínica y multi-sede se contemplan desde el modelo, pero la primera
  construcción minimizará el alcance operativo inicial sin bloquear el aislamiento futuro.
- Administración, clínica y finanzas permanecen separados por dominio y autorización.
- La IA será adaptador de intención y no propietaria de reglas, datos ni permisos.
- Seguridad, privacidad, auditoría, consentimiento y mínimo privilegio
  acompañan cada unidad y no se relegan a una fase final.

## Evidencia

El baseline contiene landing estática, `POST /api/leads`, persistencia de
leads en Supabase, RLS, SMTP, consentimiento, configuración de clínica,
tests Node/Python y CI. No contiene usuarios, pacientes, agenda, mensajería
multicanal, historia clínica, chatbot ni voz implementados. Los detalles y
los límites se documentan en `docs/tecnica/planificacion-producto-v2.md`.
