"""Guardas de contraste del hero.

Origen: `runs/16-validacion-mvp-produccion/test-report-5.md`. La primera
corrección del responsive hizo que todo entrara en el viewport, y aun así
la validación visual en teléfono real volvió a fallar: el hero era
**teal sobre teal**.

Ratios medidos sobre `--gradient-primary` antes de corregir:

- `h1` (gradiente recortado al texto, terminaba en teal): **1,00:1**.
- párrafo (`--text-muted`, pensado para fondo claro): **1,51:1**.
- CTA primario (fondo teal sobre fondo teal): **1,00:1**.
- CTA secundario (borde y texto teal): **1,00:1**.

Cero desbordes y cero legibilidad. Los tests estructurales existentes no
podían verlo: verifican que las piezas estén, no de qué color son.

Este módulo sí calcula el ratio WCAG, sin navegador: resuelve las
variables de `:root`, toma el extremo **más claro** del gradiente del
hero como caso peor, y compara contra los colores declarados.

LÍMITE: cubre el hero de `index.html` y de `404.html`, que es donde
falló, más el scope que impide que ese color se escape al reuso sobre
fondo claro. **No es un barrido de contraste de todo el sitio.**
"""

import re
from pathlib import Path

# Se reutiliza el parser del módulo responsive en vez de duplicarlo: ya
# fue revisado por la auditoría independiente, y un segundo parser sería
# un segundo sitio donde equivocarse.
from test_responsive_movil import reglas_css

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "style.css"

# Mínimos WCAG 2.1 AA.
AA_TEXTO = 4.5
# Texto grande (≥24 px, o ≥18,66 px en negrita) y elementos no textuales
# como bordes o superficies de botón.
AA_TEXTO_GRANDE = 3.0
AA_NO_TEXTO = 3.0

# Umbral de "texto grande" en px, tomando el caso conservador: 24 px vale
# con cualquier peso de fuente.
PX_TEXTO_GRANDE = 24


def declaraciones():
    """`{selector: {propiedad: valor}}`, con la última declaración ganando."""
    salida = {}
    for selector, cuerpo in reglas_css():
        destino = salida.setdefault(selector.strip(), {})
        for trozo in cuerpo.split(";"):
            if ":" not in trozo:
                continue
            prop, _, valor = trozo.partition(":")
            destino[prop.strip()] = valor.strip()
    return salida


def resolver(valor, variables, profundidad=0):
    """Expande `var(--x)` hasta llegar a un valor literal."""
    assert profundidad < 10, "Ciclo de variables CSS en: " + valor
    referencia = re.search(r"var\(\s*(--[\w-]+)\s*\)", valor)
    if not referencia:
        return valor
    nombre = referencia.group(1)
    assert nombre in variables, "Variable CSS no definida: " + nombre
    expandido = valor.replace(referencia.group(0), variables[nombre])
    return resolver(expandido, variables, profundidad + 1)


def hex_a_rgb(color):
    c = color.strip().lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    assert len(c) == 6, "No es un color hexadecimal: " + color
    return tuple(int(c[i : i + 2], 16) for i in (0, 2, 4))


def luminancia(rgb):
    canales = []
    for v in rgb:
        s = v / 255
        canales.append(s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4)
    r, g, b = canales
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    x, y = sorted((luminancia(hex_a_rgb(a)), luminancia(hex_a_rgb(b))), reverse=True)
    return round((x + 0.05) / (y + 0.05), 2)


def variables_root():
    reglas = declaraciones()
    assert ":root" in reglas, "El CSS perdió el bloque `:root`"
    return {k: v for k, v in reglas[":root"].items() if k.startswith("--")}


def fondo_peor_del_hero():
    """El extremo más claro del gradiente del hero: el caso más exigente.

    Sobre el extremo oscuro cualquier texto claro contrasta más, así que
    validar contra el claro valida los dos.
    """
    variables = variables_root()
    reglas = declaraciones()
    assert ".hero" in reglas, "Desapareció la regla `.hero`"
    fondo = reglas[".hero"].get("background") or reglas[".hero"].get("background-color")
    assert fondo, "`.hero` ya no declara fondo; el contraste no se puede verificar"

    paradas = re.findall(r"#[0-9a-fA-F]{3,6}", resolver(fondo, variables))
    assert paradas, "El fondo del hero no resuelve a ningún color: " + fondo
    return max(paradas, key=lambda c: luminancia(hex_a_rgb(c)))


def color_de(selector, propiedad):
    reglas = declaraciones()
    assert selector in reglas, "Desapareció la regla `" + selector + "`"
    valor = reglas[selector].get(propiedad)
    assert valor, selector + " ya no declara " + propiedad
    return resolver(valor, variables_root())


def test_el_titulo_del_hero_es_legible():
    fondo = fondo_peor_del_hero()
    ratio = contraste(color_de(".hero .hero-content h1", "color"), fondo)
    assert ratio >= AA_TEXTO, (
        "El título del hero contrasta " + str(ratio) + ":1 sobre " + fondo
        + ". Antes de la corrección era 1,00:1 —teal sobre teal— y la "
        "validación en teléfono real falló por esto."
    )


def menor_tamano_del_h1_del_hero():
    """El `font-size` más chico que puede tomar el `h1` del hero, en px.

    En móvil es un `clamp()`: el primer argumento es el piso. Se resuelve
    a px asumiendo la raíz por defecto de 16 px, que este sitio no
    cambia.
    """
    reglas = declaraciones()
    tamanos = []
    for selector, props in reglas.items():
        if selector.strip() not in (".hero-content h1", ".hero .hero-content h1"):
            continue
        valor = props.get("font-size")
        if not valor:
            continue
        candidatos = re.findall(r"([\d.]+)\s*(rem|px)", valor)
        if "clamp(" in valor:
            # Solo el piso del clamp: es el tamaño en el ancho más chico.
            candidatos = candidatos[:1]
        for numero, unidad in candidatos:
            tamanos.append(float(numero) * (16 if unidad == "rem" else 1))
    assert tamanos, "No se pudo leer el `font-size` del `h1` del hero"
    return min(tamanos)


def test_el_acento_del_titulo_es_legible():
    """El acento usa el umbral de texto grande, y se verifica que lo sea.

    `--accent-soft` da 3,80:1 sobre el hero: cumple AA como texto grande
    (3:1), no como texto normal. Llevarlo a 4,5:1 exigiría aclararlo
    hasta `#fff0e6`, que a esa altura ya no se distingue del blanco del
    resto del título — se perdería el acento sin ganar legibilidad.

    La excepción vale solo mientras el `h1` sea realmente grande, así que
    el tamaño se comprueba en vez de darse por supuesto: si alguien
    encoge el título, este test deja de conceder el umbral flojo.
    """
    menor = menor_tamano_del_h1_del_hero()
    assert menor >= PX_TEXTO_GRANDE, (
        "El `h1` del hero baja a " + str(menor) + " px, por debajo de los "
        + str(PX_TEXTO_GRANDE) + " px que lo califican como texto grande. "
        "A ese tamaño el acento necesita " + str(AA_TEXTO) + ":1, no "
        + str(AA_TEXTO_GRANDE) + ":1."
    )

    fondo = fondo_peor_del_hero()
    ratio = contraste(color_de(".hero .hero-content h1 .accent", "color"), fondo)
    assert ratio >= AA_TEXTO_GRANDE, (
        "El acento del título contrasta " + str(ratio) + ":1 sobre " + fondo
    )


def test_el_parrafo_del_hero_es_legible():
    """El párrafo tiene su propia regla scopeada por una razón.

    `.hero-content p` usa `--text-muted`, pensado para fondo claro, y da
    1,51:1 sobre el hero. `.hero .hero-content p` lo corrige. Si esa
    regla desaparece, el párrafo vuelve al gris ilegible.
    """
    fondo = fondo_peor_del_hero()
    ratio = contraste(color_de(".hero .hero-content p", "color"), fondo)
    assert ratio >= AA_TEXTO, (
        "El párrafo del hero contrasta " + str(ratio) + ":1 sobre " + fondo
    )


def test_los_dos_cta_del_hero_se_ven():
    """Los dos CTA eran invisibles: 1,00:1 cada uno.

    El primario se fundía con el fondo; el secundario era borde y texto
    teal sobre teal. Se verifican tres cosas: el texto sobre su propio
    botón, la superficie del botón contra el hero —si no, se ve el texto
    pero no el botón— y el CTA secundario, que no tiene relleno propio.
    """
    fondo = fondo_peor_del_hero()

    fondo_primario = color_de(".hero .btn-primary", "background-color")
    texto_primario = color_de(".hero .btn-primary", "color")

    ratio_texto = contraste(texto_primario, fondo_primario)
    assert ratio_texto >= AA_TEXTO, (
        "El texto del CTA primario contrasta " + str(ratio_texto) + ":1 con su botón"
    )

    ratio_superficie = contraste(fondo_primario, fondo)
    assert ratio_superficie >= AA_NO_TEXTO, (
        "El CTA primario se funde con el hero: " + str(ratio_superficie) + ":1"
    )

    ratio_secundario = contraste(color_de(".hero .btn-outline", "color"), fondo)
    assert ratio_secundario >= AA_TEXTO, (
        "El texto del CTA secundario contrasta " + str(ratio_secundario) + ":1"
    )

    ratio_borde = contraste(color_de(".hero .btn-outline", "border-color"), fondo)
    assert ratio_borde >= AA_NO_TEXTO, (
        "El borde del CTA secundario contrasta " + str(ratio_borde) + ":1"
    )


def test_el_hero_no_vuelve_al_gradiente_que_no_contrasta():
    """`--gradient-primary` es correcto para su uso, pero no para el hero.

    Sobre `--primary` (#0ca9a9) el blanco da 2,89:1, por debajo de AA. Es
    el gradiente que tenía el hero cuando falló la validación visual, y
    reasignarlo sería reintroducir el defecto exacto.
    """
    fondo = declaraciones()[".hero"].get("background", "")
    assert "--gradient-primary" not in fondo, (
        "El hero volvió a `--gradient-primary`. Sobre ese fondo el texto "
        "blanco queda en 2,89:1 y el hero deja de ser legible."
    )

    blanco = resolver("var(--white)", variables_root())
    for parada in re.findall(r"#[0-9a-fA-F]{3,6}", resolver(fondo, variables_root())):
        ratio = contraste(blanco, parada)
        assert ratio >= AA_TEXTO, (
            "La parada " + parada + " del gradiente del hero deja el blanco "
            "en " + str(ratio) + ":1"
        )


def test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro():
    """`.hero-content` se reutiliza en la sección de equipo, fondo claro.

    Hallazgo de `audit-1-intento-5.md`: `.hero-content h1` declaraba
    `color: var(--white)` **sin scope**. Hoy no rompía nada porque esa
    sección usa `h2`, pero la regla era global: cualquier `h1` que se
    agregara ahí habría quedado blanco sobre blanco.

    Este test prohíbe declarar en `.hero-content` sin scope cualquier
    color que no se lea sobre el fondo claro del sitio.
    """
    variables = variables_root()
    fondo_claro = resolver("var(--white)", variables)
    culpables = []
    for selector, props in declaraciones().items():
        objetivos = [s.strip() for s in selector.split(",")]
        if not any(re.match(r"^\.hero-content\b", s) for s in objetivos):
            continue
        valor = props.get("color")
        if not valor:
            continue
        color = resolver(valor, variables)
        if not color.strip().startswith("#"):
            continue
        ratio = contraste(color, fondo_claro)
        if ratio < AA_TEXTO_GRANDE:
            culpables.append(selector + " -> " + color + " (" + str(ratio) + ":1)")

    assert not culpables, (
        "Hay color del hero declarado sin scopear a `.hero`: "
        + "; ".join(culpables)
        + ". `.hero-content` se reutiliza sobre fondo claro, donde ese "
        "color no se lee. El color del hero va en `.hero .hero-content ...`."
    )


def test_el_gradiente_general_del_sitio_no_se_toca():
    """El hero se corrigió con una superficie propia, no reasignando la común.

    Hallazgo de `audit-1-intento-5.md`: ningún test garantizaba que
    `--gradient-primary` conservara su valor. Si alguien lo oscureciera
    para "arreglar" el hero, afectaría a todo el resto del sitio, que sí
    lo usa correctamente sobre fondo claro.
    """
    variables = variables_root()
    valor = variables.get("--gradient-primary")
    assert valor, "Desapareció `--gradient-primary`"
    assert "var(--primary)" in valor and "var(--primary-dark)" in valor, (
        "`--gradient-primary` dejó de ir de `--primary` a `--primary-dark`: "
        + valor
    )


def test_la_pagina_404_no_hereda_texto_ilegible_sobre_el_hero():
    """`404.html` usa `.hero`, así que le toca la superficie oscura.

    Sus párrafos llevaban `color: var(--text-muted)` **inline**, un gris
    para fondo claro: 1,15:1 sobre el hero. Inline, además, ninguna regla
    CSS podía corregirlo. Se quitó el color para que herede el del hero.

    No lo detectó la auditoría —no se le preguntó por el 404— ni el resto
    de este módulo, que solo mira `index.html`.
    """
    html = (ROOT / "404.html").read_text(encoding="utf-8")

    # Solo dentro de `<section class="hero">`. El footer de esa página usa
    # `#bbb` sobre fondo oscuro, que se lee perfectamente: escanear el
    # documento entero daba cinco falsos positivos.
    seccion = re.search(r'<section class="hero">(.*?)</section>', html, re.S)
    assert seccion, "`404.html` ya no tiene sección `.hero`"

    fondo = fondo_peor_del_hero()
    variables = variables_root()

    culpables = []
    for estilo in re.findall(r'style="([^"]*)"', seccion.group(1)):
        encontrado = re.search(r"(?:^|;)\s*color\s*:\s*([^;]+)", estilo)
        if not encontrado:
            continue
        color = resolver(encontrado.group(1).strip(), variables)
        if not color.strip().startswith("#"):
            continue
        ratio = contraste(color, fondo)
        if ratio < AA_TEXTO_GRANDE:
            culpables.append(color + " (" + str(ratio) + ":1)")

    assert not culpables, (
        "`404.html` declara color inline ilegible sobre el hero: "
        + "; ".join(culpables)
        + ". Un color inline no lo puede corregir ninguna regla CSS."
    )
