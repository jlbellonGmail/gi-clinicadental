# Spec: 09-rediseño-estetico-y-assets

## Overview

Renovar la landing page aplicando criterios profesionales de UI/UX orientados a odontología moderna. Corregir las imágenes rotas, incorporar recursos visuales con licencia válida, convertirlos a WebP y optimizar peso, dimensiones, textos alternativos y carga diferida. Actualizar colores, tipografías, espaciados y diseño responsive sin alterar el funcionamiento del formulario.

## Acceptance Criteria

- [x] Imágenes WebP creadas y referenciadas en `index.html` con atributo `loading="lazy"`
- [x] Textos alternativos (alt text) descriptivos en todas las imágenes
- [x] 3 imágenes rotas corregidas en `index.html`:
  - Hero: `static/images/paciente-sonrisa.webp`
  - Equipo: `static/images/equipo-dental.webp`
  - Interior clínica: `static/images/interior-clinica.webp`
- [x] Paleta de colores actualizada en `style.css` (variables `--primary-light`, `--bg-light`, `--text`, `--text-muted`)
- [x] Radio de borde actualizado de 12px a 16px en `style.css`
- [x] Formulario `#leadForm` en `script.js` sin modificaciones de funcionalidad
- [x] Documentation técnica: `docs/tecnica/09-rediseño-estetico-y-assets.md`
- [x] Documentation de usuario: `docs/usuario/09-rediseño-estetico-y-assets.md`
- [x] Índice de documentación técnica actualizado en `docs/tecnica/index.md`
- [x] Índice de documentación de usuario actualizado en `docs/usuario/index.md`
- [x] `ROADMAP.md` marcado con `[-] 09-rediseño-estetico-y-assets`