'use strict';

// Utilidad de escape HTML reutilizable (criterio 22 de
// runs/03-endpoint-recepcion-leads/spec.md). Pensada para que las
// features 05/06 (Nodemailer) la usen al construir el HTML de los
// correos de notificacion/confirmacion. Esta feature NO la invoca desde
// ningun flujo de envio de email todavia: ese flujo no existe en el
// repo hasta las features 05/06.

// Orden del mapa: '&' primero es imprescindible (si se escapara despues
// de '<'/'>' se volveria a escapar el '&' que esos reemplazos insertan).
// Usamos una unica pasada con regexp + funcion de reemplazo, asi que el
// orden del objeto no afecta el resultado, pero se documenta igual por
// claridad.
const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

const ESCAPE_PATTERN = /[&<>"'/]/g;

/**
 * Neutraliza los caracteres `& < > " ' /` de un string para que pueda
 * incorporarse de forma segura dentro de HTML (ej. el cuerpo de un
 * email transaccional).
 *
 * Valores que no son `string` se devuelven tal cual (no se fuerza una
 * conversion a texto ni se lanza una excepcion): quien llama a esta
 * funcion decide como tratar valores `null`/`undefined`/numericos.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function escapeHtml(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(ESCAPE_PATTERN, (char) => ESCAPE_MAP[char]);
}

module.exports = { escapeHtml };
