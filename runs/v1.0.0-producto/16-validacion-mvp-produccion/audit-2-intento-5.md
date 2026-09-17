# audit-2 — intento 5 (evidencia del punto 16)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada de `runs/` y del árbol liberado
> en **`109d0afe75803f0e6f8e3e7ae40127d66cee04ef`** (`main`, PR #42,
> desplegado en Production como `6298664005`). Codex no escribe en este
> repositorio: Claude Code persiste el informe **literalmente**, sin
> reinterpretar hallazgos, veredicto ni recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la evidencia completa del punto 16.
> - **Veredicto**: **NO APROBADA**
> - **Intento anterior**: `audit-2-intento-4.md`, `NO APROBADA`, por tener
>   `decision.md` congelado en el árbol anterior. Corregido.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

status: rejected
attempt: 5
feedback:
  - `runs/decision.md:882` afirma “tras cuatro rechazos”, pero hay cinco rechazos reales: `audit-1-intento-4.md:12`, `audit-1-intento-5.md:17`, `audit-1-intento-6.md:16`, `audit-1-intento-7.md:15` y `audit-1-intento-8.md:16`. La aprobación está en `audit-1-intento-9.md:15`.
  - El aviso de `runs/audit-2.md:1-18` alcanza para impedir que su aprobación histórica se tome como vigente. El estado actual sí está actualizado en `runs/decision.md:874-910`.

El resto de la evidencia final es consistente:

- `decision.md:884-889` refleja el `main` final, el deployment correcto y las suites `248/248`, `60/60` y MkDocs OK.
- `test-report-6.md:448-459` declara correctamente que no se puede saber si los 13,8 segundos incluyen un reintento SMTP.
- `decision.md:907-910` deja visibles V12, los flags SMTP y las seis filas sintéticas como pendientes; no los presenta como validados.
- Los errores propios están documentados en `test-report-5.md:240-365` y en los reportes de envío: medición con `innerWidth`, empeoramiento de `404.html`, tres guards ineficaces y correcciones verificadas en negativo.
- Las dos auditorías rechazadas y la aprobación final de `audit-3` están persistidas literalmente.
- No encontré secretos utilizables, tokens, cookies, cabeceras `Authorization`, claves Supabase ni passwords SMTP. Los correos visibles son buzones controlados y aliases de prueba; no hay datos de pacientes ni información clínica real.
- `producto/ROADMAP.md:119` sigue en `[ ]`; no hay tag declarado y la feature continúa sin mergear.

La discrepancia del conteo de rechazos contradice la exigencia de fidelidad exacta del relato central. V12, las seis filas y la incertidumbre SMTP no son motivos de rechazo porque están declaradas con claridad.

AUDITORÍA: NO APROBADA