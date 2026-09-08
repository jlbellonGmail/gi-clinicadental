"""Ningún recurso de marca referenciado puede faltar.

El `<head>` de las tres páginas declaraba `favicon.ico` y
`apple-touch-icon.png`, y **ninguno de los dos archivos existía**. Eran
cinco referencias rotas servidas en cada visita: el navegador pedía los
dos archivos y recibía 404. Nadie lo detectó porque una referencia rota a
un icono no rompe nada visible — simplemente no hay icono.

Estos guards cubren las dos mitades del problema:

1. Que los archivos que la configuración declara **existan**.
2. Que el HTML publicado **apunte a los que la configuración declara**, y
   no a rutas escritas a mano que la configuración ya no controla.

Y una tercera, más amplia: que ninguna referencia local del HTML público
apunte a un archivo inexistente, sea de marca o no.
"""

import json
import re
import struct
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

CONFIG = ROOT / "config" / "clinic.json"
MKDOCS = ROOT / "mkdocs.yml"
GENERADOR_ICONOS = ROOT / "scripts" / "build-branding-icons.py"

HTML_PUBLICOS = ["index.html", "404.html", "politica-de-privacidad.html"]


def config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def marca() -> dict:
    return config()["brand"]


def test_el_favicon_configurado_existe():
    ruta = ROOT / marca()["favicon"]
    assert ruta.is_file(), (
        f"`brand.favicon` apunta a '{marca()['favicon']}' y ese archivo no existe. "
        "Cada visita pide ese recurso y recibe un 404."
    )
    assert ruta.stat().st_size > 0, "el favicon existe pero está vacío"


def test_el_apple_touch_icon_configurado_existe():
    ruta = ROOT / marca()["appleTouchIcon"]
    assert ruta.is_file(), (
        f"`brand.appleTouchIcon` apunta a '{marca()['appleTouchIcon']}' y no existe."
    )
    assert ruta.stat().st_size > 0, "el apple-touch-icon existe pero está vacío"


def test_el_favicon_trae_los_tamanos_que_usa_un_navegador():
    """Un `.ico` de un solo tamaño se ve borroso en la pestaña.

    Se lee la cabecera del ICO directamente: no hace falta Pillow, y así
    el guard comprueba el archivo publicado, no lo que dice el generador.
    """
    datos = (ROOT / marca()["favicon"]).read_bytes()
    if not marca()["favicon"].lower().endswith(".ico"):
        pytest.skip("el favicon configurado no es un .ico")

    reservado, tipo, cantidad = struct.unpack("<HHH", datos[:6])
    assert reservado == 0 and tipo == 1, "no tiene cabecera de ICO válida"
    assert cantidad >= 2, (
        f"el .ico trae {cantidad} tamaño(s); con uno solo el navegador lo escala y se ve borroso"
    )

    tamanos = set()
    for i in range(cantidad):
        ancho, alto = datos[6 + i * 16], datos[7 + i * 16]
        tamanos.add((ancho or 256, alto or 256))
    assert (16, 16) in tamanos, f"falta el tamaño 16x16, que es el de la pestaña. Hay: {sorted(tamanos)}"
    assert (32, 32) in tamanos, f"falta el tamaño 32x32. Hay: {sorted(tamanos)}"


def test_el_apple_touch_icon_es_cuadrado_y_del_tamano_correcto():
    """iOS espera 180 x 180; otra medida se escala y se ve mal."""
    datos = (ROOT / marca()["appleTouchIcon"]).read_bytes()
    assert datos[:8] == b"\x89PNG\r\n\x1a\n", "el apple-touch-icon debería ser un PNG"
    ancho, alto = struct.unpack(">II", datos[16:24])
    assert ancho == alto, f"tiene que ser cuadrado, es {ancho}x{alto}"
    assert ancho >= 180, f"iOS usa 180x180; este mide {ancho}x{alto}"


@pytest.mark.parametrize("pagina", HTML_PUBLICOS)
def test_cada_pagina_declara_los_iconos_de_la_configuracion(pagina):
    """El HTML tiene que apuntar a lo que dice la configuración.

    Si alguien vuelve a escribir la ruta a mano en una plantilla, la
    configuración deja de mandar y reemplazar el icono para otra clínica
    exige tocar HTML otra vez.
    """
    html = (ROOT / pagina).read_text(encoding="utf-8")
    b = marca()

    icono = re.search(r'<link rel="icon"[^>]*href="([^"]+)"', html)
    assert icono, f"{pagina} no declara favicon"
    assert icono.group(1) == b["favicon"], (
        f"{pagina} apunta a '{icono.group(1)}' y la configuración declara '{b['favicon']}'"
    )

    apple = re.search(r'<link rel="apple-touch-icon"[^>]*href="([^"]+)"', html)
    assert apple, f"{pagina} no declara apple-touch-icon"
    assert apple.group(1) == b["appleTouchIcon"], (
        f"{pagina} apunta a '{apple.group(1)}' y la configuración declara '{b['appleTouchIcon']}'"
    )


def test_el_tipo_declarado_del_favicon_coincide_con_su_extension():
    """Estaba fijo en `image/x-icon` en las tres plantillas.

    Con la ruta saliendo de configuración eso era una trampa: una clínica
    que pusiera un `.png` quedaba con el tipo equivocado declarado y sin
    forma de corregirlo sin tocar HTML.
    """
    esperados = {
        ".ico": "image/x-icon",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
    }
    extension = Path(marca()["favicon"]).suffix.lower()
    esperado = esperados.get(extension)
    assert esperado, f"extensión de favicon no contemplada: {extension}"

    for pagina in HTML_PUBLICOS:
        html = (ROOT / pagina).read_text(encoding="utf-8")
        declarado = re.search(r'<link rel="icon"[^>]*type="([^"]+)"', html)
        assert declarado, f"{pagina} no declara el tipo del favicon"
        assert declarado.group(1) == esperado, (
            f"{pagina} declara '{declarado.group(1)}' para un favicon {extension}"
        )


@pytest.mark.parametrize("pagina", HTML_PUBLICOS)
def test_ninguna_referencia_local_del_html_apunta_a_un_archivo_inexistente(pagina):
    """El guard general, del que los anteriores son casos concretos.

    Se ignoran las URLs absolutas —Font Awesome viene de un CDN—, los
    anclas y los `mailto:`/`tel:`, que no son archivos.
    """
    html = (ROOT / pagina).read_text(encoding="utf-8")
    referencias = re.findall(r'(?:src|href)="([^"]+)"', html)

    faltantes = []
    for ref in referencias:
        if re.match(r"^(https?:|mailto:|tel:|#|data:)", ref):
            continue
        destino = ROOT / ref.split("?")[0].split("#")[0]
        if not destino.is_file():
            faltantes.append(ref)

    assert not faltantes, (
        f"{pagina} referencia archivos que no existen: " + ", ".join(sorted(set(faltantes)))
    )


def test_el_favicon_de_la_documentacion_tambien_existe():
    """`mkdocs.yml` declara el suyo, y también faltaba.

    `mkdocs build --strict` no lo detecta: un favicon ausente no es un
    error de construcción, solo un 404 en el sitio publicado.
    """
    contenido = MKDOCS.read_text(encoding="utf-8")
    declarado = re.search(r"(?m)^\s*favicon:\s*(\S+)\s*$", contenido)
    assert declarado, "mkdocs.yml ya no declara favicon"

    ruta = ROOT / "docs" / declarado.group(1)
    assert ruta.is_file(), (
        f"mkdocs.yml declara el favicon '{declarado.group(1)}' y no existe en docs/"
    )


def test_los_iconos_no_dependen_de_font_awesome():
    """El favicon lo pide el navegador antes de ejecutar nada.

    El logo del header es un glifo de Font Awesome que se resuelve en el
    cliente; un icono de marca no puede resolverse así, tiene que ser un
    archivo.
    """
    assert GENERADOR_ICONOS.is_file(), "falta el generador de iconos de marca"
    fuente = GENERADOR_ICONOS.read_text(encoding="utf-8")

    codigo = re.sub(r'"""[\s\S]*?"""', "", fuente)
    codigo = re.sub(r"(?m)#.*$", "", codigo)
    for prohibido in ("fontawesome", "font-awesome", "fa-tooth", "cdnjs"):
        assert prohibido not in codigo.lower(), (
            f"el generador de iconos usa '{prohibido}': el favicon no puede depender "
            "de una fuente de iconos externa"
        )


def test_los_colores_del_icono_salen_de_la_configuracion():
    """Otra clínica cambia dos valores y regenera, sin tocar código."""
    colores = marca()["iconColors"]
    for campo in ("background", "foreground"):
        assert re.fullmatch(r"#[0-9a-fA-F]{6}", colores[campo]), (
            f"'brand.iconColors.{campo}' no es un color hexadecimal: {colores[campo]}"
        )

    fuente = GENERADOR_ICONOS.read_text(encoding="utf-8")
    assert "iconColors" in fuente, (
        "el generador no lee los colores de la configuración: cambiarlos no tendría efecto"
    )
    for campo in ("background", "foreground"):
        assert colores[campo] not in re.sub(r'"""[\s\S]*?"""', "", fuente), (
            f"el generador tiene '{colores[campo]}' escrito a mano en el código"
        )
