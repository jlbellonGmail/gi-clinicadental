"""Guardas de regresion de la marca publica.

Origen: `runs/16-validacion-mvp-produccion/test-report-2.md`.

La marca de plantilla anterior llego a estar **publicada en Production**
pese a haber pasado tres tandas de correccion, el preflight P8 y una
auditoria independiente. El motivo: todas esas verificaciones usaron
`grep` sobre HTML, y dos de las tres imagenes principales llevaban el
nombre comercial **rasterizado dentro de los pixeles** del `.webp`, puesto
ahi por `create_images.py`. Un `grep` no puede leer texto dentro de una
imagen.

Estos tests cubren las dos superficies donde el fallo era detectable:

1. El HTML publico.
2. **El generador de imagenes**, que es la fuente de verdad de lo que se
   dibuja dentro de los pixeles.

LIMITE CONOCIDO Y DECLARADO: estos tests **no hacen OCR**. No pueden
detectar texto incrustado en una imagen que se haya agregado al
repositorio por fuera de `create_images.py`. La defensa real es la regla
del generador: no se incrusta ninguna marca dentro de las imagenes, y la
marca publica vive unicamente en el HTML/UI, donde es verificable.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

# Nombre comercial de plantilla que no debe reaparecer en ninguna
# superficie publica. Se comprueba sin distinguir mayusculas.
MARCA_PROHIBIDA = "savia"

# Paginas que se sirven al visitante.
HTML_PUBLICOS = ["index.html", "404.html", "politica-privacidad.html"]

GENERADOR = ROOT / "create_images.py"

# Llamadas de dibujo de texto dentro de una imagen: draw.text(...),
# draw2_png.text(...), etc.
PATRON_TEXTO_DIBUJADO = re.compile(r"\.text\(\s*\([^)]*\)\s*,\s*(['\"])(.*?)\1")


@pytest.mark.parametrize("nombre", HTML_PUBLICOS)
def test_html_publico_no_menciona_la_marca_de_plantilla(nombre):
    ruta = ROOT / nombre
    assert ruta.is_file(), f"Falta la pagina publica {nombre}"
    contenido = ruta.read_text(encoding="utf-8")
    assert MARCA_PROHIBIDA not in contenido.lower(), (
        f"{nombre} vuelve a mencionar la marca de plantilla. "
        "La marca publica es 'Sonrie mas'."
    )


def test_el_generador_de_imagenes_no_menciona_la_marca_de_plantilla():
    contenido = GENERADOR.read_text(encoding="utf-8")
    assert MARCA_PROHIBIDA not in contenido.lower(), (
        "create_images.py vuelve a mencionar la marca de plantilla. "
        "Ese texto termina rasterizado dentro de los .webp publicados, "
        "donde ningun grep puede encontrarlo."
    )


def test_el_generador_no_incrusta_ningun_nombre_comercial_en_los_pixeles():
    """Regla dura: dentro de una imagen solo van rotulos descriptivos.

    No basta con prohibir la marca vieja: incrustar 'Sonrie mas' en los
    pixeles reproduciria el mismo problema con la marca nueva, porque
    seguiria siendo texto invisible para cualquier verificacion
    automatica y no se podria corregir sin regenerar la imagen.
    """
    contenido = GENERADOR.read_text(encoding="utf-8")
    dibujados = [m.group(2) for m in PATRON_TEXTO_DIBUJADO.finditer(contenido)]

    assert dibujados, (
        "No se encontro ninguna llamada de dibujo de texto en "
        "create_images.py: el patron de deteccion quedo obsoleto y este "
        "test dejaria de proteger nada."
    )

    prohibidos = ("savia", "sonrie", "sonrie mas", u"sonríe", "sonriamas", "sonrimas")
    for texto in dibujados:
        normalizado = texto.lower()
        for termino in prohibidos:
            assert termino not in normalizado, (
                f"create_images.py dibuja '{texto}' dentro de una imagen, "
                f"y contiene el nombre comercial '{termino}'. "
                "La marca va en el HTML/UI, nunca rasterizada en un .webp."
            )


def test_las_imagenes_referenciadas_por_el_html_existen():
    """La otra mitad del hallazgo: una imagen rota tambien es publica.

    No verifica el contenido de los pixeles, solo que el archivo exista.
    `favicon.ico` y `apple-touch-icon.png` quedan fuera a proposito: su
    ausencia es un hallazgo preexistente ya registrado en
    `runs/16-validacion-mvp-produccion/test-report-1.md`, fuera del
    alcance aprobado para esta etapa.
    """
    faltantes = []
    for nombre in HTML_PUBLICOS:
        contenido = (ROOT / nombre).read_text(encoding="utf-8")
        for ref in re.findall(r'(?:src|href)="(static/[^"]+)"', contenido):
            if not (ROOT / ref).is_file():
                faltantes.append(f"{nombre} -> {ref}")

    assert not faltantes, "Referencias a archivos inexistentes: " + ", ".join(faltantes)
