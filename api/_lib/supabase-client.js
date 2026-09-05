'use strict';

const { createClient } = require('@supabase/supabase-js');

// Cliente Supabase exclusivamente server-side (criterio 16 del spec):
// se inicializa con NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (esta ultima nunca debe llegar al frontend ni a un log). Se cachea a
// nivel de modulo para reutilizar la conexion entre invocaciones de una
// misma instancia serverless "caliente", pero nunca se expone fuera de
// este archivo.
let cachedClient = null;

/**
 * Devuelve el cliente Supabase real, creandolo una sola vez por
 * instancia del proceso. Lanza si faltan las variables de entorno
 * requeridas (el handler de api/leads.js atrapa ese error y responde
 * 500 sin filtrar el detalle, ver criterio 19 del spec).
 *
 * api/leads.js no llama a esta funcion directamente: acepta un factory
 * inyectable (criterio 23 del spec) cuyo valor por defecto es esta
 * misma funcion, de forma que los tests unitarios puedan reemplazarla
 * por un cliente falso sin conexion real a Supabase.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Supabase no esta configurado: faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

module.exports = { getSupabaseClient };
