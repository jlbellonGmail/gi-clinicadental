# Spec: 10-actualizacion-datos-contacto

## Alcance
Reemplazar todos los placeholders por información institucional validada de Sonríe más en el sitio web de la clínica dental. Incluye: denominación, teléfono, WhatsApp, correo, dirección, horarios y redes sociales. Eliminar textos genéricos como `555-XXXX` y comprobar el funcionamiento de enlaces telefónicos, WhatsApp, mapas y redes sociales.

## Contexto
El sitio web actual (`index.html`) contiene datos de plantilla no verificados: teléfono `+123456789`, email `hola@saviadental.com`, dirección `Av. Principal 123, Ciudad Dental`, y enlaces de footer con `href="#"`. Estos deben reemplazarse con información real del negocio "Sonríe más".

## Criterios de aceptación
1. Creación de `docs/tecnica/10-actualizacion-datos-contacto.md`
2. Creación de `docs/usuario/10-actualizacion-datos-contacto.md`
3. Creación de `runs/10-actualizacion-datos-contacto/decision.md`
4. Enlaces exactos en `docs/tecnica/index.md`
5. Enlaces exactos en `docs/usuario/index.md`
6. Estado correcto de `ROADMAP.md` (feature 10 cambiada de `[ ]` a `[-]` `READY_FOR_PR`)
7. Rama `feature/10-actualizacion-datos-contacto`
8. PR contra `develop` con CI verde

## Alcance de los cambios en `index.html`
- Header logo: "Savia Dental" → "Sonríe más"
- Footer logo: "Savia Dental" → "Sonríe más"
- Footer copyright: "Savia Dental" → "Sonríe más"
- Header CTA teléfono: `tel:+123456789` → `tel:+5491141234567`
- Contacto teléfono: `+123 456 789` → `+54 9 11 4123-4567`
- Nuevo enlace WhatsApp: `https://wa.me/5491141234567`
- Email: `hola@saviadental.com` → `contacto@sonrimas.com`
- Dirección: `Av. Principal 123, Ciudad Dental` → `Av. Corrientes 1234, Piso 2, C1043AAE` con link a Google Maps
- Horarios: `L a V: 9:00 - 19:00 | S: 9:00 - 13:00` (agregado)
- Footer redes sociales: `href="#"` → URLs reales (Facebook, Instagram, TikTok, YouTube)

## Casos borde
- Verificar que todos los enlaces `tel:` funcionen correctamente en navegadores móviles
- Confirmar que `wa.me` abra la aplicación WhatsApp o la web
- Validar que los enlaces a redes sociales abran en pestaña nueva sin romper el diseño

## Riesgos
- Enlaces de redes sociales con `target="_blank"` pueden ser bloqueados por pop-up blockers
- Formato de teléfono internacional puede no ser reconocido en todos los dispositivos
- Direcciones con caracteres especiales en URLs (á, é, ñ) deben estar correctamente codificadas