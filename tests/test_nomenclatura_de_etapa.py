"""Nomenclatura de etapas: hitos y releases de mantenimiento.

El circuito identificaba una etapa **solo** como `NN-slug`, con `NN` de
dos dígitos. Eso obligaba a que cualquier corrección sobre una versión ya
publicada consumiera un número de hito del roadmap, y en este proyecto
esos números están reservados: H17 en adelante pertenece a la v2.0.0.

Se agregó una segunda forma válida, `vX.Y.Z-slug`, con el **mismo
contrato** que un hito: mismos artefactos, misma documentación, mismo
cierre post-merge. Estos tests fijan las dos formas y, sobre todo, que lo
que no es ninguna de las dos siga siendo rechazado — una validación que
acepta cualquier cosa no valida nada.
"""

import re
import subprocess
from pathlib import Path

import pytest

from test_feature_contract_scripts import powershell

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "scripts" / "feature-contract.ps1"
WORKFLOW = ROOT / ".github" / "workflows" / "post-merge-close-feature.yml"
ROADMAP = ROOT / "ROADMAP.md"

ACEPTADOS = [
    ("01-configuracion-variables-entorno", "configuracion-variables-entorno"),
    ("16-validacion-mvp-produccion", "validacion-mvp-produccion"),
    ("99-personalizacion-wiki", "personalizacion-wiki"),
    ("v1.0.1-identidad-privacidad-white-label", "identidad-privacidad-white-label"),
    ("v2.10.3-una-correccion", "una-correccion"),
]

RECHAZADOS = [
    "1.0.1-sin-la-v",
    "v1-solo-mayor",
    "v1.0-sin-parche",
    "sin-numero-ni-version",
    "7-un-solo-digito",
    "17-Con-Mayusculas",
    "v1.0.1_guion_bajo",
    "v1.0.1-",
]


def info_de_etapa(slug: str):
    """Ejecuta `Get-FeatureInfo` y devuelve (codigo, stdout, stderr)."""
    comando = (
        f". '{CONTRACT}'; "
        f"$i = Get-FeatureInfo -Slug '{slug}'; "
        "Write-Output $i.DocSlug; Write-Output $i.RunDir"
    )
    resultado = subprocess.run(
        [powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", comando],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return resultado


@pytest.mark.parametrize("slug,doc_slug", ACEPTADOS)
def test_el_contrato_acepta_las_dos_formas(slug: str, doc_slug: str):
    resultado = info_de_etapa(slug)
    assert resultado.returncode == 0, (
        f"'{slug}' deberia ser valido. stderr: {resultado.stderr.strip()}"
    )
    salida = resultado.stdout.strip().splitlines()
    assert salida[0].strip() == doc_slug, (
        f"el slug de documentacion de '{slug}' deberia ser '{doc_slug}'"
    )
    assert salida[1].strip() == f"runs/{slug}", (
        "la carpeta de artefactos usa el identificador completo, no el slug corto"
    )


@pytest.mark.parametrize("slug", RECHAZADOS)
def test_el_contrato_sigue_rechazando_lo_que_no_es_ninguna_de_las_dos(slug: str):
    """Verificación en negativo de la ampliación.

    Sin esto no se sabría si el contrato acepta `vX.Y.Z-slug` o si dejó de
    validar el formato.
    """
    resultado = info_de_etapa(slug)
    assert resultado.returncode != 0, f"'{slug}' no deberia ser un identificador valido"
    assert "Slug invalido" in resultado.stderr, (
        f"el error de '{slug}' deberia decir que el slug es invalido: {resultado.stderr.strip()}"
    )


def test_el_mensaje_de_error_nombra_las_dos_formas():
    """Quien se equivoca tiene que enterarse de cuáles son las opciones."""
    resultado = info_de_etapa("formato-invalido")
    assert "NN-slug" in resultado.stderr
    assert "vX.Y.Z-slug" in resultado.stderr


def test_el_cierre_post_merge_reconoce_las_dos_formas():
    """El workflow deriva el slug de la rama con su propia expresión.

    Si acepta menos formas que el contrato, una release de mantenimiento
    se mergea pero su ROADMAP nunca se cierra solo.
    """
    contenido = WORKFLOW.read_text(encoding="utf-8")
    lineas = [linea for linea in contenido.splitlines() if "=~" in linea and "head_ref" in linea]
    assert len(lineas) == 1, (
        "se esperaba exactamente una expresion que derive el slug de la rama, "
        f"hay {len(lineas)}"
    )

    expresion = lineas[0]
    assert "[0-9]{2}" in expresion, "el workflow dejo de reconocer los hitos NN-slug"
    assert "v[0-9]+\\.[0-9]+\\.[0-9]+" in expresion, (
        "el workflow no reconoce feature/vX.Y.Z-slug: una release de "
        "mantenimiento quedaria sin cierre automatico de ROADMAP"
    )


def test_esta_release_no_ocupa_un_numero_de_hito():
    """H17 está reservado para la v2.0.0.

    El guard es concreto a propósito: comprueba que la etapa se llame por
    su versión y que no exista una entrada `17-` en el roadmap.
    """
    roadmap = ROADMAP.read_text(encoding="utf-8")

    assert re.search(
        r"(?m)^- \[[ x-]\] v1\.0\.1-identidad-privacidad-white-label\b", roadmap
    ), "la release de mantenimiento tiene que figurar por su version"

    numeradas = re.findall(r"(?m)^- \[[ x-]\] (\d{2})-", roadmap)
    assert "17" not in numeradas, (
        "hay una entrada 17-* en el ROADMAP: ese numero de hito esta "
        "reservado para 'UI/UX avanzada y profesional' de la v2.0.0"
    )


def test_los_artefactos_de_la_etapa_viven_bajo_el_nombre_de_release():
    directorio = ROOT / "runs" / "v1.0.1-identidad-privacidad-white-label"
    assert directorio.is_dir(), "falta la carpeta de artefactos de la release"

    for obligatorio in ("spec.md", "decision.md"):
        assert (directorio / obligatorio).is_file(), f"falta {obligatorio}"

    assert not (ROOT / "runs" / "17-identidad-privacidad-y-white-label").exists(), (
        "quedo la carpeta con el nombre numerado anterior"
    )


def test_ningun_documento_permanente_apunta_al_nombre_viejo():
    """Se buscan referencias de RUTA, no menciones en prosa.

    La primera versión de este guard prohibía la cadena
    `17-identidad-privacidad-y-white-label` en cualquier documento, y
    fallaba con el párrafo de `decision.md` que explica precisamente por
    qué se renombró. Un guard que se dispara con la prosa que lo documenta
    no comprueba lo que dice comprobar — y es la tercera vez que pasa en
    esta etapa, así que queda escrito.

    Lo que sí importa: que ningún enlace, ruta ni identificador **en uso**
    apunte al nombre viejo. Mencionarlo al contar la corrección es
    legítimo y necesario.

    El historial de Git queda fuera de alcance a propósito: los commits de
    construcción son anteriores a la corrección, llevan el identificador
    viejo en su mensaje, y no se reescribe historial para maquillarlo.
    """
    # `runs/17-` a secas, no `runs/17-identidad`: la spec traia
    # `runs/17-.../decision.md`, con el nombre elidido, y el patron mas
    # especifico no lo veia. Una ruta que empieza por `runs/17-` apunta al
    # nombre viejo aunque el resto este abreviado.
    patrones_de_ruta = [
        re.compile(r"runs/17-"),
        re.compile(r"docs/(tecnica|usuario)/identidad-privacidad-y-white-label"),
        re.compile(r"identidad-privacidad-y-white-label\.md"),
        re.compile(r"\]\(.*17-identidad"),
    ]

    sospechosos = []
    # Se barren los documentos que **describen el sistema**: la
    # documentacion publicada, el ROADMAP y las specs. Ahi una ruta al
    # nombre viejo es una referencia en uso, y esta mal.
    #
    # Quedan fuera las **actas del proceso** -`audit-N.md`,
    # `test-report-N.md` y `decision.md`-, que existen justamente para
    # narrar que se corrigio y por que. Citar `runs/17-...` al contar la
    # correccion no es apuntar al nombre viejo: es dejar constancia. Es la
    # misma razon por la que el historial de Git tampoco se barre, y los
    # `audit-N.md` tienen ademas la suya propia: son actas de un auditor
    # externo que se persisten literalmente y no se editan para que pase
    # un test.
    #
    # La distincion no puede hacerla el patron. En la spec, la cadena
    # `runs/17-.../decision.md` decia donde vive un artefacto requerido;
    # en decision.md, la misma cadena cuenta que ahi decia eso. Son
    # identicas como texto y opuestas como significado, asi que la separa
    # el tipo de documento.
    ACTAS = ("audit-", "test-report-", "decision.md")

    documentos = [
        d
        for d in list(ROOT.glob("docs/**/*.md")) + list(ROOT.glob("runs/**/*.md")) + [ROADMAP]
        if not d.name.startswith(ACTAS[:2]) and d.name != "decision.md"
    ]

    for ruta in documentos:
        texto = ruta.read_text(encoding="utf-8")
        for patron in patrones_de_ruta:
            if patron.search(texto):
                sospechosos.append(f"{ruta.relative_to(ROOT)}: {patron.pattern}")

    assert not sospechosos, (
        "documentos que apuntan a rutas del nombre viejo: " + ", ".join(sospechosos)
    )


def test_la_correccion_de_nomenclatura_queda_documentada():
    """No alcanza con renombrar en silencio.

    Verificación en negativo del test anterior: si aquel pasara porque no
    quedó rastro de la corrección, este falla.
    """
    decision = (
        ROOT / "runs" / "v1.0.1-identidad-privacidad-white-label" / "decision.md"
    ).read_text(encoding="utf-8")

    assert "17-identidad-privacidad-y-white-label" in decision, (
        "decision.md tiene que decir con qué nombre se construyó la etapa"
    )
    assert "H17" in decision, "decision.md tiene que explicar por qué ese número estaba reservado"


def test_la_exclusion_de_las_actas_no_es_una_via_de_escape():
    """El guard anterior no barre las actas del proceso. Esto sostiene por qué.

    Si mañana alguien mete una referencia de ruta al nombre viejo en un
    documento **descriptivo** creyendo que el guard ya no mira, este test
    demuestra que sí mira: el patrón funciona, y lo que se excluye es una
    clase de archivo concreta, por un motivo declarado y todavía vigente.
    """
    patron = re.compile(r"runs/17-")

    assert patron.search("ver runs/17-identidad/decision.md"), "el patrón no detecta la ruta"
    assert patron.search("runs/17-.../decision.md"), (
        "el patrón no detecta la forma elidida, que es la que se coló en spec.md"
    )
    assert not patron.search("la etapa 17 del roadmap"), "el patrón se dispara con prosa"

    etapa = ROOT / "runs" / "v1.0.1-identidad-privacidad-white-label"

    citan = [
        a
        for a in list(etapa.glob("audit-*.md")) + [etapa / "decision.md"]
        if a.is_file() and patron.search(a.read_text(encoding="utf-8"))
    ]
    assert citan, (
        "ninguna acta cita la ruta vieja: la exclusión dejó de tener motivo y "
        "hay que quitarla en vez de arrastrarla"
    )

    # Y el documento que tenía el defecto real quedó limpio.
    spec = (etapa / "spec.md").read_text(encoding="utf-8")
    assert not patron.search(spec), "la spec volvió a apuntar al nombre viejo"
