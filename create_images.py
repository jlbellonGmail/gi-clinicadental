from PIL import Image, ImageDraw, ImageFont
import os

# REGLA DURA de este generador: no se incrusta NINGUNA marca dentro de los
# pixeles de las imagenes. La marca publica vive en el HTML/UI, donde se
# puede revisar, traducir y corregir con un grep. Texto rasterizado dentro
# de un .webp es invisible para cualquier verificacion automatica: la marca
# de plantilla anterior sobrevivio asi a tres tandas de correccion, al
# preflight y a una auditoria independiente, y llego a estar publicada.
# Ver runs/16-validacion-mvp-produccion/test-report-2.md.
# Solo se permiten etiquetas descriptivas del contenido (ej. "Equipo
# Dental"), nunca el nombre comercial.

os.makedirs('static/images', exist_ok=True)

# Desde la v1.0.1 `static/images/` contiene FOTOGRAFIAS REALES, no los
# marcadores de posicion que genera este script. Correrlo sin esta guarda
# las sobrescribiria con rectangulos de color, y no hay forma de
# recuperarlas desde el repositorio si el cambio se commitea.
#
# El script se conserva porque documenta la regla dura de arriba y porque
# `tests/test_marca_publica.py` la verifica sobre este archivo.
FORZAR = os.environ.get('CREATE_IMAGES_FORCE') == '1'
existentes = [
    nombre
    for nombre in os.listdir('static/images')
    if nombre.endswith(('.webp', '.png'))
]
if existentes and not FORZAR:
    raise SystemExit(
        'static/images/ ya tiene imagenes (%s).\n'
        'Este script genera marcadores de posicion y las pisaria.\n'
        'Si de verdad es lo que queres: CREATE_IMAGES_FORCE=1 python create_images.py'
        % ', '.join(sorted(existentes))
    )

font = None
try:
    font = ImageFont.truetype('arial.ttf', 24)
except:
    font = ImageFont.load_default()

# 1. Happy patient smile (hero section) - 800x600
img1 = Image.new('RGB', (800, 600), color='#0ca9a9')
draw = ImageDraw.Draw(img1)
for i in range(20):
    x = 100 + i * 35
    y = 300 + int(50 * (1 + (i % 2) * -2))
    draw.ellipse([x, y, x+40, y+40], fill='#ffffff' if i % 2 == 0 else '#f0f0f0')
draw.text((100, 100), 'Sonrisa', fill='#ffffff', font=font)
draw.text((100, 150), 'Perfecta', fill='#ffffff', font=font)
img1.save('static/images/paciente-sonrisa.webp', 'WebP', quality=85)
print('Image 1 created: paciente-sonrisa')

# 2. Friendly dentist team (team section) - 800x600
img2 = Image.new('RGB', (800, 600), color='#1a1a1a')
draw2 = ImageDraw.Draw(img2)
for i in range(15):
    x = 100 + i * 45
    y = 200 + int(30 * (1 + (i % 2) * -2))
    draw2.ellipse([x, y, x+35, y+35], fill='#0ca9a9' if i % 2 == 0 else '#10c9c9')
draw2.text((100, 50), 'Equipo Dental', fill='#ffffff', font=font)
img2.save('static/images/equipo-dental.webp', 'WebP', quality=85)
print('Image 2 created: equipo-dental')

# 3. Dental clinic interior (contact section) - 800x600
img3 = Image.new('RGB', (800, 600), color='#f8fbfa')
draw3 = ImageDraw.Draw(img3)
draw3.rectangle([300, 150, 500, 450], fill='#0ca9a9', width=2)
draw3.rectangle([350, 200, 450, 350], fill='#ffffff')
draw3.text((100, 50), 'Interior Clínica', fill='#0ca9a9', font=font)
img3.save('static/images/interior-clinica.webp', 'WebP', quality=85)
print('Image 3 created: interior-clinica')

print('All images created successfully')
