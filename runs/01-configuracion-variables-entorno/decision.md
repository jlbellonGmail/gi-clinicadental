# Decision: 01-configuracion-variables-entorno - Configuración de variables de entorno

## Estado

MERGE aprobado por evidencias del circuito agéntico.

## Evidencias revisadas

- `runs/01-configuracion-variables-entorno/spec.md`
- `runs/01-configuracion-variables-entorno/audit-1.md`
- `runs/01-configuracion-variables-entorno/test-report-1.md`

## Decisiones demostrables

- Se documentan las 9 variables pedidas en .env.example, todas con valor vacio o placeholder evidentemente ficticio (SMTP_PORT=465, SITE_URL=http://localhost:3000), ninguna con forma de credencial real.
- gitignore: patron .env + .env.* + excepcion !.env.example, cubre .env.local y cualquier variante .env.<algo>.
- Se documenta explicitamente la diferencia de sensibilidad entre las variables NEXT_PUBLIC_* (publicas, protegidas por RLS) y SUPABASE_SERVICE_ROLE_KEY (estrictamente server-side, bypassea RLS).
- No se agrega codigo que lea estas variables ni Next.js: fuera de alcance de esta feature, declarado explicitamente en el spec.
- Verificado con git check-ignore que un archivo .env de prueba queda ignorado y .env.example queda trackeable.

## Resultado

La feature queda apta para integrarse/cerrarse cuando GitHub confirme merge contra `develop` y el cierre automatico marque `ROADMAP.md`.
