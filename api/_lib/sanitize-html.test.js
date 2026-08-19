'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { escapeHtml } = require('./sanitize-html');

test('escapa una etiqueta <script> completa', () => {
  const input = '<script>alert(1)</script>';
  const output = escapeHtml(input);

  assert.equal(output, '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
  assert.ok(!output.includes('<'), 'no debe quedar ningun "<" sin escapar');
  assert.ok(!output.includes('>'), 'no debe quedar ningun ">" sin escapar');
});

test('escapa comillas dobles y simples', () => {
  const input = `Decía "hola" y también 'adiós'`;
  const output = escapeHtml(input);

  assert.equal(output, 'Decía &quot;hola&quot; y también &#39;adiós&#39;');
});

test('escapa el ampersand', () => {
  assert.equal(escapeHtml('Implantes & Ortodoncia'), 'Implantes &amp; Ortodoncia');
});

test('escapa la barra (/) para prevenir cierres de etiqueta anticipados', () => {
  assert.equal(escapeHtml('</textarea>'), '&lt;&#x2F;textarea&gt;');
});

test('no modifica texto sin caracteres especiales', () => {
  assert.equal(escapeHtml('Consulta por turno de ortodoncia'), 'Consulta por turno de ortodoncia');
});

test('no rompe con string vacio', () => {
  assert.equal(escapeHtml(''), '');
});

test('preserva Unicode/emoji sin alterarlo', () => {
  assert.equal(escapeHtml('Hola 👋 ñandú café'), 'Hola 👋 ñandú café');
});

test('devuelve valores no-string tal cual, sin lanzar', () => {
  assert.equal(escapeHtml(42), 42);
  assert.equal(escapeHtml(null), null);
  assert.equal(escapeHtml(undefined), undefined);
  const obj = { a: 1 };
  assert.equal(escapeHtml(obj), obj);
});

test('combinacion de todos los caracteres neutralizados a la vez', () => {
  const input = `<a href="/x?y='z'&w=1">link</a>`;
  const output = escapeHtml(input);

  assert.equal(
    output,
    '&lt;a href=&quot;&#x2F;x?y=&#39;z&#39;&amp;w=1&quot;&gt;link&lt;&#x2F;a&gt;'
  );
});
