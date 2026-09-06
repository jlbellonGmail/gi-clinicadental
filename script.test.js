'use strict';

// Tests del envio del formulario (punto 16). Es la primera cobertura que
// tiene `script.js`: hasta ahora los 213 tests eran todos de backend, y
// los tres defectos que corrigen estos casos se detectaron usando el
// sitio a mano, no en CI.
//
// Corren sobre un DOM real (jsdom) construido con el `index.html` del
// repositorio, no con un fixture inventado: si el markup del formulario
// cambia y deja de cablear el boton, estos tests fallan.
//
// LIMITE DECLARADO: jsdom no pinta. Verifica estado, atributos y
// llamadas, no el aspecto visual. El layout se valida por separado, con
// mediciones en viewport real (ver test-report-5.md).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RAIZ = __dirname;
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const SCRIPT = fs.readFileSync(path.join(RAIZ, 'script.js'), 'utf8');

/**
 * Monta `index.html` con `script.js` ejecutado encima y `fetch` espiado.
 *
 * El `fetch` falso devuelve una Promise que NO se resuelve sola: la
 * resuelve el test cuando quiere. Eso es lo que permite observar la
 * ventana en la que la request esta pendiente, que es justo donde vivia
 * el defecto del doble envio.
 */
async function montarPagina() {
  const dom = new JSDOM(HTML, {
    runScripts: 'outside-only',
    url: 'https://ejemplo.test/',
  });
  const { window } = dom;
  const documento = window.document;

  // jsdom no implementa ninguna de las dos; `script.js` las usa para las
  // animaciones al scroll, que no son objeto de estos tests.
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.scrollTo = () => {};

  const llamadas = [];
  let resolverActual = null;
  let rechazarActual = null;

  window.fetch = (url, opciones) => {
    llamadas.push({ url, opciones });
    return new window.Promise((resolve, reject) => {
      resolverActual = resolve;
      rechazarActual = reject;
    });
  };

  window.eval(SCRIPT);

  // Se espera el `DOMContentLoaded` REAL de jsdom en vez de fabricarlo.
  // Al evaluar el script el `readyState` todavia es `loading`, asi que un
  // `dispatchEvent` manual lo disparaba una vez y jsdom lo volvia a
  // disparar al terminar de parsear: el handler corria dos veces y
  // quedaban dos listeners de submit. El sintoma aparecia solo en los
  // tests que envian una segunda vez despues de un `await`, que es
  // cuando llegaba el segundo evento.
  await new Promise((resolve) => {
    if (documento.readyState !== 'loading') {
      resolve();
      return;
    }
    documento.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });

  const esperarMicrotareas = async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  return {
    window,
    documento,
    llamadas,
    formulario: documento.getElementById('leadForm'),
    boton: documento.getElementById('submitLead'),
    etiqueta: documento.getElementById('submitLeadLabel'),
    error: documento.getElementById('formError'),
    modal: documento.getElementById('modalExito'),
    esperarMicrotareas,
    responder(status, cuerpo = { id: 'lead-sintetico' }) {
      resolverActual({
        status,
        ok: status >= 200 && status < 300,
        json: () => window.Promise.resolve(cuerpo),
      });
    },
    responderConCuerpoIlegible(status) {
      resolverActual({
        status,
        ok: status >= 200 && status < 300,
        json: () => window.Promise.reject(new window.Error('Unexpected token < in JSON')),
      });
    },
    fallarRed(mensaje = 'network') {
      rechazarActual(new window.Error(mensaje));
    },
  };
}

/** Rellena el formulario con datos sinteticos y marca el consentimiento. */
function completarFormulario(documento) {
  documento.getElementById('name').value = 'Paciente De Prueba';
  documento.getElementById('email').value = 'prueba@ejemplo.test';
  documento.getElementById('message').value = 'Mensaje sintetico de prueba';
  documento.getElementById('consent').checked = true;
}

/**
 * Dispara un submit. Es exactamente el evento que produce tanto el click
 * sobre el boton como la tecla Enter dentro de un campo: por eso los
 * casos de "doble click" y "Enter repetido" se ejercitan igual.
 */
function enviar(pagina) {
  pagina.formulario.dispatchEvent(
    new pagina.window.Event('submit', { bubbles: true, cancelable: true })
  );
}

test('el primer submit valido dispara exactamente una request', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);

  assert.equal(pagina.llamadas.length, 1);
  assert.equal(pagina.llamadas[0].url, '/api/leads');
  assert.equal(pagina.llamadas[0].opciones.method, 'POST');
});

test('un segundo submit mientras la request esta pendiente NO dispara otra', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  enviar(pagina);
  enviar(pagina);

  assert.equal(
    pagina.llamadas.length,
    1,
    'El guard de doble envio estaba invertido: rehabilitaba el boton al ' +
      'detectar el segundo submit, con la request todavia en vuelo.'
  );
});

test('el Enter repetido tampoco dispara requests adicionales', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  // Enter dentro de un campo produce este mismo evento `submit`.
  enviar(pagina);
  enviar(pagina);

  assert.equal(pagina.llamadas.length, 1);
});

test('el click sobre el boton no dispara una segunda request mientras envia', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.boton.dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );

  assert.equal(pagina.llamadas.length, 1);
});

test('durante el envio el boton queda deshabilitado y anunciado como ocupado', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);

  assert.equal(pagina.boton.disabled, true);
  assert.equal(pagina.boton.getAttribute('aria-busy'), 'true');
  assert.equal(pagina.boton.getAttribute('aria-disabled'), 'true');
});

test('durante el envio la etiqueta dice "Enviando solicitud..."', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);

  assert.equal(pagina.etiqueta.textContent, 'Enviando solicitud...');
});

test('el boton tiene un indicador visual de carga en el markup', async () => {
  const pagina = await montarPagina();
  const spinner = pagina.boton.querySelector('.form-submit__spinner');

  assert.ok(spinner, 'Falta el spinner dentro del boton de envio');
  // Decorativo: no debe anunciarse a un lector de pantalla, que ya recibe
  // el estado por `aria-busy`.
  assert.equal(spinner.getAttribute('aria-hidden'), 'true');
});

test('sin consentimiento no se envia nada', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);
  pagina.documento.getElementById('consent').checked = false;

  enviar(pagina);

  assert.equal(pagina.llamadas.length, 0);
});

test('ante error el boton vuelve a habilitarse y se puede reintentar', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(500);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.boton.disabled, false);
  assert.equal(pagina.boton.hasAttribute('aria-busy'), false);
  assert.equal(pagina.etiqueta.textContent, 'Enviar Solicitud');

  enviar(pagina);
  assert.equal(pagina.llamadas.length, 2, 'El reintento debe poder enviarse');
});

test('ante error se conservan los datos escritos', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(500);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.documento.getElementById('name').value, 'Paciente De Prueba');
  assert.equal(pagina.documento.getElementById('email').value, 'prueba@ejemplo.test');
  assert.equal(
    pagina.documento.getElementById('message').value,
    'Mensaje sintetico de prueba'
  );
  assert.equal(pagina.documento.getElementById('consent').checked, true);
});

test('ante error se muestra un mensaje visible y anunciado', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(500);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.error.hidden, false);
  assert.ok(pagina.error.textContent.trim().length > 0);
  assert.equal(pagina.error.getAttribute('role'), 'alert');
});

test('un fallo de red tambien deja el formulario reintentable', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.fallarRed();
  await pagina.esperarMicrotareas();

  assert.equal(pagina.boton.disabled, false);
  assert.equal(pagina.error.hidden, false);
  assert.equal(pagina.documento.getElementById('name').value, 'Paciente De Prueba');
});

test('el mensaje de error no filtra detalle tecnico', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.fallarRed('ETIMEDOUT connect 10.0.0.1:465 request_id=abc-123');
  await pagina.esperarMicrotareas();

  const texto = pagina.error.textContent.toLowerCase();
  for (const filtracion of ['request_id', 'etimedout', 'supabase', 'smtp', '10.0.0.1', '500']) {
    assert.ok(
      !texto.includes(filtracion),
      'El mensaje de error muestra detalle tecnico: ' + filtracion
    );
  }
});

test('un 429 se explica sin tecnicismos', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(429);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.error.hidden, false);
  assert.ok(!pagina.error.textContent.includes('429'));
});

test('solo un 201 confirmado resetea el formulario', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(200); // 2xx que NO es el 201 del endpoint
  await pagina.esperarMicrotareas();

  assert.equal(
    pagina.documento.getElementById('name').value,
    'Paciente De Prueba',
    'Sin 201 confirmado no se descarta lo que el usuario escribio'
  );
  assert.equal(pagina.error.hidden, false);
});

test('con 201 el formulario se resetea y el boton vuelve a estar disponible', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.documento.getElementById('name').value, '');
  assert.equal(pagina.documento.getElementById('email').value, '');
  assert.equal(pagina.documento.getElementById('consent').checked, false);
  assert.equal(pagina.boton.disabled, false);
  assert.equal(pagina.etiqueta.textContent, 'Enviar Solicitud');
  assert.equal(pagina.error.hidden, true);
});

test('con 201 se muestra la confirmacion', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  assert.equal(pagina.modal.hidden, true, 'El modal arranca oculto');

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.modal.hidden, false);
  const dialogo = pagina.modal.querySelector('[role="dialog"]');
  assert.ok(dialogo, 'La confirmacion debe ser un dialogo');
  assert.equal(dialogo.getAttribute('aria-modal'), 'true');
  assert.ok(dialogo.getAttribute('aria-labelledby'), 'El dialogo necesita titulo accesible');
});

test('la confirmacion NO promete un correo que el frontend no puede confirmar', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  const texto = pagina.modal.textContent.toLowerCase();
  for (const promesa of ['correo', 'email', 'e-mail', 'mail', 'bandeja', 'casilla']) {
    assert.ok(
      !texto.includes(promesa),
      'La confirmacion afirma haber enviado un correo, y la respuesta del ' +
        'endpoint no permite saberlo: "' + promesa + '"'
    );
  }
  // Lo que si tiene que decir, porque es lo unico confirmado.
  assert.ok(texto.includes('recibimos tu solicitud'));
  assert.ok(texto.includes('todavía no está confirmado'));
});

test('el foco entra al dialogo al abrirse', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  assert.equal(
    pagina.documento.activeElement,
    pagina.documento.getElementById('modalExitoCerrar')
  );
});

test('el boton de la confirmacion la cierra', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  pagina.documento.getElementById('modalExitoCerrar').dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );

  assert.equal(pagina.modal.hidden, true);
});

test('Escape cierra la confirmacion', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  pagina.documento.dispatchEvent(
    new pagina.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );

  assert.equal(pagina.modal.hidden, true);
});

test('al cerrar la confirmacion el usuario sigue en la misma pagina y puede reenviar', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  pagina.documento.getElementById('modalExitoCerrar').dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );

  assert.equal(pagina.window.location.href, 'https://ejemplo.test/', 'No debe redirigir');
  assert.equal(pagina.documento.body.classList.contains('con-modal'), false);

  completarFormulario(pagina.documento);
  enviar(pagina);
  assert.equal(pagina.llamadas.length, 2);
});

test('el payload enviado conserva el consentimiento y la version de la politica', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);

  const cuerpo = JSON.parse(pagina.llamadas[0].opciones.body);
  assert.equal(cuerpo.consentimiento_privacidad, true);
  assert.match(cuerpo.version_politica_privacidad, /^v\d+-\d{4}-\d{2}-\d{2}$/);
  assert.equal(cuerpo.nombre, 'Paciente De Prueba');
});

test('un 201 con cuerpo ilegible sigue siendo exito', async () => {
  // Hallazgo de la auditoria: antes se hacia `response.json().catch(...)`,
  // y eso dejaba una rama ambigua -un 201 confirmado con cuerpo roto-.
  // Ahora el cuerpo no se lee: manda el status. El lead fue creado.
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responderConCuerpoIlegible(201);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.documento.getElementById('name').value, '');
  assert.equal(pagina.modal.hidden, false);
  assert.equal(pagina.error.hidden, true);
  assert.equal(pagina.boton.disabled, false);
});

test('un 500 con cuerpo ilegible sigue siendo error', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responderConCuerpoIlegible(500);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.documento.getElementById('name').value, 'Paciente De Prueba');
  assert.equal(pagina.modal.hidden, true);
  assert.equal(pagina.error.hidden, false);
});

test('el foco no se escapa del dialogo con Tab', async () => {
  // Con `aria-modal="true"` el resto del documento se anuncia como
  // inerte, pero el Tab del teclado igual se escapaba: el foco terminaba
  // en la pagina de atras, que visualmente esta tapada.
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201);
  await pagina.esperarMicrotareas();

  const cerrar = pagina.documento.getElementById('modalExitoCerrar');
  assert.equal(pagina.documento.activeElement, cerrar);

  const tab = (shift) =>
    pagina.documento.dispatchEvent(
      new pagina.window.KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: shift,
        bubbles: true,
        cancelable: true,
      })
    );

  tab(false);
  assert.equal(pagina.documento.activeElement, cerrar, 'Tab debe quedarse en el diálogo');

  tab(true);
  assert.equal(pagina.documento.activeElement, cerrar, 'Shift+Tab también');

  // Si algo saca el foco fuera, el siguiente Tab lo devuelve.
  pagina.documento.getElementById('name').focus();
  tab(false);
  assert.equal(pagina.documento.activeElement, cerrar);
});

test('con el dialogo cerrado el Tab no se interfiere', async () => {
  const pagina = await montarPagina();
  const nombre = pagina.documento.getElementById('name');
  nombre.focus();

  const evento = new pagina.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  pagina.documento.dispatchEvent(evento);

  assert.equal(evento.defaultPrevented, false, 'Sin modal abierto, el Tab es del navegador');
  assert.equal(pagina.documento.activeElement, nombre);
});
