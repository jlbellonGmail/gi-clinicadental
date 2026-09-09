'use strict';

// Tests del dialogo de la politica de privacidad (v1.0.1).
//
// El requisito que originan: con el formulario a medio completar, tocar
// "Politica de privacidad" no puede sacar al visitante del formulario ni
// hacerle perder lo escrito.
//
// La forma de garantizarlo NO es guardar y restaurar los valores: es no
// navegar. Por eso el test central no comprueba que los datos "se
// restauren", sino que **nunca se pierden**, y ademas que no exista
// ningun `localStorage` de por medio.
//
// LIMITE DECLARADO: jsdom no pinta. Que la caja tenga scroll interno y
// entre en un viewport de 320 px lo vigila `tests/test_dialogo_resultado.py`
// sobre el CSS, no este archivo.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RAIZ = __dirname;
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const SCRIPT = fs.readFileSync(path.join(RAIZ, 'script.js'), 'utf8');

const DATOS = {
  name: 'Prueba Sintetica QA',
  email: 'prueba-sintetica@ejemplo.test',
  message: 'Mensaje de prueba escrito antes de abrir la politica.',
};

async function montarPagina() {
  const dom = new JSDOM(HTML, {
    runScripts: 'outside-only',
    url: 'https://ejemplo.test/',
  });
  const { window } = dom;
  const documento = window.document;

  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Se registra cada llamada para poder afirmar que la posicion de
  // scroll se restaura, en vez de suponerlo.
  const scrolls = [];
  window.scrollTo = (x, y) => {
    scrolls.push([x, y]);
  };

  const listo = new Promise((resolve) => {
    window.document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });
  window.eval(SCRIPT);
  await listo;

  return { dom, window, documento, scrolls };
}

function completarFormulario(documento) {
  documento.getElementById('name').value = DATOS.name;
  documento.getElementById('email').value = DATOS.email;
  documento.getElementById('message').value = DATOS.message;
  documento.getElementById('consent').checked = true;
  documento.getElementById('service').value = 'ortodoncia';
}

function valoresDelFormulario(documento) {
  return {
    name: documento.getElementById('name').value,
    email: documento.getElementById('email').value,
    message: documento.getElementById('message').value,
    service: documento.getElementById('service').value,
    consent: documento.getElementById('consent').checked,
  };
}

function clickReal(window, elemento, opciones = {}) {
  const evento = new window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    ...opciones,
  });
  elemento.dispatchEvent(evento);
  return evento;
}

function tecla(window, documento, key, opciones = {}) {
  documento.dispatchEvent(
    new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opciones })
  );
}

function enlacesDePolitica(documento) {
  return Array.from(documento.querySelectorAll('a[data-abrir-politica]'));
}

test('el dialogo de la politica arranca cerrado', async () => {
  const { documento } = await montarPagina();
  const modal = documento.getElementById('modalPolitica');

  assert.ok(modal, 'falta el dialogo de la politica');
  assert.equal(modal.hidden, true);
  assert.equal(documento.body.classList.contains('con-modal'), false);
});

test('hay al menos un enlace que abre la politica desde el formulario', async () => {
  const { documento } = await montarPagina();
  const enlaces = enlacesDePolitica(documento);

  assert.ok(enlaces.length >= 1, 'ningun enlace abre el dialogo');
  for (const enlace of enlaces) {
    assert.equal(
      enlace.getAttribute('href'),
      '/politica-de-privacidad',
      'el enlace tiene que conservar su destino real: sin JavaScript debe navegar a la pagina completa'
    );
  }
});

test('abrir la politica NO navega y NO recarga', async () => {
  const { window, documento } = await montarPagina();
  const enlace = enlacesDePolitica(documento)[0];

  const evento = clickReal(window, enlace);

  assert.equal(
    evento.defaultPrevented,
    true,
    'si no se cancela la navegacion, el navegador abandona el formulario'
  );
  assert.equal(documento.getElementById('modalPolitica').hidden, false);
});

test('el formulario conserva TODO lo escrito al abrir y cerrar la politica', async () => {
  const { window, documento } = await montarPagina();
  completarFormulario(documento);
  const antes = valoresDelFormulario(documento);

  clickReal(window, enlacesDePolitica(documento)[0]);
  assert.deepEqual(valoresDelFormulario(documento), antes, 'se perdieron datos al abrir');

  clickReal(window, documento.getElementById('politicaVolver'));
  assert.deepEqual(valoresDelFormulario(documento), antes, 'se perdieron datos al cerrar');
});

test('el foco vuelve al control exacto que abrio el dialogo', async () => {
  const { window, documento } = await montarPagina();
  const enlaces = enlacesDePolitica(documento);
  // Se prueba con el ultimo enlace, no con el primero: si el codigo
  // devolviera el foco a un elemento fijo, con el primero pasaria igual.
  const enlace = enlaces[enlaces.length - 1];

  enlace.focus();
  clickReal(window, enlace);

  assert.equal(
    documento.activeElement,
    documento.getElementById('politicaCerrarX'),
    'al abrir, el foco tiene que entrar al dialogo'
  );

  tecla(window, documento, 'Escape');

  assert.equal(documento.activeElement, enlace, 'el foco no volvio al enlace que lo abrio');
});

test('Escape, la X y "Volver al formulario" cierran', async () => {
  for (const cerrarCon of ['escape', 'politicaCerrarX', 'politicaVolver']) {
    const { window, documento } = await montarPagina();
    const modal = documento.getElementById('modalPolitica');

    clickReal(window, enlacesDePolitica(documento)[0]);
    assert.equal(modal.hidden, false, 'no se abrio');

    if (cerrarCon === 'escape') {
      tecla(window, documento, 'Escape');
    } else {
      clickReal(window, documento.getElementById(cerrarCon));
    }

    assert.equal(modal.hidden, true, `no cerro con ${cerrarCon}`);
    assert.equal(documento.body.classList.contains('con-modal'), false);
  }
});

test('el fondo tambien cierra, y bloquea el scroll mientras esta abierto', async () => {
  const { window, documento } = await montarPagina();
  const modal = documento.getElementById('modalPolitica');

  clickReal(window, enlacesDePolitica(documento)[0]);
  assert.equal(documento.body.classList.contains('con-modal'), true);

  clickReal(window, modal.querySelector('.modal__fondo'));
  assert.equal(modal.hidden, true);
});

test('la posicion de scroll se restaura al cerrar', async () => {
  const { window, documento, scrolls } = await montarPagina();
  // El formulario esta al final de la pagina: se simula haber llegado
  // scrolleando hasta ahi.
  Object.defineProperty(window, 'scrollY', { value: 1234, configurable: true });

  clickReal(window, enlacesDePolitica(documento)[0]);
  tecla(window, documento, 'Escape');

  assert.deepEqual(
    scrolls[scrolls.length - 1],
    [0, 1234],
    'al cerrar hay que volver a la posicion en la que estaba el visitante'
  );
});

test('el foco no se escapa del dialogo con Tab', async () => {
  const { window, documento } = await montarPagina();
  const modal = documento.getElementById('modalPolitica');
  clickReal(window, enlacesDePolitica(documento)[0]);

  const caja = modal.querySelector('.modal__caja');
  const enfocables = Array.from(
    caja.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  );
  assert.ok(enfocables.length >= 2, 'el dialogo necesita mas de un elemento enfocable');

  enfocables[enfocables.length - 1].focus();
  tecla(window, documento, 'Tab');
  assert.equal(documento.activeElement, enfocables[0], 'el Tab se escapo por el final');

  enfocables[0].focus();
  tecla(window, documento, 'Tab', { shiftKey: true });
  assert.equal(
    documento.activeElement,
    enfocables[enfocables.length - 1],
    'el Shift+Tab se escapo por el principio'
  );
});

test('con Ctrl o Cmd el enlace sigue abriendo la pagina completa', async () => {
  const { window, documento } = await montarPagina();

  const evento = clickReal(window, enlacesDePolitica(documento)[0], { ctrlKey: true });

  assert.equal(
    evento.defaultPrevented,
    false,
    'si el visitante pide otra pestaña a proposito, hay que dejarlo'
  );
  assert.equal(documento.getElementById('modalPolitica').hidden, true);
});

test('el dialogo es accesible: role, aria-modal y nombre', async () => {
  const { documento } = await montarPagina();
  const caja = documento.getElementById('modalPoliticaCaja');

  assert.equal(caja.getAttribute('role'), 'dialog');
  assert.equal(caja.getAttribute('aria-modal'), 'true');

  const etiqueta = caja.getAttribute('aria-labelledby');
  const titulo = documento.getElementById(etiqueta);
  assert.ok(titulo, 'el `aria-labelledby` apunta a un elemento inexistente');
  assert.match(titulo.textContent, /Pol[ií]tica de Privacidad/i);

  const cerrar = documento.getElementById('politicaCerrarX');
  assert.ok(
    (cerrar.getAttribute('aria-label') || '').trim().length > 0,
    'el boton de cerrar es solo un icono: necesita nombre accesible'
  );
});

test('el dialogo contiene la politica completa, no un resumen', async () => {
  const { documento } = await montarPagina();
  const cuerpo = documento.getElementById('politicaCuerpo');
  const texto = cuerpo.textContent;

  for (const seccion of [
    'Finalidad',
    'Datos almacenados',
    'Responsable del tratamiento',
    'Destinatarios',
    'Plazo de conservación',
  ]) {
    assert.ok(texto.includes(seccion), `el dialogo no incluye la seccion "${seccion}"`);
  }

  // La pagina independiente sigue siendo la direccion canonica y tiene
  // que seguir alcanzable desde el propio dialogo.
  const aLaPagina = cuerpo.querySelector('a[href="/politica-de-privacidad"]');
  assert.ok(aLaPagina, 'el dialogo no enlaza la pagina completa');
});

test('la capa 1 avisa junto al envio, no solo en el pie', async () => {
  const { documento } = await montarPagina();
  const aviso = documento.getElementById('avisoPrivacidad');

  assert.ok(aviso, 'falta el aviso breve de privacidad');
  assert.ok(
    documento.getElementById('leadForm').contains(aviso),
    'el aviso tiene que estar dentro del formulario'
  );
  assert.match(aviso.textContent, /datos/i);
  assert.ok(aviso.querySelector('a[data-abrir-politica]'), 'el aviso tiene que enlazar la politica');
});

/**
 * `script.js` sin comentarios.
 *
 * El guard de abajo mira si el codigo usa almacenamiento del navegador, y
 * la primera version fallaba con su propio comentario -el que explica
 * justamente que no hay que agregar `localStorage`-. Un guard que se
 * dispara con la prosa que lo documenta no esta comprobando la causa.
 *
 * El `//` se ignora cuando viene despues de `:` para no cortar una URL
 * dentro de una cadena.
 */
function codigoSinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('no se persiste nada del formulario para sostener el dialogo', async () => {
  // El requisito es explicito: nombre, correo, telefono y mensaje no se
  // guardan en almacenamiento del navegador solo para esto. Se comprueba
  // sobre el codigo fuente porque la ausencia de una llamada no se puede
  // observar ejecutando.
  const codigo = codigoSinComentarios(SCRIPT);

  // Verificacion en negativo del propio guard: si el stripper dejara de
  // funcionar, este test pasaria por vacio.
  assert.ok(codigo.includes('crearDialogo'), 'el stripper de comentarios borro codigo real');

  const usos = codigo.match(/localStorage|sessionStorage/g) || [];
  assert.deepEqual(
    usos,
    [],
    'script.js usa almacenamiento del navegador: los datos del formulario no se persisten'
  );
});

test('el dialogo de resultado sigue funcionando y no se cruza con el de la politica', async () => {
  const { window, documento } = await montarPagina();

  clickReal(window, enlacesDePolitica(documento)[0]);
  assert.equal(documento.getElementById('modalPolitica').hidden, false);
  assert.equal(
    documento.getElementById('modalResultado').hidden,
    true,
    'abrir la politica no puede abrir el dialogo de resultado'
  );

  tecla(window, documento, 'Escape');
  assert.equal(documento.getElementById('modalPolitica').hidden, true);
  assert.equal(documento.getElementById('modalResultado').hidden, true);
});
