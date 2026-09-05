# 11-seo-accesibilidad-y-navegacion

## Propósito
Este feature mejora la visibilidad del sitio en buscadores y redes sociales, y asegura que el sitio sea accesible para todos los usuarios, incluidos aquellos que navegan por teclado o usan tecnologías asistivas.

## ¿Qué incluye?

### SEO (Search Engine Optimization)
- **Título y descripción**: El sitio tiene un título `<title>` y una `meta description` claros y descriptivos que aparecen en los resultados de búsqueda.
- **Favicon**: Se muestra el ícono personalizado (`favicon.ico`) en la pestaña del navegador.
- **Etiquetas Open Graph**: El sitio incluye etiquetas `og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `og:locale` y `og:site_name` para controlar cómo se muestra el contenido al compartirse en Facebook, LinkedIn, etc.
- **Etiquetas Twitter Cards**: Meta tags `twitter:card`, `twitter:title`, `twitter:description` y `twitter:image` para optimizar la apariencia en X/Twitter.
- **URL canónica**: Se incluye `<link rel="canonical" href="https://sonrimas.com">` para evitar contenido duplicado y señalar la versión preferida del dominio.

### Accesibilidad
- **Skip link**: Un enlace "Saltar al contenido principal" está disponible en la parte superior de la página para que los usuarios de teclado puedan omitir la navegación y ir directamente al contenido principal usando la tecla `Tab`.
- **Estados de foco**: Todos los elementos interactivos (enlaces, botones, campos de formulario) tienen un borde visible y color primario cuando reciben el foco mediante teclado (`:focus-visible`).
- **Contraste**: Los colores del sitio fueron revisados para cumplir con los estándares de contraste mínimo.
- **Preferencia de movimiento reducido**: El CSS incluye `@media (prefers-reduced-motion: reduce)` para desactivar animaciones para usuarios que las tienen activadas en su sistema operativo.
- **Textos alternativos**: Todas las imágenes tienen atributos `alt` descriptivos que explican su contenido.

### Página 404
- Si el usuario intenta acceder a una URL que no existe, se muestra una página coherente con el diseño del sitio (misma cabecera, pie de página, colores y tipografía).
- La página incluye un botón para regresar al inicio.

## Cómo probar

### Verificar SEO
1. Abre el sitio en un navegador.
2. Revisa el código fuente (`Ver origen de página`) en la sección `<head>`.
3. Confirma la presencia de:
   - `<title>` descriptivo
   - `<meta name="description">`
   - `<link rel="icon">` y `<link rel="apple-touch-icon">`
   - `<meta property="og:...">` tags
   - `<meta name="twitter:..."` tags
   - `<link rel="canonical" href="...">`

### Verificar accesibilidad por teclado
1. Desconecta el mouse.
2. Presiona `Tab` para navegar por los elementos interactivos.
3. Verifica que cada elemento focado muestre un borde o estilo de enfoque visible (color primario `#0ca9a9`).
4. Prueba `Shift + Tab` para navegar en sentido inverso.
5. Presiona `Home` para ir al principio de la página y `End` para ir al final.

### Verificar página 404
1. Intenta acceder a una URL inexistente (ej. `https://tusitio.com/pagina-que-no-existe`).
2. Deberías ver la página 404 con el diseño coherente.
3. Haz clic en "Volver al inicio" y deberías regresar a la página principal.