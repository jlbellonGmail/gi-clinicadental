# 11-seo-accesibilidad-y-navegacion

## Propósito
Incorporar título, descripción, favicon, etiquetas Open Graph, URL canónica y metadatos básicos para buscadores y redes sociales. Verificar navegación mediante teclado, contraste, etiquetas asociadas a campos, mensajes accesibles, foco después de errores, textos alternativos y comportamiento responsive. Incorporar una página 404 coherente con el diseño del sitio.

## Cambios implementados

### index.html
- Añadido `favicon.ico` y `apple-touch-icon` en `<head>`
- Agregado meta tags Open Graph (`og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `og:locale`, `og:site_name`)
- Agregado meta tags Twitter Cards (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
- Añadido enlace canonical `<link rel="canonical" href="https://sonrimas.com">`
- Añadido `skip-link` para navegación por teclado al inicio del `<body>`
- Mejorado `description` meta para ser más específico

### 404.html (nueva página)
- Página 404 coherente con el diseño visual del sitio (header, footer, colores, tipografía)
- Enlace de regreso al inicio con botón primario
- Estructura semántica coherente

### style.css
- Mantenedo y refinando estados `:focus-visible` para todos los elementos interactivos
- Añadido `@media (prefers-reduced-motion: reduce)` para respetar preferencias de movimiento del usuario

### script.js
- En foco de error de envío de formulario, el foco se devuelve al botón submit para permitir al usuario reintentar
- Mejoras en manejo de errores y retroalimentación al usuario

## Checklist de aceptación
- [x] Título `<title>` optimizado y único por página
- [x] `meta description` única y relevante por página
- [x] `favicon` y `apple-touch-icon` referenciados
- [x] Etiquetas Open Graph completas (title, description, url, type, image, locale, site_name)
- [x] Meta tags Twitter Cards implementados
- [x] Enlace canonical `<link rel="canonical">`
- [x] Skip link para navegación keyboard-accessible
- [x] Página 404 coherente con diseño del sitio
- [x] Contraste de color adecuado (ya existente en CSS)
- [x] Estados `:focus-visible` en todos los elementos interactivos
- [x] Navegación responsive preservada
- [x] Textos alternativos `alt` en todas las imágenes