# audit-3 — envío del formulario (intento 1)

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada extraída del commit
> **`91f3a70a1bac9691cabdd37a9f694bbaedf2ded2`** (PR #39, mergeado a
> `develop`). Codex no escribe en este repositorio: Claude Code persiste
> el informe **literalmente**, sin reinterpretar hallazgos, veredicto ni
> recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la ampliación de alcance del punto 16 — doble submit,
>   feedback, confirmación y confiabilidad de los dos envíos SMTP.
> - **Veredicto**: **NO APROBADA**
>
> Las rutas absolutas que aparecen en el texto son las del directorio
> aislado de auditoría, no las del repositorio.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

La implementación no queda aprobada.

El defecto concreto está en [script.js:224-230](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\script.js:224): `response.json().catch(() => ({}))` convierte un JSON inválido en éxito. Con HTTP 201 pero `json()` fallido, se ejecuta `leadForm.reset()` en [script.js:232](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\script.js:232), contradiciendo la conservación de datos ante error. Los tests de [script.test.js](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\script.test.js) solo proporcionan `json()` resuelto y no pueden detectar este caso.

El guard de doble envío sí es correcto: [script.js:171](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\script.js:171) y [script.js:183](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\script.js:183) cubren el evento `submit`, y el estado se libera en las ramas de éxito y error. La filtración técnica también está correctamente evitada.

El reintento SMTP está acotado a un intento adicional en [api/_lib/mailer.js:302-319](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\api\_lib\mailer.js:302), distingue códigos transitorios y permanentes, y el pool usa una sola conexión en [api/_lib/mailer.js:73-74](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\api\_lib\mailer.js:73).

El diálogo implementa `role`, `aria-modal`, foco inicial, Escape y retorno del foco en [index.html:269-277](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\index.html:269) y [script.js:137-159](C:\Users\jlbel\AppData\Local\Temp\claude\D--proyectos-gi-clinicadental\92f198c0-bb54-40c0-bd39-69520286cb35\scratchpad\audit-envio\script.js:137). Sin embargo, no hay trampa de foco; el foco puede escapar del diálogo mediante Tab.

AUDITORÍA: NO APROBADA