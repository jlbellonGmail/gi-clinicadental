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


def _sin_scope_de_hero(objetivo):
    """¿Este selector toca `.hero-content` sin colgar de `.hero`?

    `.hero .hero-content p` está scopeado; `.hero-content p` y
    `.equipo .hero-content h1` no lo están. Se mira la parte del selector
    **anterior** a `.hero-content`, que es donde estarían los ancestros.
    El `(?!-)` evita que `.hero-content` se cuente a sí mismo como si
    fuera el ancestro `.hero`.

    Dos precisiones que pidió `audit-1-intento-7.md`:

    - `.hero + .hero-content p` y `.hero ~ .hero-content p` son
      **hermanos**, no ancestros: el elemento no está dentro del hero, así
      que no cuentan como scope. Solo valen los combinadores de
      descendencia (espacio) y de hijo (`>`).
    - `.foo:not(.hero) .hero-content p` menciona `.hero` justamente para
      **excluirlo**. El contenido de `:not(...)` se descarta antes de
      buscar.
    """
    if not re.search(r"\.hero-content\b", objetivo):
        return False

    ancestros = objetivo.split(".hero-content")[0]
    ancestros = re.sub(r":not\([^)]*\)", "", ancestros)

    return not any(
        _es_ancestro(ancestros, m.end())
        for m in re.finditer(r"\.hero\b(?!-)", ancestros)
    )


def _es_ancestro(ancestros, fin):
    """¿El `.hero` que termina en `fin` es ancestro de lo que sigue?

    Lo decide el combinador que cierra **su** selector compuesto, no si
    hay algún `+` más adelante. En `.hero + .hero-content` el hero es
    hermano; en `.hero .foo + .hero-content` es ancestro de los dos, y
    `audit-1-intento-8.md` señaló que la versión anterior lo rechazaba.
    """
    resto = ancestros[fin:]
    # Saltar lo que quede del mismo compuesto (`.hero.activo`, `.hero:hover`).
    i = 0
    while i < len(resto) and resto[i] not in " >+~":
        i += 1
    if i >= len(resto):
        return False
    # Primer caracter significativo tras el compuesto. `>` es hijo y
    # cualquier otro inicio de compuesto es descendencia: en los dos casos
    # `.hero` es ancestro. Solo `+` y `~` lo dejan como hermano.
    for caracter in resto[i:]:
        if caracter == " ":
            continue
        return caracter not in "+~"
    # Solo quedaban espacios: lo siguiente es `.hero-content`, que por
    # tanto desciende de este `.hero`.
    return True


def test_el_color_del_hero_no_se_escapa_al_reuso_sobre_fondo_claro():
    """`.hero-content` se reutiliza en la sección de equipo, fondo claro.

    Hallazgo de `audit-1-intento-5.md`: `.hero-content h1` declaraba
    `color: var(--white)` **sin scope**. Hoy no rompía nada porque esa
    sección usa `h2`, pero la regla era global: cualquier `h1` que se
    agregara ahí habría quedado blanco sobre blanco.

    Este test prohíbe declarar en `.hero-content` sin scope cualquier
    color que no se lea sobre el fondo claro del sitio.

    Se busca `.hero-content` **en cualquier posición** del selector, no
    solo al principio: `audit-1-intento-6.md` señaló que anclar al inicio
    dejaba pasar algo como `.equipo .hero-content h1`, que tampoco está
    scopeado a `.hero`.
    """
    variables = variables_root()
    fondo_claro = resolver("var(--white)", variables)
    culpables = []
    for selector, props in declaraciones().items():
        objetivos = [s.strip() for s in selector.split(",")]
        if not any(_sin_scope_de_hero(o) for o in objetivos):
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


def _partes_del_gradiente(valor):
    """`(ángulo, [(variable, posición), ...])` de un `linear-gradient`.

    Compara el **valor**, no su formato. El nombre de la función y las
    unidades no distinguen mayúsculas en CSS; los nombres de variable
    personalizada **sí**, así que se conservan tal cual.
    """
    texto = re.sub(r"\s+", " ", valor).strip()
    gradiente = re.fullmatch(r"(?i)linear-gradient\(\s*(.+)\s*\)", texto)
    assert gradiente, "`--gradient-primary` ya no es un `linear-gradient`: " + texto

    trozos = [t.strip() for t in gradiente.group(1).split(",")]
    assert len(trozos) >= 2, "El gradiente necesita ángulo y paradas: " + texto

    angulo = trozos[0].lower()
    paradas = []
    for trozo in trozos[1:]:
        parada = re.fullmatch(r"var\(\s*(--[\w-]+)\s*\)\s+(\S+)", trozo)
        assert parada, "Parada de gradiente inesperada: " + trozo
        paradas.append((parada.group(1), parada.group(2).lower()))
    return angulo, paradas


def test_el_gradiente_general_del_sitio_no_se_toca():
    """El hero se corrigió con una superficie propia, no reasignando la común.

    Hallazgo de `audit-1-intento-5.md`: ningún test garantizaba que
    `--gradient-primary` conservara su valor. Si alguien lo oscureciera
    para "arreglar" el hero, afectaría a todo el resto del sitio, que sí
    lo usa correctamente sobre fondo claro.

    Se compara el valor **completo**. `audit-1-intento-6.md` señaló que
    comprobar solo la presencia de las dos variables permitía invertir
    las paradas, cambiar el ángulo o mover las posiciones sin que el test
    dijera nada, mientras el reporte afirmaba que el valor se conservaba.

    Se comparan las **partes** del gradiente, no la cadena:
    `audit-1-intento-7.md` señaló que exigir el formato exacto hacía
    fallar el test por quitar un espacio detrás de una coma, y
    `audit-1-intento-8.md`, que bajarlo todo a minúsculas igualaba
    `var(--PRIMARY)` con `var(--primary)` — los nombres de variable CSS
    **sí** distinguen mayúsculas, así que ahí aceptaba un valor roto.

    Resultado: el nombre de la función y las unidades se comparan sin
    distinguir mayúsculas; los nombres de variable, distinguiéndolas.
    """
    esperado = "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)"
    valor = variables_root().get("--gradient-primary")
    assert valor, "Desapareció `--gradient-primary`"

    assert _partes_del_gradiente(valor) == _partes_del_gradiente(esperado), (
        "`--gradient-primary` cambió de valor.\n  esperado: " + esperado
        + "\n  encontrado: " + valor.strip()
        + "\nEl hero tiene su propia superficie (`--gradient-hero`); este "
        "gradiente es el del resto del sitio y no se toca para arreglarlo."
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


def test_el_clasificador_de_scope_distingue_ancestro_de_hermano():
    """Tabla que fija el comportamiento de `_sin_scope_de_hero`.

    Es la pieza que tres auditorías seguidas hicieron corregir, siempre
    por casos que nadie había escrito: primero solo miraba el principio
    del selector, después trataba `.hero + .hero-content` como scope, y
    después rechazaba `.hero .foo + .hero-content`, que sí desciende del
    hero. Un guard que decide por su cuenta y no está fijado por ningún
    caso vuelve a derivar.
    """
    scopeados = [
        ".hero .hero-content p",
        ".hero>.hero-content p",
        ".hero > .hero-content p",
        ".hero.activo .hero-content p",
        ".hero:hover .hero-content p",
        # El hermano esta entre `.foo` y `.hero-content`, no despues de
        # `.hero`: los dos siguen dentro del hero.
        ".hero .foo + .hero-content p",
        ".hero .foo ~ .hero-content p",
        ".hero .wrap > .hero-content p",
        "section.hero > div .hero-content h2",
    ]
    sin_scope = [
        ".hero-content p",
        ".equipo .hero-content h1",
        "body .hero-content p",
        # Hermanos del hero: el elemento queda fuera.
        ".hero + .hero-content p",
        ".hero ~ .hero-content p",
        ".hero+.hero-content p",
        ".hero~.hero-content p",
        # Menciona `.hero` justamente para excluirlo.
        ".foo:not(.hero) .hero-content p",
    ]

    fallos = []
    for selector in scopeados:
        if _sin_scope_de_hero(selector):
            fallos.append(selector + " es descendiente de `.hero` y se marcó sin scope")
    for selector in sin_scope:
        if not _sin_scope_de_hero(selector):
            fallos.append(selector + " NO desciende de `.hero` y se dio por scopeado")

    assert not fallos, "El clasificador de scope se equivoca en:\n  " + "\n  ".join(fallos)


def test_el_comparador_del_gradiente_mira_el_valor_no_el_formato():
    """Tabla que fija `_partes_del_gradiente`.

    `audit-1-intento-7.md` pidió tolerar el formato y
    `audit-1-intento-8.md` avisó de que bajarlo todo a minúsculas
    igualaba `var(--PRIMARY)` con `var(--primary)`, que en CSS son
    variables distintas. Las dos direcciones quedan fijadas acá.
    """
    base = "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)"

    equivalentes = [
        "linear-gradient(135deg,var(--primary) 0%,var(--primary-dark) 100%)",
        "LINEAR-GRADIENT(135DEG, var(--primary) 0%, var(--primary-dark) 100%)",
        "linear-gradient(  135deg ,  var( --primary ) 0% , var(--primary-dark)  100%  )",
    ]
    distintos = [
        # Nombre de variable en mayusculas: en CSS es otra variable.
        "linear-gradient(135deg, var(--PRIMARY) 0%, var(--primary-dark) 100%)",
        "linear-gradient(90deg, var(--primary) 0%, var(--primary-dark) 100%)",
        "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)",
        "linear-gradient(135deg, var(--primary) 10%, var(--primary-dark) 100%)",
    ]

    fallos = []
    for valor in equivalentes:
        if _partes_del_gradiente(valor) != _partes_del_gradiente(base):
            fallos.append("debería dar igual y no: " + valor)
    for valor in distintos:
        if _partes_del_gradiente(valor) == _partes_del_gradiente(base):
            fallos.append("debería dar distinto y no: " + valor)

    assert not fallos, "El comparador del gradiente falla en:\n  " + "\n  ".join(fallos)
