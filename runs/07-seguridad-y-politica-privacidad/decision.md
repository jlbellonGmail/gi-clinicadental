# Decisiones — 07-seguridad-y-politica-privacidad

Fuente: `runs/07-seguridad-y-politica-privacidad/spec.md` (aprobado en
`audit-1.md`, intento 1, sin objeciones bloqueantes; dos observaciones
menores no bloqueantes sobre el tamaño del checkbox).

## Decisiones demostrables tomadas durante la implementación

1. **Unificación del tamaño del checkbox a 24×24px** (atiende la
   observación no bloqueante 1 de `audit-1.md`, que señalaba la
   inconsistencia entre "≥18px" del diseño propuesto y "~24×24px" de
   casos borde). Implementado en `style.css`,
   `.form-group--consent input[type="checkbox"]`, con `width`, `height`
   y `min-width` fijados en `24px`, alineado con WCAG 2.2 SC 2.5.8
   (Target Size). Evidencia: `style.css`, bloque "Consentimiento de
   privacidad (checkbox obligatorio)".

2. **`leadForm.reset()` no requirió ningún cambio de código** para
   destildar el checkbox tras un envío simulado exitoso: es
   comportamiento nativo de `HTMLFormElement.reset()` sobre
   `<input type="checkbox">`. No se agregó lógica adicional en
   `script.js` para este caso, tal como anticipaba el diseño del spec
   (sección 4, punto 3).

3. **Segunda capa de validación del consentimiento en JS, no reemplaza
   la nativa**: se agregó `if (!consentCheckbox || !consentCheckbox.checked)
   { return; }` al inicio del handler de `submit`, antes de construir
   `leadPayload` y antes del `setTimeout` de simulación. Es un chequeo
   defensivo explícito (documentado como tal en
   `docs/tecnica/seguridad-y-politica-privacidad.md`), no la primera
   línea de defensa — esa sigue siendo el atributo `required` nativo del
   checkbox, que ya impide que el evento `submit` se dispare sin marcar
   la casilla.

4. **`api/leads.js` se verificó sin modificarse**: se confirmó por
   lectura directa del archivo que `REQUIRED_STRING_FIELDS` incluye
   `'version_politica_privacidad'`, `LENGTHS.version_politica_privacidad
   = { min: 1, max: 50 }`, la verificación `consentimiento_privacidad
   !== true` responde `consentimiento_requerido`, y el `INSERT` escribe
   ambos campos en la fila insertada — exactamente como describe el
   spec (sección "Diseño propuesto > 6" y criterio de aceptación 13). No
   se encontró ninguna discrepancia; no se hizo ningún cambio en ese
   archivo.

5. **`politica-privacidad.html` reutiliza el `<header>` fijo existente
   sin agregar CSS nuevo para esa parte**: se reemplazó únicamente el
   CTA de la derecha (antes "Reserva Ahora" en `index.html`) por un
   enlace "Volver al inicio" usando las clases `btn btn-outline` ya
   existentes. Se decidió esto en vez de crear un header propio para
   minimizar CSS nuevo y mantener consistencia visual entre ambas
   páginas del sitio.

6. **Foco visible agregado globalmente (`:focus-visible`)**: no existía
   ningún estilo de foco visible para enlaces en el sitio antes de esta
   feature (los `<input>` sí tenían un `:focus`, pero no
   `:focus-visible`, y los `<a>` no tenían ninguno). Se agregó una regla
   global en `style.css` para cumplir el criterio de aceptación 14
   ("navegable por teclado ... foco visible en el enlace de vuelta y en
   cualquier enlace interno"). Se aplicó con `:focus-visible` (no
   `:focus`) para no cambiar la apariencia al hacer click con mouse,
   solo al navegar con teclado — decisión de alcance ligeramente mayor
   al mínimo pedido por el spec (afecta también a `index.html`), pero
   necesaria porque el criterio 14 exige foco visible verificable y no
   existía ningún mecanismo previo que lo satisficiera solo dentro de
   `politica-privacidad.html`.

7. **Los tres datos institucionales no confirmados quedan como
   placeholders explícitos, no inventados**: responsable del
   tratamiento (razón social/CUIT/domicilio), plazo de conservación, y
   canal de contacto ARCO. Se usó literalmente el patrón `[A COMPLETAR
   POR EL CLIENTE: ...]` que exige el spec (criterio de aceptación 8),
   con una clase CSS `.legal-placeholder` para hacerlos visualmente
   identificables. No se reutilizó `hola@saviadental.com` como canal
   ARCO confirmado, remitiendo en cambio al ítem
   `10-actualizacion-datos-contacto` del `ROADMAP.md`, tal como exige el
   spec explícitamente.

8. **La versión de la política coincide carácter por carácter**: el
   texto "Versión: v1-2026-08-20" en `politica-privacidad.html` contiene
   exactamente el valor de `POLITICA_PRIVACIDAD_VERSION = 'v1-2026-08-20'`
   en `script.js` (14 caracteres, dentro del límite de 50 que valida
   `api/leads.js`).

9. **`leadPayload` queda construido pero no se envía por red**: tal como
   exige explícitamente el spec ("Explícitamente NO incluye": no se
   conecta `#leadForm` a `POST /api/leads`). El bloque `setTimeout` de
   simulación no se tocó ni se eliminó.

## Discrepancias encontradas vs. el spec

Ninguna. Todas las afirmaciones fácticas del spec sobre el estado del
código (`index.html`, `script.js`, `api/leads.js`, la migración SQL) se
verificaron como ciertas al momento de implementar, consistente con lo
ya confirmado por el reviewer-agent en `audit-1.md`.

## Observaciones de la auditoría atendidas

- Observación 1 (`audit-1.md`): unificación del tamaño del checkbox a
  24×24px — atendida (ver decisión 1 arriba). No se agregó un criterio
  de aceptación nuevo al spec, tal como indicaba explícitamente el
  encargo de esta feature ("no hace falta agregar un nuevo criterio de
  aceptación").
- Observación 2 (`audit-1.md`): sugerencia de promover el tamaño de área
  clickeable a criterio de aceptación explícito en specs futuras del
  mismo estilo — es una recomendación para el analyst-agent en
  iteraciones futuras, no una acción a tomar dentro de esta feature.
