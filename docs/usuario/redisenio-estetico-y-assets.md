# Rediseño estético y assets

## ¿Qué ha cambiado visualmente?

La landing page de Savia Dental ha sido renovada con criterios profesionales de UI/UX orientados a la odontología moderna:

### Imágenes optimizadas

- Todas las imágenes ahora cargan en formato WebP, que ofrece una compresión superior a PNG manteniendo la calidad visual.
- Las imágenes se cargan de forma diferida (lazy loading), lo que mejora el tiempo de carga inicial de la página.
- Las imágenes se adaptan automáticamente al ancho disponible (100% en móviles, proporción original en escritorio).

### Nueva paleta de colores

- Fondo más limpio y clínico (tono azul-verde muy suave).
- Sombras más sutiles para una apariencia más profesional.
- Mejora en el contraste del texto para una lectura más cómoda.

### Mejora en espaciado

- Mejor distribución del espacio entre secciones.
- Mayor respiración en el formulario de contacto.
- Grid más equilibrado en la sección de estadísticas.

## Cómo verla localmente

El sitio sigue siendo estático, sin cambios en la forma de ejecutarlo:

```powershell
# Opción 1: abrir directo en el navegador
start index.html

# Opción 2: servirlo por HTTP (recomendado)
python -m http.server 8000
# luego abrir http://localhost:8000/
```

## Formulario de contacto

El formulario de solicitud de consulta diagnóstico gratuita continúa funcionando igual. Los campos son:
- Nombre completo (requerido)
- Correo electrónico (requerido)
- Servicio de interés (implantes 24h, ortodoncia invisible, blanqueamiento, otros)
- Mensaje opcional
- Checkbox de consentimiento de privacidad (obligatorio)

Al enviar, el botón muestra estados de progreso y al finalizar el mensaje se reinicia. Ten en cuenta que aún no hay conexión backend real — los datos no se envían a ningún servidor (ver `ROADMAP.md` para el estado actual).