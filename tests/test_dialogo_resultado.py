"""Guardas del diálogo de resultado del formulario.

Origen: `runs/v1.0.0-producto/16-validacion-mvp-produccion/test-report-7.md`. El diálogo
"Solicitud enviada" **se veía al entrar al sitio**, sin haber enviado
nada.

La causa no era JavaScript. El atributo `hidden` estaba puesto en el HTML
y `modal.hidden` era `true`; lo que fallaba era la cascada:

    [hidden] { display: none }   <- hoja del NAVEGADOR (user agent)
    .modal   { display: flex }   <- hoja del SITIO (autor)

Cualquier regla de autor le gana a la del agente de usuario, sin importar
la especificidad. El `display: flex` anulaba el `hidden`.

POR QUÉ ESTE GUARD VIVE EN PYTHON Y NO EN `script.test.js`: jsdom no
reproduce el defecto. Con el mismo HTML y el mismo CSS devuelve
`display: none`, porque su cascada no modela esa precedencia. Los tests
de jsdom comprobaban `modal.hidden === true` —que era cierto— mientras el
navegador lo mostraba. Un guard que corre en el motor equivocado no es un
guard.
"""

import re
from pathlib import Path

# Se reutilizan los parsers ya auditados en vez de escribir otros.
from test_responsive_movil import reglas_css, _sin_comentarios

ROOT = Path(__file__).resolve().parents[1]

INDEX = ROOT / "index.html"
CSS = ROOT / "style.css"
JS = ROOT / "script.js"

# Los tres estados terminales. El texto de `parcial` es literal por
# pedido expreso: es el que le dice a alguien que su solicitud quedó
# guardada aunque la notificación fallara.
VARIANTES = ("exito", "parcial", "error")


def test_el_atributo_hidden_gana_a_las_reglas_de_autor():
    """Tiene que existir una red de seguridad de autor para `[hidden]`.

    Sin ella, basta con que cualquier regla del sitio declare `display`
    sobre un elemento oculto para que el `hidden` deje de significar
    nada. Es exactamente lo que pasó con `.modal`.
    """
    red = None
    culpables = []

    for selector, cuerpo in reglas_css():
        objetivos = [s.strip() for s in selector.split(",")]
        valor = re.search(r"display\s*:\s*([^;]+)", cuerpo)
        if not valor:
            continue
        display = valor.group(1).strip().lower()

        if any(o == "[hidden]" for o in objetivos):
            red = display
        elif any("[hidden]" in o for o in objetivos):
            # Un selector MAS especifico que menciona `[hidden]` y declara
            # otro `display` le gana a la red de seguridad. Lo señaló
            # `audit-4-punto-16.md`: sin esta rama, un
            # `.modal[hidden] { display: flex !important }` habría pasado
            # en verde y el diálogo volvería a verse al cargar.
            if not display.startswith("none"):
                culpables.append(selector + " { display: " + display + " }")

    assert red is not None, (
        "Falta la regla `[hidden] { display: none !important }`. Sin ella, "
        "el `hidden` del HTML lo pisa cualquier regla de autor que declare "
        "`display`, y el diálogo se ve al cargar la página."
    )
    assert red.startswith("none"), "`[hidden]` debe resolver a `display: none`, no a " + red
    assert "!important" in red, (
        "La red de seguridad necesita `!important`: sin él, una regla más "
        "específica —como `.modal.abierto`— volvería a ganarle."
    )
    assert not culpables, (
        "Hay reglas que le devuelven un `display` visible a un elemento con "
        "`hidden`, pisando la red de seguridad: " + "; ".join(culpables)
    )


def test_el_dialogo_y_sus_variantes_arrancan_ocultos_en_el_html():
    """Cerrado desde el HTML servido, no desde JavaScript.

    Si dependiera del script habría un parpadeo: el diálogo visible hasta
    que el JS termina de cargar.
    """
    html = INDEX.read_text(encoding="utf-8")

    contenedor = re.search(r'<div class="modal" id="modalResultado"([^>]*)>', html)
    assert contenedor, "Falta el contenedor del diálogo de resultado"
    assert "hidden" in contenedor.group(1), (
        "El diálogo debe venir con `hidden` desde el servidor"
    )

    for nombre in VARIANTES:
        variante = re.search(
            r'<div class="modal__variante" id="variante\w+" data-resultado="'
            + nombre
            + r'"([^>]*)>',
            html,
        )
        assert variante, "Falta la variante `" + nombre + "`"
        assert "hidden" in variante.group(1), (
            "La variante `" + nombre + "` debe venir oculta del servidor"
        )


def test_el_script_no_tiene_que_cerrar_el_dialogo_al_arrancar():
    js = JS.read_text(encoding="utf-8")
    assert not re.search(r"modalResultado['\"]\)\.hidden\s*=\s*true", js), (
        "Cerrar el diálogo al inicializar es tapar el síntoma: si hace "
        "falta, es que el HTML no lo estaba ocultando."
    )


def bloque_dialogo_resultado(html: str) -> str:
    """El diálogo de resultado, aislado del resto del documento.

    Desde la v1.0.1 hay un segundo diálogo en la página —la política de
    privacidad—, así que ya no alcanza con cortar hasta `<script>`: ese
    rango se comía el texto legal.
    """
    inicio = html.find('id="modalResultado"')
    assert inicio != -1, "Falta el diálogo de resultado"
    # Termina donde empieza el diálogo siguiente, o donde termina el
    # cuerpo del documento si es el último.
    candidatos = [
        pos
        for pos in (html.find('<div class="modal"', inicio + 1), html.find("<script", inicio))
        if pos != -1
    ]
    fin = min(candidatos) if candidatos else len(html)
    return html[inicio:fin]


def test_los_tres_estados_comparten_un_solo_dialogo():
    """Tres estados, un solo diálogo.

    Tres modales distintos serían tres implementaciones de foco, `Escape`
    y cierre que hay que mantener en paralelo.

    El conteo global de `.modal` **ya no sirve** para medir esto: la
    v1.0.1 agregó un segundo diálogo, el de la política de privacidad. Lo
    que se comprueba ahora es más preciso y a la vez más amplio: que el
    diálogo de resultado siga siendo uno solo con sus tres variantes, y
    que todos los diálogos de la página reusen la misma infraestructura
    en vez de traer cada uno la suya.
    """
    html = INDEX.read_text(encoding="utf-8")

    assert html.count('id="modalResultado"') == 1, "Debe haber un único diálogo de resultado"

    resultado = bloque_dialogo_resultado(html)
    assert resultado.count('role="dialog"') == 1, "Un solo `role=dialog` en el resultado"
    assert resultado.count("modal__variante") == len(VARIANTES)

    # Cada `role="dialog"` tiene que estar dentro de un `.modal`: es lo
    # que garantiza que compartan el bloqueo de scroll, el fondo y el
    # comportamiento de `script.js`.
    assert html.count('role="dialog"') == html.count('class="modal"'), (
        "Hay un `role=dialog` que no vive dentro de la infraestructura "
        "`.modal`, o un `.modal` sin diálogo adentro"
    )


def test_todos_los_dialogos_arrancan_cerrados_desde_el_html():
    """El defecto original era un diálogo visible al cargar la página.

    No alcanza con que lo esté el de resultado: cualquier diálogo nuevo
    tiene que arrancar cerrado por el atributo `hidden` del HTML, sin
    depender de que JavaScript llegue a ejecutarse.
    """
    html = INDEX.read_text(encoding="utf-8")
    aperturas = re.findall(r"<div class=\"modal\"[^>]*>", html)
    assert aperturas, "No hay ningún diálogo en la página"
    sin_hidden = [a for a in aperturas if "hidden" not in a]
    assert not sin_hidden, (
        "Hay diálogos que no arrancan ocultos desde el HTML: " + "; ".join(sin_hidden)
    )


def test_no_se_usa_alert_nativo():
    js = JS.read_text(encoding="utf-8")
    assert not re.search(r"(^|[^.\w])alert\s*\(", js), (
        "`alert()` bloquea el hilo y no es accesible ni responsive"
    )


def test_el_mensaje_de_exito_parcial_dice_lo_que_tiene_que_decir():
    """Es el mensaje más delicado de los tres.

    El lead ya está guardado: si el texto invitara a reenviar, generaría
    un duplicado. Y tiene que decir que la solicitud quedó registrada,
    porque si no la persona se va creyendo que se perdió.
    """
    html = INDEX.read_text(encoding="utf-8")
    bloque = re.search(
        r'data-resultado="parcial".*?</div>\s*</div>', html, re.S
    )
    assert bloque, "Falta la variante de éxito parcial"
    texto = re.sub(r"<[^>]+>", " ", bloque.group(0))
    texto = re.sub(r"\s+", " ", texto)

    for frase in [
        "Solicitud registrada",
        "Recibimos tus datos correctamente",
        "Tuvimos un inconveniente al completar las notificaciones",
        "tu solicitud quedó registrada",
        "No es necesario que vuelvas a enviar el formulario",
        "Tu turno todavía no está confirmado",
    ]:
        assert frase in texto, "El mensaje de éxito parcial perdió: " + frase

    assert not re.search(r"intent[áa] nuevamente|reintent", texto, re.I), (
        "El éxito parcial NO puede invitar a reenviar: el lead ya existe "
        "y reenviar lo duplicaría."
    )


def test_solo_el_error_de_registro_invita_a_reintentar():
    """Reintentar solo es seguro si no quedó nada guardado."""
    html = INDEX.read_text(encoding="utf-8")
    bloque = re.search(r'data-resultado="error".*?</div>\s*</div>', html, re.S)
    assert bloque, "Falta la variante de error"
    texto = re.sub(r"<[^>]+>", " ", bloque.group(0))
    texto = re.sub(r"\s+", " ", texto)

    assert "No pudimos registrar tu solicitud" in texto
    assert re.search(r"Intent[áa] nuevamente", texto), (
        "En este caso sí se invita a reintentar: no hay lead guardado."
    )


def test_ninguna_variante_promete_un_correo():
    """El frontend no puede saber si un correo llegó, ni si se leyó.

    La respuesta del endpoint dice si el envío salió, y eso no es lo
    mismo.
    """
    html = INDEX.read_text(encoding="utf-8")
    texto = re.sub(r"<[^>]+>", " ", bloque_dialogo_resultado(html)).lower()

    for promesa in ["correo", "email", "e-mail", "bandeja", "casilla"]:
        assert promesa not in texto, (
            "El diálogo afirma algo sobre correos que el frontend no puede "
            "confirmar: " + promesa
        )


def test_el_dialogo_no_provoca_scroll_horizontal():
    """La caja tiene que ceder en pantallas angostas.

    Con un `max-width` fijo, a 320 px la caja más el padding del
    contenedor desbordaban.
    """
    css = _sin_comentarios(CSS.read_text(encoding="utf-8"))
    caja = re.search(r"\.modal__caja\s*\{([^}]*)\}", css)
    assert caja, "Falta la regla `.modal__caja`"
    ancho = re.search(r"max-width\s*:\s*([^;]+)", caja.group(1))
    assert ancho, "`.modal__caja` necesita un `max-width`"
    assert "min(" in ancho.group(1) or "%" in ancho.group(1), (
        "El ancho del diálogo debe ceder en pantallas angostas, no ser fijo: "
        + ancho.group(1).strip()
    )
