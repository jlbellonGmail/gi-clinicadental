---
hide:
  - navigation
  - toc
---

# 10-actualizacion-datos-contacto

## Cómo usar esta guía
Este documento describe los datos de contacto actualizados para el sitio web de Sonríe más. Sirve para referencia del equipo de desarrollo, soporte y contenido.

## Información de contacto actualizada

### Teléfono
- **Número**: +54 9 11 4123-4567
- **Uso en sitio**: Aparece en el header (botón "Reserva Ahora" con enlace `tel:+5491141234567`) y en la sección de contacto del footer.
- **Funcionamiento**: Al hacer clic en dispositivos móviles, abre la aplicación de teléfono con el número pre-ingresado.

### WhatsApp
- **Enlace**: <https://wa.me/5491141234567>
- **Icono**: Aparece en la sección de contacto debajo del teléfono y dirección.
- **Funcionamiento**: Al hacer clic, abre WhatsApp (aplicación o web) con el número pre-ingresado para iniciar un chat.

### Correo electrónico
- **Dirección**: contacto@sonrimas.com
- **Aparece en**: Sección de contacto del sitio web.
- **Validación**: El formato es un email institucional válido para el dominio sonrimas.com.

### Dirección física
- **Dirección**: Av. Corrientes 1234, Piso 2, C1043AAE, Ciudad Autónoma de Buenos Aires
- **Enlace**: Hacer clic en la dirección del sitio abre Google Maps con la ubicación de la clínica.
- **Horarios de atención**:
  - Lunes a Viernes: 9:00 - 19:00
  - Sábado: 9:00 - 13:00
  - Domingo: Cerrado

### Redes sociales
- **Facebook**: <https://facebook.com/sonrimas>
- **Instagram**: <https://instagram.com/sonrimas>
- **TikTok**: <https://tiktok.com/@sonrimas>
- **YouTube**: <https://youtube.com/sonrimas>
- **Ubicación**: Footer de la web, sección "Síguenos". Cada ícono abre la respectiva red en una pestaña nueva del navegador.

## Cómo reportar cambios
Si los datos de contacto cambian (nuevo teléfono, dirección, horarios, o actualización de perfiles sociales), debe:
1. Actualizar este documento
2. Modificar `index.html` con los nuevos valores
3. Verificar que todos los enlaces funcionen correctamente
4. Crear un nuevo entry en `runs/<version>-<tipo>/<NN>-<slug>/` con spec, audit y decision

## Preguntas frecuentes
**¿Los enlaces de redes sociales se abren en la misma ventana?**
No, están configurados para abrir en pestaña nueva (`target="_blank"`) para no navegar fuera del sitio principal.

**¿El número de teléfono tiene costo de llamada?**
Los costos de llamada dependen de la compañía telefónica del usuario. El sitio no cobra por mostrar el número.
