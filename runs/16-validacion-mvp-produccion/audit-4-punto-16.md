# audit-4 — punto 16: diálogo, éxito parcial y estado de comunicación

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> una copia aislada del commit **`08f97e22e4016ccb86d1e41e5d28508d3e6c6d16`**
> (PR #43, mergeado a `develop`). Claude Code lo persiste **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **NO APROBADA**
>
> Lo que sigue es el texto del auditor, sin modificar.

---

El código no cumple la regla crítica ante un fallo de red. En `script.js:271-295`, cualquier error de `fetch` termina en `mostrarResultado('error')`, invitando a reenviar. La request pudo haber insertado el lead antes de perderse la respuesta, por lo que el reenvío puede duplicarlo.

El estado persistido también puede ser incorrecto. En `api/leads.js:899-978`, si un correo sale pero falla el `UPDATE` de su flag, el flag queda `false`. Sin embargo, `api/leads.js:993-1003` calcula `completa` solo con variables en memoria y puede guardar `estado_comunicacion = 'completa'`. El lead queda con comunicación no confirmada sin `requiere_revision`.

El guard principal tiene un hueco. `tests/test_dialogo_resultado.py:52-67` solo verifica que exista alguna regla exacta `[hidden]` con `display: none !important`. Seguiría en verde si se añadiera, por ejemplo, `.modal[hidden] { display: flex !important }`, que la pisaría por especificidad. La regla actual de `style.css:41` es correcta, pero el guard no detecta esa regresión.

Los casos `201` sin campo, con cuerpo ilegible y con comunicación parcial se tratan conservadoramente como parcial (`script.js:278-287`). La migración es reejecutable y compatible con datos existentes (`20260907093000_add_estado_comunicacion.sql:22-52`). La política SMTP evita reintentos ambiguos (`api/_lib/mailer.js:265-310`). No encontré filtraciones evidentes de PII en logs o respuestas.

AUDITORÍA: NO APROBADA