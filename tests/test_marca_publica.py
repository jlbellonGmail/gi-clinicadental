"""Guardas de regresion de la marca publica.

Dos defectos distintos, los dos reales, dan origen a este modulo.

1. **La marca de plantilla llego a estar publicada en Production** pese a
   tres tandas de correccion, el preflight P8 y una auditoria
   independiente. El motivo: todas esas verificaciones usaron `grep`
   sobre HTML, y dos de las tres imagenes llevaban el nombre comercial
   **rasterizado dentro de los pixeles** del `.webp`, puesto ahi por
   `create_images.py`. Un `grep` no puede leer texto dentro de una
   imagen.
2. **La marca estaba mal escrita en toda la superficie publica** (v1.0.1):
   la correcta lleva i-latina con tilde en la primera palabra, y el sitio
   escribia la otra variante en el titulo, los metadatos, el header, el
   footer, los `alt` y los dos correos transaccionales.

ALCANCE DELIBERADAMENTE ACOTADO: se miran las paginas que se sirven al
visitante, la configuracion de la que salen, el generador de imagenes y
el modulo que arma los correos. **No** se mira `docs/`, `runs/` ni los
tests: ahi las variantes incorrectas se mencionan a proposito, al
explicar el defecto, y prohibirlas convertiria a este modulo en un guard
que falla cada vez que alguien documenta lo que paso.

LIMITE CONOCIDO Y DECLARADO: estos tests **no hacen OCR**. No pueden
detectar texto incrustado en una imagen agregada al repositorio por fuera
de `create_images.py`. La defensa real es la regla del generador: no se
incrusta ninguna marca dentro de las imagenes, y la marca publica vive
unicamente en el HTML/UI, donde es verificable.
"""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

# Nombre comercial de plantilla que no debe reaparecer en ninguna
# superficie publica. Se comprueba sin distinguir mayusculas.
MARCA_PROHIBIDA = "savia"

# Variantes mal escritas de la marca actual. Son formas *visibles*: se
# escriben con espacio o con `+`, nunca pegadas. Por eso este listado no
# colisiona con los identificadores tecnicos estables, que si usan
# `sonriamas` / `sonrimas` y siguen siendo validos:
# `sonriamas-contactos@nextgia.io`, `facebook.com/sonrimas`, etc.
VARIANTES_INCORRECTAS = (
    "sonríe más",
    "sonríe mas",
    "sonrie más",
    "sonrie mas",
    "sonríe+",
    "sonrie+",
    "sonria+",
    "sonría+",
)

# Paginas que se sirven al visitante.
HTML_PUBLICOS = ["index.html", "404.html", "politica-de-privacidad.html"]

# Otra superficie publica que no es HTML: los dos correos transaccionales
# los leen el paciente y la clinica.
CORREOS = ROOT / "api" / "_lib" / "mailer.js"

CONFIG = ROOT / "config" / "clinic.json"
GENERADOR = ROOT / "create_images.py"

# Llamadas de dibujo de texto dentro de una imagen: draw.text(...),
# draw2_png.text(...), etc.
PATRON_TEXTO_DIBUJADO = re.compile(r"\.text\(\s*\([^)]*\)\s*,\s*(['\"])(.*?)\1")


def marca_configurada() -> str:
    return json.loads(CONFIG.read_text(encoding="utf-8"))["brand"]["name"]


def superficies_publicas():
    """Ruta relativa -> contenido, de todo lo que ve un visitante."""
    superficies = {nombre: (ROOT / nombre) for nombre in HTML_PUBLICOS}
    superficies["api/_lib/mailer.js"] = CORREOS
    return {
        nombre: ruta.read_text(encoding="utf-8") for nombre, ruta in superficies.items()
    }


@pytest.mark.parametrize("nombre", HTML_PUBLICOS)
def test_html_publico_no_menciona_la_marca_de_plantilla(nombre):
    ruta = ROOT / nombre
    assert ruta.is_file(), f"Falta la pagina publica {nombre}"
    contenido = ruta.read_text(encoding="utf-8")
    assert MARCA_PROHIBIDA not in contenido.lower(), (
        f"{nombre} vuelve a mencionar la marca de plantilla."
    )


def test_el_html_publicado_usa_la_marca_configurada():
    """El nombre visible sale de `config/clinic.json`, no del HTML.

    Es lo que hace que instalar el sitio para otra clinica no requiera
    editar HTML. Que la marca este escrita a mano en una plantilla lo
    detecta el guard de drift del generador; lo que detecta este test es
    que la marca publicada dejo de coincidir con la configurada.
    """
    marca = marca_configurada()
    for nombre in HTML_PUBLICOS:
        contenido = (ROOT / nombre).read_text(encoding="utf-8")
        assert marca in contenido, (
            f"{nombre} no usa la marca configurada '{marca}'. "
            "La marca publica sale de config/clinic.json."
        )


def test_los_correos_toman_la_marca_de_la_configuracion():
    """En los correos la marca NO puede aparecer literal.

    `mailer.js` es codigo, no una plantilla generada: si la marca
    estuviera escrita ahi, instalar el proyecto para otra clinica dejaria
    los dos correos firmados con el nombre de la anterior. Por eso el
    guard es el inverso del anterior: se exige la interpolacion, no el
    literal.
    """
    fuente = CORREOS.read_text(encoding="utf-8")

    assert "require('./clinic.js')" in fuente, (
        "mailer.js dejo de leer la configuracion: la marca de los correos "
        "volveria a estar escrita a mano"
    )
    assert "${marca()}" in fuente, "los correos ya no interpolan la marca configurada"
    assert marca_configurada() not in fuente, (
        "mailer.js tiene la marca escrita literalmente. Los correos son "
        "superficie publica y su marca sale de config/clinic.json."
    )


def test_ninguna_superficie_publica_usa_una_variante_incorrecta():
    """Cubre el HTML servido y los dos correos transaccionales.

    No cubre `docs/` ni `runs/` a proposito: ahi las variantes se nombran
    para explicar el defecto que se corrigio.
    """
    culpables = []
    for nombre, contenido in superficies_publicas().items():
        minuscula = contenido.lower()
        for variante in VARIANTES_INCORRECTAS:
            if variante in minuscula:
                culpables.append(f"{nombre}: '{variante}'")

    assert not culpables, (
        "Variantes incorrectas de la marca en superficie publica: "
        + "; ".join(culpables)
        + ". La marca correcta es la de config/clinic.json."
    )


def test_la_configuracion_no_declara_una_variante_incorrecta():
    """Sin esto, corregir el HTML y dejar mal la config no cambiaria nada.

    El HTML se regenera desde la configuracion: si la marca esta mal ahi,
    vuelve al sitio en el proximo build.
    """
    marca = marca_configurada().lower()
    for variante in VARIANTES_INCORRECTAS:
        assert variante != marca, (
            f"config/clinic.json declara la marca como '{marca}', que es una "
            "variante incorrecta."
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

    No basta con prohibir la marca vieja: incrustar la marca nueva
    reproduciria el mismo problema, porque seguiria siendo texto invisible
    para cualquier verificacion automatica y no se podria corregir sin
    regenerar la imagen.
    """
    contenido = GENERADOR.read_text(encoding="utf-8")
    dibujados = [m.group(2) for m in PATRON_TEXTO_DIBUJADO.finditer(contenido)]

    assert dibujados, (
        "No se encontro ninguna llamada de dibujo de texto en "
        "create_images.py: el patron de deteccion quedo obsoleto y este "
        "test dejaria de proteger nada."
    )

    prohibidos = (
        "savia",
        "sonrie",
        "sonríe",
        "sonria",
        "sonría",
        "sonriamas",
        "sonrimas",
    )
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
    `runs/16-validacion-mvp-produccion/test-report-1.md`.
    """
    faltantes = []
    for nombre in HTML_PUBLICOS:
        contenido = (ROOT / nombre).read_text(encoding="utf-8")
        for ref in re.findall(r'(?:src|href)="(static/[^"]+)"', contenido):
            if not (ROOT / ref).is_file():
                faltantes.append(f"{nombre} -> {ref}")

    assert not faltantes, "Referencias a archivos inexistentes: " + ", ".join(faltantes)


def test_las_imagenes_de_la_configuracion_existen():
    """Una ruta mal escrita en la config publica una imagen rota."""
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    faltantes = [
        f"brand.images.{clave}.src -> {imagen['src']}"
        for clave, imagen in config["brand"]["images"].items()
        if not (ROOT / imagen["src"]).is_file()
    ]
    assert not faltantes, "Imagenes configuradas que no existen: " + ", ".join(faltantes)
