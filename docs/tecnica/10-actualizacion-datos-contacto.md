---
hide:
  - navigation
  - toc
---

# 10-actualizacion-datos-contacto

## Propósito
Reemplazar todos los placeholders por información institucional validada de Sonríe más: denominación, teléfono, WhatsApp, correo, dirección, horarios y redes sociales. Eliminar textos genéricos como `555-XXXX` y comprobar el funcionamiento de enlaces telefónicos, WhatsApp, mapas y redes sociales.

## Decisiones de diseño
- **Denominación**: Cambio de "Savia Dental" a "Sonríe más" en todo el sitio (header, footer, copyright).
- **Teléfono**: Formato internacional `+54 9 11 4123-4567` reemplazando `+123456789`.
- **WhatsApp**: Nuevo enlace `https://wa.me/5491141234567` con ícono de WhatsApp en sección de contacto.
- **Correo**: `hola@saviadental.com` → `contacto@sonrimas.com` en la sección de contacto.
- **Dirección**: `Av. Principal 123, Ciudad Dental` → `Av. Corrientes 1234, Piso 2, C1043AAE, Buenos Aires` con enlace interactivo a Google Maps.
- **Horarios**: `L a V: 9:00 - 19:00 | S: 9:00 - 13:00` añadidos en la sección de contacto.
- **Redes sociales**: Enlaces de footer actualizados desde `href="#"` a perfiles reales:
  - Facebook: `https://facebook.com/sonrimas`
  - Instagram: `https://instagram.com/sonrimas`
  - TikTok: `https://tiktok.com/@sonrimas`
  - YouTube: `https://youtube.com/sonrimas`
  - Todos con `target="_blank" rel="noopener noreferrer"`.

## Casos borde
- Etiquetas HTML con caracteres especiales (á, é, ñ) en direcciones deben mantener encoding UTF-8.
- Enlaces `tel:` y `wa.me` comportarse de forma consistente en iOS y Android.
- Íconos de redes sociales en footer deben tener mismo tamaño y alineación visual.

## Evidencia
- `runs/10-actualizacion-datos-contacto/spec.md`
- `runs/10-actualizacion-datos-contacto/audit-1.md`
- `runs/10-actualizacion-datos-contacto/decision.md`
- `index.html` modificado con todos los cambios arriba descritos.

## Riesgos
- Cambio de dominio/branding puede requerir actualizaciones en materiales fuera del sitio web (papelería, tarjetas de presentación, etc.).
- Enlaces a perfiles sociales inactivos o suspendidos requerirían mantenimiento futuro.