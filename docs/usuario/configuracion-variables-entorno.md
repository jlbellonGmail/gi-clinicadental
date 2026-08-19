# Configuración de variables de entorno — documentación de usuario

Guía rápida para configurar tu entorno local antes de trabajar en el
backend de captación de leads.

## Pasos

1. Copiá `.env.example` a `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Completá cada variable en `.env.local` con valores reales — **nunca
   los pongas en `.env.example`, en un commit, ni se los pegues a un
   agente/chat**. Los valores reales de producción/preview viven
   exclusivamente en Vercel:

   - Vercel → tu proyecto → **Settings → Environment Variables**.
   - Ahí están `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, las claves de
     Supabase, etc., ya rotadas y vigentes (ver
     `docs/tecnica/configuracion-variables-entorno.md` para el detalle
     de cada una).

3. `.env.local` queda ignorado por Git automáticamente — no hace falta
   hacer nada más para que no se suba al repositorio.

## Si te falta un valor

Pedile acceso al panel de Vercel del proyecto a quien lo administra. No
hay ninguna copia de las credenciales reales en este repositorio, en su
historial, en la documentación ni en ningún otro lugar — es intencional
(ver `AGENTS.md`, ítem `00-aprovisionamiento-entorno-vercel`).
