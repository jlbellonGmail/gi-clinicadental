# audit-2 — intento 4 (evidencia del punto 16)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada de `runs/` y del árbol liberado
> en **`109d0afe75803f0e6f8e3e7ae40127d66cee04ef`** (`main`, PR #42,
> desplegado en Production como `6298664005`). Codex no escribe en este
> repositorio: Claude Code persiste el informe **literalmente**, sin
> reinterpretar hallazgos, veredicto ni recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la **evidencia completa** del punto 16, incluida la
>   ampliación del envío del formulario.
> - **Veredicto**: **NO APROBADA**
>
> Al auditor se le declararon por escrito, antes de auditar, los tres
> pendientes —V12 sin confirmar en teléfono real, las seis filas
> sintéticas sin descartar, y la imposibilidad de saber desde la sesión si
> los 13,8 s incluyeron un reintento SMTP— para que los juzgara él.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: rejected
attempt: 4
feedback:
  - `runs/decision.md:1106-1124` sigue presentando como estado vigente `main` `4e86134`, deployment `6295205198`, suites `213/213` y `59/59`, y cinco filas sintéticas. El estado actual documentado en `runs/test-report-6.md:381-459` es `main` `109d0afe...`, deployment `6298664005`, suites `248/248` y `60/60`, y seis filas. Falta un addendum vigente que sobrescriba claramente ese estado narrativo.
  - `runs/decision.md:1099-1124` tampoco incorpora la ampliación de alcance: doble submit, feedback, confirmación, SMTP consecutivo y la incertidumbre sobre el reintento de los 13,8 s. El lector del HITL puede tomar el cierre antiguo como la fotografía actual.

El aviso antepuesto en `runs/audit-2.md:1-18` sí alcanza para corregir el defecto que provocó el rechazo anterior. Identifica el SHA y deployment obsoletos, explica por qué el veredicto ya no aplica y conserva el informe original. `runs/audit-2-intento-3.md:30-47` confirma correctamente esa evaluación.

La evidencia nueva del envío es, en general, fiel. `runs/test-report-6.md:381-405` documenta el release #42, el deployment exitoso y la identidad byte a byte de los cinco archivos servidos. `runs/test-report-6.md:407-443` registra el envío real, el doble-submit bloqueado, el feedback, el reset únicamente tras `201`, el diálogo y la trampa de foco. Los dos rechazos previos y la aprobación final de `audit-3` están persistidos literalmente en los tres artefactos correspondientes.

La limitación SMTP está declarada con honestidad: `runs/test-report-6.md:448-459` dice expresamente que no se puede determinar si los 13,8 segundos incluyen un reintento y deja pendientes los flags de Supabase o los logs de Vercel. No presenta esa medición como confirmación del reintento.

V12 también está declarada correctamente como pendiente de validación visual en teléfono real. La medición estructural de 31 casos no se presenta como sustituto de esa comprobación. Las seis filas sintéticas están declaradas como pendientes de pasar a `estado='descartado'`; el problema es que el documento central todavía dice cinco.

No encontré secretos operativos: no aparecen valores utilizables de claves, tokens, cookies, cabeceras `Authorization` ni passwords SMTP. Los artefactos usan placeholders, nombres de variables o fragmentos no utilizables (`runs/audit-2-intento-3.md:44-45`; `runs/test-report-2.md:1311-1322`). Tampoco encontré datos de pacientes ni información clínica real. Los nombres y mensajes están marcados como sintéticos y los buzones usados están descritos como cuentas controladas (`runs/test-report-2.md:1389-1392`; `runs/test-report-6.md:405-406`).

Las auditorías previas están conservadas: existen `audit-1.md` y los intentos 2 a 9, además de la contingencia. Los cuatro rechazos reales, la aprobación y el hallazgo incorrecto sobre el conteo de tests están respondidos en `runs/decision.md:941-998`. El estado de `producto/ROADMAP.md:119` permanece en `[ ] 16-validacion-mvp-produccion`, sin tags y con la feature sin mergear según el estado verificado entregado.

La evidencia operativa nueva es aprobable, pero el relato central no es fiel al estado final porque su sección vigente sigue congelada en el árbol anterior y omite la ampliación de alcance. Debe añadirse una actualización explícita y fechada con los datos de `109d0afe...`, `6298664005`, `248/248`, `60/60`, seis filas y los tres pendientes reales antes del HITL 2.

AUDITORÍA: NO APROBADA