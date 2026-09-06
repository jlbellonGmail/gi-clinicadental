"""Guardas de regresión del responsive móvil.

Origen: `runs/16-validacion-mvp-produccion/test-report-4.md`. La
validación V12 en un teléfono real falló: la barra de navegación no cabía
en el viewport, el título del hero se cortaba y el formulario quedaba
demasiado angosto.

Medido con viewport real (iframe del mismo origen) a 360 px **antes** de
corregir:

- `nav.nav-links` llegaba a `x=460` sobre un viewport de 360.
- `div.header-cta` iba de `x=460` a `x=703`: 343 px enteros fuera de
  pantalla.
- `#leadForm` medía 201 px, el 56 % del ancho disponible.
- No existía ningún menú hamburguesa.

LÍMITE CONOCIDO Y DECLARADO: estos tests son **estructurales**, no
visuales. Verifican que las piezas que corrigen el problema sigan en su
sitio; **no miden layout ni detectan una regresión visual**. Para eso
haría falta un navegador headless en CI, que este proyecto no tiene. La
verificación de layout se hizo con mediciones reales documentadas en el
reporte, y se repite en Production con el mismo método.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

INDEX = ROOT / "index.html"
CSS = ROOT / "style.css"
JS = ROOT / "script.js"

BREAKPOINT_MOVIL = "max-width: 768px"


def bloque_movil() -> str:
    """Devuelve el texto del bloque `@media (max-width: 768px)`."""
    css = CSS.read_text(encoding="utf-8")
    inicio = css.find("@media (" + BREAKPOINT_MOVIL + ")")
    assert inicio != -1, "Falta el breakpoint móvil de la corrección V12"
    profundidad = 0
    for i in range(css.find("{", inicio), len(css)):
        if css[i] == "{":
            profundidad += 1
        elif css[i] == "}":
            profundidad -= 1
            if profundidad == 0:
                return css[inicio : i + 1]
    raise AssertionError("El bloque del breakpoint móvil no cierra")


def _sin_comentarios(css: str) -> str:
    """Un `overflow-x: hidden` mencionado en una nota no es una regla."""
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def reglas_de_bloque(fragmento: str):
    """Pares (selector, cuerpo) de un fragmento sin anidamiento."""
    salida, i = [], 0
    while i < len(fragmento):
        apertura = fragmento.find("{", i)
        if apertura == -1:
            break
        selector = fragmento[i:apertura].strip().split("}")[-1].strip()
        cierre = fragmento.find("}", apertura)
        if cierre == -1:
            break
        salida.append((selector, fragmento[apertura + 1 : cierre]))
        i = cierre + 1
    return salida


def reglas_css():
    """Todas las reglas del CSS, entrando también en los `@media`.

    Sin dependencias: recorre el archivo contando llaves. Se necesita
    porque buscar subcadenas sobre el CSS crudo es frágil — de hecho fue
    el origen del fallo que corrige este módulo.
    """
    css = _sin_comentarios(CSS.read_text(encoding="utf-8"))
    fuera, i = [], 0
    while i < len(css):
        apertura = css.find("{", i)
        if apertura == -1:
            break
        selector = css[i:apertura].strip().split("}")[-1].strip()
        profundidad, j = 1, apertura + 1
        while j < len(css) and profundidad:
            if css[j] == "{":
                profundidad += 1
            elif css[j] == "}":
                profundidad -= 1
            j += 1
        cuerpo = css[apertura + 1 : j - 1]
        if selector.startswith("@"):
            fuera.extend(reglas_de_bloque(cuerpo))
        else:
            fuera.append((selector, cuerpo))
        i = j
    return fuera


def test_existe_el_boton_de_menu_movil_con_accesibilidad():
    html = INDEX.read_text(encoding="utf-8")
    assert 'class="nav-toggle"' in html, (
        "Desapareció el botón de menú móvil. Sin él la navegación "
        "horizontal vuelve a desbordar el viewport."
    )
    assert "aria-expanded" in html, "El botón de menú debe exponer aria-expanded"
    assert "aria-controls" in html, "El botón de menú debe apuntar al nav que controla"
    assert "aria-label" in html, "El botón de menú necesita un nombre accesible"


def test_el_header_declara_que_usa_menu_movil():
    html = INDEX.read_text(encoding="utf-8")
    assert 'class="has-mobile-nav"' in html, (
        "El header perdió `has-mobile-nav`. Las reglas móviles están "
        "scopeadas a esa clase, así que sin ella no se aplican."
    )


def test_el_breakpoint_movil_colapsa_la_navegacion():
    bloque = bloque_movil()
    assert ".has-mobile-nav .nav-toggle" in bloque, "El botón debe hacerse visible en móvil"
    assert ".has-mobile-nav .nav-links" in bloque, "La nav debe colapsar en móvil"
    assert ".has-mobile-nav .header-cta" in bloque, "El bloque de CTA debe colapsar en móvil"
    assert "display: none" in bloque, "El colapso se hace ocultando, no encogiendo"
    assert ".has-mobile-nav.nav-open" in bloque, "Debe existir el estado abierto"


def test_el_desborde_no_se_tapa_con_overflow_hidden():
    """La causa real se corrigió; no se escondió el síntoma.

    Criterio explícito del punto 16: no ocultar el desborde con
    `overflow-x: hidden` en lugar de arreglar lo que se sale.

    Este test tuvo un fallo propio, detectado por la auditoría
    independiente (`audit-1-intento-4.md`): buscaba
    `body{overflow-x:hidden` como subcadena contigua y no lo encontraba,
    porque el CSS tiene otras propiedades entre medio. Pasaba en verde
    mientras la regla prohibida estaba presente desde el commit baseline.
    Ahora parsea las reglas de verdad.

    `overflow: hidden` **scopeado** a un componente (`.hero`,
    `.hero-image`) es legítimo: contiene decoraciones y recorta esquinas
    redondeadas. Lo prohibido es la máscara global sobre `html`/`body`.
    """
    culpables = []
    for selector, cuerpo in reglas_css():
        objetivos = [s.strip() for s in selector.split(",")]
        if not any(re.fullmatch(r"(html|body)", s) for s in objetivos):
            continue
        for valor in re.findall(r"overflow(?:-x)?\s*:\s*([a-z]+)", cuerpo):
            if valor in ("hidden", "clip"):
                culpables.append(selector + " { overflow-x: " + valor + " }")

    assert not culpables, (
        "Hay una máscara global de desborde: "
        + "; ".join(culpables)
        + ". Eso esconde el problema en vez de corregir su causa, que es "
        "un criterio explícito del punto 16."
    )


def test_el_breakpoint_movil_tampoco_enmascara():
    bloque = bloque_movil()
    for selector, cuerpo in reglas_de_bloque(_sin_comentarios(bloque)):
        objetivos = [s.strip() for s in selector.split(",")]
        if any(re.fullmatch(r"(html|body)", s) for s in objetivos):
            assert "overflow" not in cuerpo, (
                "El breakpoint móvil enmascara el desborde en " + selector
            )


def test_el_hero_se_adapta_en_movil():
    bloque = bloque_movil()
    assert ".hero-content h1" in bloque, "El título del hero debe reducirse en móvil"
    assert ".hero-btns" in bloque, "Los CTA del hero deben reacomodarse en móvil"
    assert "column" in bloque, "Los CTA se apilan verticalmente en móvil"


def test_el_formulario_no_pierde_el_ancho_en_padding():
    """El padding del formulario ya no puede vivir inline.

    Era la causa concreta de que el formulario midiera 201 px sobre 360:
    un `style="padding: 50px"` en el HTML, inalcanzable para cualquier
    media query.
    """
    html = INDEX.read_text(encoding="utf-8")
    contenedor = re.search(r'<div class="lead-form-container"[^>]*>', html)
    assert contenedor, "Falta el contenedor del formulario"
    assert "style=" not in contenedor.group(0), (
        "El contenedor del formulario volvió a llevar estilos inline. "
        "Un padding inline no lo puede reducir ninguna media query."
    )

    css = CSS.read_text(encoding="utf-8")
    assert ".lead-form-container" in css, "El contenedor debe tener sus estilos en CSS"
    assert ".lead-form-container" in bloque_movil(), (
        "El formulario debe reducir su padding en móvil para aprovechar "
        "el ancho del teléfono."
    )


def test_el_toggle_esta_cableado_en_el_javascript():
    js = JS.read_text(encoding="utf-8")
    assert "nav-toggle" in js, "El botón de menú no tiene manejador"
    assert "nav-open" in js, "El manejador debe alternar el estado abierto"
    assert "aria-expanded" in js, "El estado accesible debe actualizarse al abrir/cerrar"


def test_el_menu_movil_no_afecta_a_paginas_sin_el():
    """`404.html` tiene un solo enlace y no declara `has-mobile-nav`.

    Si las reglas móviles no estuvieran scopeadas, esa página se quedaría
    en móvil sin ninguna navegación visible.
    """
    html404 = (ROOT / "404.html").read_text(encoding="utf-8")
    assert "has-mobile-nav" not in html404, (
        "404.html no debe declarar el menú móvil: no tiene botón que lo abra."
    )
    for linea in bloque_movil().splitlines():
        limpia = linea.strip()
        if limpia.startswith(".nav-links") or limpia.startswith(".header-cta"):
            raise AssertionError(
                "Regla móvil sin scopear a `.has-mobile-nav`: dejaría a "
                "404.html sin navegación. Línea: " + limpia
            )
