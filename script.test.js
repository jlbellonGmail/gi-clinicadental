'use strict';

// Tests del envio del formulario. Es la unica cobertura automatica que
// tiene `script.js`, y existe porque un guard de doble envio invertido
// llego a Production sin que nada lo detectara.
//
// Corren sobre un DOM real (jsdom) construido con el `index.html` del
// repositorio, no con un fixture inventado: si el markup deja de cablear
// el boton o el dialogo, estos tests fallan.
//
// LIMITE DECLARADO, Y NO ES MENOR: jsdom no pinta y su cascada CSS no
// modela la precedencia entre estilos de autor y de agente de usuario.
// El dialogo se veia al cargar la pagina porque `.modal { display: flex }`
// pisaba el `[hidden]` del navegador, y jsdom devolvia `display: none`
// igual: **este archivo no puede detectar esa clase de defecto**. Lo
// vigila `tests/test_responsive_movil.py`, sobre el CSS.

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
 * resuelve el test cuando quiere. Eso permite observar la ventana en la
 * que la request esta pendiente, que es justo donde vivia el defecto del
 * doble envio.
 *
 * Montar de nuevo equivale a recargar la pagina: mismo HTML servido,
 * mismo script, estado en blanco.
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
  const lecturasDeCuerpo = { total: 0 };

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
  // quedaban dos listeners de submit.
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

  const variante = (nombre) =>
    documento.querySelector('.modal__variante[data-resultado="' + nombre + '"]');

  return {
    window,
    documento,
    llamadas,
    lecturasDeCuerpo,
    formulario: documento.getElementById('leadForm'),
    boton: documento.getElementById('submitLead'),
    etiqueta: documento.getElementById('submitLeadLabel'),
    modal: documento.getElementById('modalResultado'),
    variante,
    /** Nombre de la variante visible, o null si el dialogo esta cerrado. */
    resultadoVisible() {
      if (documento.getElementById('modalResultado').hidden) return null;
      for (const nombre of ['exito', 'parcial', 'error']) {
        if (!variante(nombre).hidden) return nombre;
      }
      return null;
    },
    esperarMicrotareas,
    responder(status, cuerpo = {}) {
      resolverActual({
        status,
        ok: status >= 200 && status < 300,
        json: () => {
          lecturasDeCuerpo.total += 1;
          return window.Promise.resolve(cuerpo);
        },
      });
    },
    responderConCuerpoIlegible(status) {
      resolverActual({
        status,
        ok: status >= 200 && status < 300,
        json: () => {
          lecturasDeCuerpo.total += 1;
          return window.Promise.reject(new window.Error('Unexpected token < in JSON'));
        },
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

const EXITO = { id: 'lead-sintetico', comunicacion_completa: true, requiere_revision: false };
const PARCIAL = { id: 'lead-sintetico', comunicacion_completa: false, requiere_revision: true };

// ---------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------

test('la pagina recien cargada tiene el dialogo cerrado', async () => {
  const pagina = await montarPagina();

  assert.equal(pagina.modal.hidden, true);
  assert.equal(pagina.resultadoVisible(), null);
});

test('recargar la pagina deja el dialogo cerrado', async () => {
  // Montar de nuevo es exactamente lo que hace un refresh: mismo HTML
  // servido, mismo script, estado en blanco.
  for (let i = 0; i < 3; i += 1) {
    const pagina = await montarPagina();
    assert.equal(pagina.modal.hidden, true, 'recarga #' + (i + 1));
  }
});

test('el dialogo esta oculto en el HTML servido, sin depender de JavaScript', () => {
  // Si dependiera del script, habria un parpadeo visible mientras carga.
  assert.match(
    HTML,
    /<div class="modal" id="modalResultado" hidden>/,
    'El atributo `hidden` tiene que venir en el HTML'
  );
  assert.ok(
    !/getElementById\(['"]modalResultado['"]\)\.hidden\s*=\s*true/.test(SCRIPT),
    'El script no debe tener que cerrarlo al arrancar'
  );
});

test('las tres variantes arrancan ocultas en el HTML', () => {
  for (const nombre of ['varianteExito', 'varianteParcial', 'varianteError']) {
    assert.match(
      HTML,
      new RegExp('id="' + nombre + '"[^>]*hidden'),
      nombre + ' debe venir oculta del servidor'
    );
  }
});

test('el dialogo no se abre solo despues de inicializar', async () => {
  const pagina = await montarPagina();
  await pagina.esperarMicrotareas();

  assert.equal(pagina.modal.hidden, true);
  assert.equal(pagina.documento.body.classList.contains('con-modal'), false);
});

// ---------------------------------------------------------------------
// Doble submit
// ---------------------------------------------------------------------

test('el primer submit valido dispara exactamente una request', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);

  assert.equal(pagina.llamadas.length, 1);
  assert.equal(pagina.llamadas[0].url, '/api/leads');
  assert.equal(pagina.llamadas[0].opciones.method, 'POST');
});

test('diez submits mientras la request esta pendiente NO disparan otra', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  for (let i = 0; i < 10; i += 1) enviar(pagina);

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
  enviar(pagina);

  assert.equal(pagina.llamadas.length, 1);
});

test('el click sobre el boton no dispara una segunda request mientras envia', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  for (let i = 0; i < 5; i += 1) {
    pagina.boton.dispatchEvent(
      new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
    );
  }

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

test('el feedback de carga aparece de inmediato, sin esperar a la red', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina); // la request queda pendiente a proposito

  assert.equal(pagina.etiqueta.textContent, 'Enviando solicitud...');
  assert.equal(pagina.boton.disabled, true);
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

// ---------------------------------------------------------------------
// Caso A: exito completo
// ---------------------------------------------------------------------

test('exito completo: se limpia el formulario y se muestra "Solicitud enviada"', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'exito');
  assert.equal(pagina.documento.getElementById('name').value, '');
  assert.equal(pagina.documento.getElementById('email').value, '');
  assert.equal(pagina.documento.getElementById('consent').checked, false);
  assert.equal(pagina.boton.disabled, false);
  assert.equal(pagina.etiqueta.textContent, 'Enviar Solicitud');

  const texto = pagina.variante('exito').textContent.replace(/\s+/g, ' ');
  assert.match(texto, /Solicitud enviada/);
  assert.match(texto, /Recibimos tu solicitud correctamente/);
  assert.match(texto, /Tu turno todavía no está confirmado/);
});

test('exito completo: NO se afirma que se haya enviado ningun correo', async () => {
  // El frontend no puede saberlo con certeza desde la respuesta: los
  // flags dicen que el envio salio, no que alguien lo haya leido.
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();

  const texto = pagina.variante('exito').textContent.toLowerCase();
  for (const promesa of ['correo', 'email', 'e-mail', 'mail', 'bandeja', 'casilla', 'leíste']) {
    assert.ok(!texto.includes(promesa), 'La confirmacion promete algo no confirmado: ' + promesa);
  }
});

test('exito completo: solo la variante de exito queda visible', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.variante('exito').hidden, false);
  assert.equal(pagina.variante('parcial').hidden, true);
  assert.equal(pagina.variante('error').hidden, true);
});

test('tras cerrar el dialogo, recargar no lo vuelve a abrir', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();
  pagina.documento.getElementById('modalCerrar').dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );
  assert.equal(pagina.modal.hidden, true);

  // Recargar = montar de nuevo. No hay estado persistido que lo reabra.
  const recargada = await montarPagina();
  assert.equal(recargada.modal.hidden, true);
  assert.equal(recargada.resultadoVisible(), null);
});

// ---------------------------------------------------------------------
// Caso B: exito parcial
// ---------------------------------------------------------------------

test('exito parcial: se muestra "Solicitud registrada", no "Solicitud enviada"', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, PARCIAL);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'parcial');
  const texto = pagina.variante('parcial').textContent.replace(/\s+/g, ' ');
  assert.match(texto, /Solicitud registrada/);
  assert.match(texto, /Recibimos tus datos correctamente/);
  assert.match(texto, /Tuvimos un inconveniente al completar las notificaciones/);
  assert.match(texto, /tu solicitud quedó registrada/);
  assert.match(texto, /Tu turno todavía no está confirmado/);
});

test('exito parcial: se dice explicitamente que NO hay que reenviar', async () => {
  // Es la regla critica: el lead ya esta guardado. Invitar a reenviar
  // generaria un duplicado.
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, PARCIAL);
  await pagina.esperarMicrotareas();

  const texto = pagina.variante('parcial').textContent.replace(/\s+/g, ' ');
  assert.match(texto, /No es necesario que vuelvas a enviar el formulario/);
  assert.ok(
    !/intent[áa] nuevamente|volv[ée] a enviar la solicitud|reintent/i.test(texto),
    'El mensaje de exito parcial no puede invitar a reenviar'
  );
});

test('exito parcial: el formulario se limpia, porque el lead ya existe', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, PARCIAL);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.documento.getElementById('name').value, '');
  assert.equal(pagina.documento.getElementById('consent').checked, false);
  assert.equal(pagina.boton.disabled, false);
});

test('exito parcial: no se reenvia nada de forma automatica', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, PARCIAL);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.llamadas.length, 1, 'Un reenvio automatico duplicaria el lead');
});

test('un 201 sin el campo de comunicacion se trata como parcial', async () => {
  // Conservador a proposito: ante la duda, el mensaje que NO invita a
  // reenviar. El lead esta registrado igual.
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, { id: 'lead-sintetico' });
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'parcial');
});

test('un 201 con cuerpo ilegible se trata como parcial, no como error', async () => {
  // El status ya confirmo que el lead quedo registrado; lo unico que se
  // pierde es saber si la comunicacion fue completa.
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responderConCuerpoIlegible(201);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'parcial');
  assert.equal(pagina.documento.getElementById('name').value, '');
});

// ---------------------------------------------------------------------
// Caso C: fallo total de registro
// ---------------------------------------------------------------------

test('error de registro: se muestra el dialogo de error y NO se limpia el formulario', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(500);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'error');
  const texto = pagina.variante('error').textContent.replace(/\s+/g, ' ');
  assert.match(texto, /No pudimos registrar tu solicitud/);
  assert.match(texto, /Intentá nuevamente en unos minutos/);

  assert.equal(pagina.documento.getElementById('name').value, 'Paciente De Prueba');
  assert.equal(pagina.documento.getElementById('email').value, 'prueba@ejemplo.test');
  assert.equal(
    pagina.documento.getElementById('message').value,
    'Mensaje sintetico de prueba'
  );
  assert.equal(pagina.documento.getElementById('consent').checked, true);
});

test('error de registro: el boton se rehabilita y se puede reintentar', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(500);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.boton.disabled, false);
  assert.equal(pagina.boton.hasAttribute('aria-busy'), false);
  assert.equal(pagina.etiqueta.textContent, 'Enviar Solicitud');

  pagina.documento.getElementById('modalCerrar').dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );
  enviar(pagina);
  assert.equal(pagina.llamadas.length, 2, 'El reintento debe poder enviarse');
});

test('un fallo de red tambien cae en el dialogo de error y conserva los datos', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.fallarRed();
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'error');
  assert.equal(pagina.documento.getElementById('name').value, 'Paciente De Prueba');
  assert.equal(pagina.boton.disabled, false);
});

test('un 429 tambien es fallo de registro y conserva los datos', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(429);
  await pagina.esperarMicrotareas();

  assert.equal(pagina.resultadoVisible(), 'error');
  assert.equal(pagina.documento.getElementById('name').value, 'Paciente De Prueba');
});

test('ningun dialogo filtra detalle tecnico', async () => {
  for (const preparar of [
    (p) => p.fallarRed('ETIMEDOUT connect 10.0.0.1:465 request_id=abc-123'),
    (p) => p.responder(500),
    (p) => p.responder(201, PARCIAL),
    (p) => p.responder(201, EXITO),
  ]) {
    const pagina = await montarPagina();
    completarFormulario(pagina.documento);
    enviar(pagina);
    preparar(pagina);
    await pagina.esperarMicrotareas();

    const texto = pagina.modal.textContent.toLowerCase();
    for (const filtracion of [
      'request_id',
      'etimedout',
      'supabase',
      'smtp',
      'nodemailer',
      'vercel',
      '10.0.0.1',
      '500',
      '429',
      'token',
    ]) {
      assert.ok(!texto.includes(filtracion), 'El dialogo muestra detalle tecnico: ' + filtracion);
    }
  }
});

// ---------------------------------------------------------------------
// Dialogo: accesibilidad y cierre
// ---------------------------------------------------------------------

test('el dialogo es accesible y toma el foco al abrirse', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();

  const caja = pagina.documento.getElementById('modalCaja');
  assert.equal(caja.getAttribute('role'), 'dialog');
  assert.equal(caja.getAttribute('aria-modal'), 'true');
  assert.equal(
    pagina.documento.activeElement,
    pagina.documento.getElementById('modalCerrar')
  );
});

test('el nombre accesible sigue a la variante que se muestra', async () => {
  for (const [cuerpo, esperado] of [
    [EXITO, 'tituloExito'],
    [PARCIAL, 'tituloParcial'],
  ]) {
    const pagina = await montarPagina();
    completarFormulario(pagina.documento);
    enviar(pagina);
    pagina.responder(201, cuerpo);
    await pagina.esperarMicrotareas();

    assert.equal(
      pagina.documento.getElementById('modalCaja').getAttribute('aria-labelledby'),
      esperado
    );
  }

  const pagina = await montarPagina();
  completarFormulario(pagina.documento);
  enviar(pagina);
  pagina.responder(500);
  await pagina.esperarMicrotareas();
  assert.equal(
    pagina.documento.getElementById('modalCaja').getAttribute('aria-labelledby'),
    'tituloError'
  );
});

test('el boton Entendido cierra el dialogo', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();

  pagina.documento.getElementById('modalCerrar').dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );

  assert.equal(pagina.modal.hidden, true);
  assert.equal(pagina.documento.body.classList.contains('con-modal'), false);
});

test('Escape cierra el dialogo en los tres resultados', async () => {
  for (const preparar of [
    (p) => p.responder(201, EXITO),
    (p) => p.responder(201, PARCIAL),
    (p) => p.responder(500),
  ]) {
    const pagina = await montarPagina();
    completarFormulario(pagina.documento);
    enviar(pagina);
    preparar(pagina);
    await pagina.esperarMicrotareas();

    pagina.documento.dispatchEvent(
      new pagina.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    assert.equal(pagina.modal.hidden, true);
  }
});

test('el foco no se escapa del dialogo con Tab', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();

  const cerrar = pagina.documento.getElementById('modalCerrar');
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

  assert.equal(evento.defaultPrevented, false, 'Sin dialogo abierto, el Tab es del navegador');
  assert.equal(pagina.documento.activeElement, nombre);
});

test('cerrar el dialogo devuelve el foco y no redirige', async () => {
  const pagina = await montarPagina();
  completarFormulario(pagina.documento);

  enviar(pagina);
  pagina.responder(201, EXITO);
  await pagina.esperarMicrotareas();
  pagina.documento.getElementById('modalCerrar').dispatchEvent(
    new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );

  assert.equal(pagina.window.location.href, 'https://ejemplo.test/', 'No debe redirigir');
  assert.notEqual(pagina.documento.activeElement, pagina.documento.body);
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
