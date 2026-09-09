# -*- coding: utf-8 -*-
"""Genera los iconos de marca del sitio desde `config/clinic.json`.

    python scripts/build-branding-icons.py

Produce:

    favicon.ico            16, 32 y 48 px en un solo archivo
    apple-touch-icon.png   180 x 180
    docs/assets/favicon.ico   el mismo icono para el sitio de documentacion

POR QUE ES UN SCRIPT Y NO UN ARCHIVO SUELTO
El logo del sitio es `<i class="fas fa-tooth">`, un glifo de Font Awesome
que se resuelve **en el navegador**. Un favicon no puede depender de eso:
es un archivo estatico que pide el navegador antes de ejecutar nada, y
tiene que existir. Este script dibuja el isotipo con Pillow, sin fuentes
de iconos ni dependencias nuevas.

POR QUE FONDO DE COLOR Y DIENTE EN BLANCO
En el header el diente va en teal sobre blanco, pero a 16 px un trazo
delgado sobre fondo claro se pierde entre las pestanas. La forma
reconocible a ese tamano es una silueta solida sobre un fondo de marca.

COMO LO CAMBIA OTRA CLINICA
Dos caminos, ninguno toca HTML, CSS ni JavaScript:

1. Dejar sus propios archivos y apuntar `brand.favicon` y
   `brand.appleTouchIcon` de `config/clinic.json` a ellos.
2. Cambiar `brand.iconColors` y volver a correr este script.

Tamanos y formatos recomendados, en
`docs/usuario/identidad-privacidad-white-label.md`.
"""

import json
import os
import sys

from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(RAIZ, 'config', 'clinic.json')

# Se dibuja grande y se reduce con LANCZOS: Pillow no antialiasa los
# poligonos, y a 16 px un borde escalonado se nota muchisimo.
LIENZO = 1024

TAMANOS_ICO = [16, 32, 48]
TAMANO_APPLE = 180


def cargar_colores():
    with open(CONFIG, encoding='utf-8') as fh:
        config = json.load(fh)
    colores = config['brand']['iconColors']
    return colores['background'], colores['foreground']


def dibujar_diente(draw, ancho, alto, color):
    """Isotipo dental: corona ancha redondeada y dos raices que se afinan.

    Las medidas son fracciones del lienzo, no pixeles: el mismo trazo
    sirve para 16 px y para 180.
    """
    cx = ancho / 2

    # Corona: dos lobulos que se solapan, que es lo que le da la silueta
    # de muela y no de circulo.
    radio = ancho * 0.250
    centro_y = alto * 0.365
    for desplazamiento in (-ancho * 0.135, ancho * 0.135):
        draw.ellipse(
            [cx + desplazamiento - radio, centro_y - radio,
             cx + desplazamiento + radio, centro_y + radio],
            fill=color,
        )
    # Cuerpo que une los lobulos con las raices.
    draw.polygon(
        [
            (cx - ancho * 0.315, centro_y),
            (cx + ancho * 0.315, centro_y),
            (cx + ancho * 0.245, alto * 0.56),
            (cx - ancho * 0.245, alto * 0.56),
        ],
        fill=color,
    )

    # Raices: dos puntas separadas por una muesca central.
    draw.polygon(
        [
            (cx - ancho * 0.250, alto * 0.50),
            (cx - ancho * 0.070, alto * 0.50),
            (cx - ancho * 0.085, alto * 0.905),
            (cx - ancho * 0.180, alto * 0.905),
        ],
        fill=color,
    )
    draw.polygon(
        [
            (cx + ancho * 0.070, alto * 0.50),
            (cx + ancho * 0.250, alto * 0.50),
            (cx + ancho * 0.180, alto * 0.905),
            (cx + ancho * 0.085, alto * 0.905),
        ],
        fill=color,
    )
    # Puntas redondeadas: una raiz en punta seca se ve tosca al reducir.
    for desplazamiento in (-ancho * 0.1325, ancho * 0.1325):
        r = ancho * 0.0475
        draw.ellipse(
            [cx + desplazamiento - r, alto * 0.905 - r,
             cx + desplazamiento + r, alto * 0.905 + r],
            fill=color,
        )


def componer(fondo, frente):
    """Icono cuadrado: fondo de marca redondeado y diente centrado."""
    lienzo = Image.new('RGBA', (LIENZO, LIENZO), (0, 0, 0, 0))
    draw = ImageDraw.Draw(lienzo)

    # Esquinas redondeadas al 22 %, la proporcion que usan los iconos de
    # aplicacion; queda bien tanto recortado en circulo como cuadrado.
    draw.rounded_rectangle(
        [0, 0, LIENZO - 1, LIENZO - 1],
        radius=int(LIENZO * 0.22),
        fill=fondo,
    )

    # El diente ocupa el 62 % del lienzo: deja aire suficiente para que
    # iOS pueda recortar en circulo sin comerse la silueta.
    lado = int(LIENZO * 0.62)
    capa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    dibujar_diente(ImageDraw.Draw(capa), lado, lado, frente)
    lienzo.alpha_composite(capa, ((LIENZO - lado) // 2, (LIENZO - lado) // 2))

    return lienzo


def main():
    fondo, frente = cargar_colores()
    icono = componer(fondo, frente)

    salidas = []

    ruta_ico = os.path.join(RAIZ, 'favicon.ico')
    icono.resize((256, 256), Image.LANCZOS).save(
        ruta_ico, format='ICO', sizes=[(s, s) for s in TAMANOS_ICO]
    )
    salidas.append(ruta_ico)

    ruta_apple = os.path.join(RAIZ, 'apple-touch-icon.png')
    # Sin transparencia: iOS compone sobre negro y las esquinas
    # redondeadas quedarian con un halo oscuro.
    apple = Image.new('RGB', (TAMANO_APPLE, TAMANO_APPLE), fondo)
    apple.paste(icono.resize((TAMANO_APPLE, TAMANO_APPLE), Image.LANCZOS), (0, 0), icono.resize((TAMANO_APPLE, TAMANO_APPLE), Image.LANCZOS))
    apple.save(ruta_apple, format='PNG', optimize=True)
    salidas.append(ruta_apple)

    # El sitio de documentacion tambien declara un favicon en mkdocs.yml.
    ruta_docs = os.path.join(RAIZ, 'docs', 'assets', 'favicon.ico')
    os.makedirs(os.path.dirname(ruta_docs), exist_ok=True)
    icono.resize((256, 256), Image.LANCZOS).save(
        ruta_docs, format='ICO', sizes=[(s, s) for s in TAMANOS_ICO]
    )
    salidas.append(ruta_docs)

    for ruta in salidas:
        print('  > %s (%.1f KB)' % (
            os.path.relpath(ruta, RAIZ).replace('\\', '/'),
            os.path.getsize(ruta) / 1024,
        ))

    # Vista previa opcional, para revisar el trazo sin abrir el .ico.
    if '--preview' in sys.argv:
        previa = os.path.join(RAIZ, 'favicon-preview.png')
        tira = Image.new('RGB', (16 + 32 + 48 + 180 + 50, 180), (255, 255, 255))
        x = 0
        for lado in (16, 32, 48, 180):
            tira.paste(icono.resize((lado, lado), Image.LANCZOS),
                       (x, (180 - lado) // 2), icono.resize((lado, lado), Image.LANCZOS))
            x += lado + 10
        tira.save(previa)
        print('  > %s (vista previa, no se commitea)' % os.path.basename(previa))


if __name__ == '__main__':
    main()
