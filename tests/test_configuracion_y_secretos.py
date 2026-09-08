"""Separación entre configuración pública, técnica y secretos.

La v1.0.1 mueve todo el contenido del cliente a `config/clinic.json`, que
**se sirve como archivo estático**. Eso hace explícita una frontera que
antes no existía y que conviene vigilar en las dos direcciones:

- que ninguna credencial termine en el archivo público;
- que el contenido editorial no termine en variables de entorno, donde no
  se revisa, no se versiona y no se puede leer sin acceso a Vercel.

Estos guards son estructurales: miran los archivos del repositorio. No
pueden ver qué valores están efectivamente cargados en Vercel.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ENV_EJEMPLO = ROOT / ".env.example"
GITIGNORE = ROOT / ".gitignore"
VERCELIGNORE = ROOT / ".vercelignore"
VERCEL = ROOT / "vercel.json"
CONFIG = ROOT / "config" / "clinic.json"

# Nombres que delatan una credencial.
NOMBRE_SECRETO = re.compile(
    r"(pass(word)?|secret|token|credential|service_?role|api_?key|authorization)",
    re.I,
)


def variables_declaradas() -> dict:
    """Nombre -> valor de cada variable de `.env.example`."""
    variables = {}
    for linea in ENV_EJEMPLO.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        nombre, _, valor = limpia.partition("=")
        variables[nombre.strip()] = valor.strip()
    return variables


def test_ninguna_variable_publica_puede_ser_un_secreto():
    """`NEXT_PUBLIC_*` llega al navegador: ahí no va nada secreto.

    El caso concreto que se quiere impedir es que alguien agregue
    `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` para "que funcione desde el
    frontend". Esa clave bypassea RLS por completo.
    """
    culpables = [
        nombre
        for nombre in variables_declaradas()
        if nombre.startswith("NEXT_PUBLIC_") and NOMBRE_SECRETO.search(nombre)
        # `ANON_KEY` es pública por diseño: la protege RLS, no el secreto.
        and not nombre.endswith("ANON_KEY")
    ]
    assert not culpables, (
        "Variables expuestas al navegador con nombre de secreto: "
        + ", ".join(culpables)
    )


def test_el_ejemplo_de_entorno_no_trae_valores_reales():
    """`.env.example` documenta nombres, no valores.

    Se permiten valores evidentemente inocuos —un puerto, una URL de
    desarrollo—; lo que no se permite es algo con forma de credencial.
    """
    sospechosos = []
    for nombre, valor in variables_declaradas().items():
        if not valor:
            continue
        if valor.startswith("http://localhost") or valor.isdigit():
            continue
        if re.fullmatch(r"[A-Za-z0-9_\-]{20,}", valor) or valor.startswith("eyJ"):
            sospechosos.append(nombre)

    assert not sospechosos, (
        ".env.example parece traer valores reales en: " + ", ".join(sospechosos)
    )


def test_los_archivos_de_entorno_estan_ignorados_por_git():
    contenido = GITIGNORE.read_text(encoding="utf-8")
    assert re.search(r"^\.env", contenido, re.M), (
        ".gitignore tiene que excluir los archivos .env con valores reales"
    )


def test_la_configuracion_publica_no_declara_ninguna_credencial():
    """Recorre claves y valores, no el texto crudo.

    Mirar el archivo entero haría que el guard se disparara con su propio
    comentario, el que advierte que los secretos van en variables de
    entorno.
    """
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    hallazgos = []

    def recorrer(nodo, ruta):
        if isinstance(nodo, dict):
            for clave, valor in nodo.items():
                donde = f"{ruta}.{clave}" if ruta else clave
                if NOMBRE_SECRETO.search(clave):
                    hallazgos.append(f"clave '{donde}'")
                recorrer(valor, donde)
        elif isinstance(nodo, list):
            for i, item in enumerate(nodo):
                recorrer(item, f"{ruta}[{i}]")
        elif isinstance(nodo, str):
            valor = nodo.strip()
            if valor.startswith("eyJ") or re.fullmatch(r"[A-Za-z0-9_\-]{40,}", valor):
                hallazgos.append(f"valor de '{ruta}'")

    recorrer(config, "")
    assert not hallazgos, (
        "config/clinic.json es público y parece contener credenciales: "
        + ", ".join(hallazgos)
    )


def test_el_guard_de_credenciales_detecta_una_de_verdad():
    """Verificación en negativo del test anterior.

    Sin esto no se sabría si pasa porque no hay credenciales o porque el
    patrón dejó de reconocerlas.
    """
    assert NOMBRE_SECRETO.search("apiKey")
    assert NOMBRE_SECRETO.search("SUPABASE_SERVICE_ROLE_KEY")
    assert NOMBRE_SECRETO.search("smtpPassword")
    assert not NOMBRE_SECRETO.search("openingHours")
    assert re.fullmatch(r"[A-Za-z0-9_\-]{40,}", "a" * 45)


def test_el_contenido_editorial_no_vive_en_variables_de_entorno():
    """Lo que se ve en el sitio se revisa en una PR, no en un panel.

    Si el nombre de la clínica o su dirección estuvieran en una variable
    de entorno, cambiarlos no dejaría rastro en el repositorio.
    """
    editoriales = [
        nombre
        for nombre in variables_declaradas()
        if re.search(r"(BRAND|CLINIC|PHONE|WHATSAPP|ADDRESS|SERVICES|OPENING)", nombre, re.I)
    ]
    assert not editoriales, (
        "Contenido público declarado como variable de entorno: "
        + ", ".join(editoriales)
        + ". Va en config/clinic.json."
    )


def test_las_plantillas_no_se_despliegan():
    """`/templates/index.html` mostraría los marcadores `{{ }}` en crudo."""
    contenido = VERCELIGNORE.read_text(encoding="utf-8")
    assert re.search(r"^templates/", contenido, re.M), (
        ".vercelignore tiene que excluir templates/: el sitio servido es el "
        "HTML ya generado de la raíz"
    )


def test_la_configuracion_viaja_con_la_funcion_serverless():
    """`mailer.js` la necesita para firmar los correos con la marca."""
    vercel = json.loads(VERCEL.read_text(encoding="utf-8"))
    funcion = vercel["functions"]["api/leads.js"]
    assert "config" in funcion.get("includeFiles", ""), (
        "sin `includeFiles` la función podría desplegarse sin "
        "config/clinic.json y fallar al armar los correos"
    )


def test_la_direccion_anterior_de_la_politica_no_queda_en_404():
    """Estaba publicada y enlazada desde consentimientos ya registrados."""
    vercel = json.loads(VERCEL.read_text(encoding="utf-8"))
    destinos = {
        r["source"]: r["destination"] for r in vercel.get("redirects", [])
    }

    for vieja in ("/politica-privacidad", "/politica-privacidad.html"):
        assert vieja in destinos, f"falta el redirect de {vieja}"
        assert destinos[vieja] == "/politica-de-privacidad"

    rewrites = {r["source"]: r["destination"] for r in vercel.get("rewrites", [])}
    assert rewrites.get("/politica-de-privacidad") == "/politica-de-privacidad.html", (
        "la dirección canónica de la política necesita un rewrite explícito"
    )
