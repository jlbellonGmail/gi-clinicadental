# audit-5 — punto 16 (intento 2) — **APROBADA**

> **Procedencia.** Informe de **Codex CLI** en modo `-s read-only`, sobre
> una copia aislada del commit **`a64c6e91441286bda99b70094362e6a3870906cf`**
> (PR #44, mergeado a `develop`). Claude Code lo persiste **literalmente**.
>
> - **Fecha**: 2026-09-07
> - **Veredicto**: **APROBADA**
> - **Intento anterior**: `audit-4-punto-16.md`, `NO APROBADA`.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

Auditoría del punto 16 sobre SHA `a64c6e9`.

El diálogo inicia oculto en HTML y CSS. `[hidden] { display: none !important }` impide que `.modal` o cualquier selector visible lo reabra mientras conserve el atributo (`index.html:271`, `style.css:41-43`). JavaScript solo lo muestra tras una respuesta `201` o ante un fallo de red (`script.js:123-150`, `script.js:260-312`). No encontré caminos adicionales de apertura.

El guard del diálogo cubre el defecto original y también selectores específicos que mencionen `[hidden]` (`tests/test_dialogo_resultado.py:42-83`). Los tres estados están presentes, sus variantes arrancan ocultas y el guard verifica que el éxito parcial no invite a reenviar (`tests/test_dialogo_resultado.py:86-182`).

La clasificación de resultados es correcta: cualquier `201`, incluso sin campo `comunicacion_completa` o con cuerpo ilegible, se trata como lead registrado y muestra éxito parcial (`script.js:268-287`; `script.test.js:442-467`). Los estados distintos de `201`, incluido `429`, y el fallo de red muestran error y conservan los datos (`script.js:289-312`; `script.test.js:473-540`). El mensaje parcial indica explícitamente que no hace falta reenviar (`index.html:289-300`).

La persistencia separa correctamente envío efectivo y persistencia de cada flag. `completa` exige ambos envíos y ambos flags persistidos; cualquier fallo deriva en `requiere_revision` (`api/leads.js:835-841`, `api/leads.js:901-994`, `api/leads.js:997-1013`). El `UPDATE` del estado es no fatal, pero sus fallos se registran y no convierten una comunicación incompleta en completa (`api/leads.js:1015-1045`).

La rama idempotente no inserta ni reenvía correos y devuelve el estado derivado de los flags existentes (`api/leads.js:690-769`). La limitación residual fuera de la ventana de duplicados está declarada en la documentación (`docs/estado-comunicacion-leads.md:154-169`).

La migración es reejecutable mediante `if not exists` para columna, constraint e índice. El `default 'pendiente'` y `not null` cubren las filas existentes, y el endpoint no depende de la columna para insertar (`supabase/migrations/20260907093000_add_estado_comunicacion.sql:21-52`; `api/leads.js:772-818`).

La política SMTP solo reintenta errores de conexión/DNS demostrablemente previos al envío, `ETIMEDOUT` marcado como conexión y rechazos explícitos `4xx`. Los errores ambiguos no se reintentan (`api/_lib/mailer.js:257-310`). El bucle limita el reintento a una sola repetición (`api/_lib/mailer.js:333-355`).

No observé exposición de PII, secretos, mensajes internos ni respuestas SMTP. El logger usa lista blanca, valida valores y extrae únicamente metadatos acotados (`api/_lib/logger.js:146-155`, `api/_lib/logger.js:228-261`, `api/_lib/logger.js:273-296`; `api/leads.js:1056-1060`).

La accesibilidad está resuelta: foco inicial en “Entendido”, devolución del foco al cerrar, `Escape`, trampa de Tab y `aria-labelledby` actualizado según la variante visible (`index.html:273-314`; `script.js:134-216`). Los guards correspondientes son alcanzables y no dependen de una ejecución real del navegador para detectar el defecto de cascada.

No encontré defectos concretos dentro del alcance solicitado.

AUDITORÍA: APROBADA