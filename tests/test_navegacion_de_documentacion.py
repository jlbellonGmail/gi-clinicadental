"""Ninguna página de documentación puede quedar sin forma de llegar a ella.

## Qué reportó MkDocs, exactamente

`mkdocs build --strict` termina en verde: **cero warnings**. Lo que emite
es un mensaje de nivel `INFO`:

    INFO - The following pages exist in the docs directory,
           but are not included in the "nav" configuration: ...

seguido de las 38 páginas de `docs/tecnica/` y `docs/usuario/`. `--strict`
convierte *warnings* en errores; un `INFO` no lo es, y por eso la
construcción nunca estuvo roja.

## Por qué están fuera de `nav`, y por qué se queda así

Es el diseño del repo, no un descuido. `nav` tiene tres entradas —inicio,
`tecnica/index.md`, `usuario/index.md`— y **son los dos índices los que
navegan**: `scripts/update-doc-indexes.ps1` mantiene sus enlaces y
`Assert-FeatureContract` exige que cada etapa aparezca en ambos con el
enlace exacto. Duplicar las 38 páginas dentro de `nav` obligaría a
mantener la misma lista en dos lugares que pueden separarse en silencio.

Tampoco se declara `not_in_nav` para silenciar el `INFO`: ese glob taparía
también las páginas que **de verdad** no son alcanzables, que es lo único
que ese mensaje sirve para detectar.

## Lo que sí se comprueba acá

La discoverability real: que cada página esté enlazada desde el índice de
su área. Eso es lo que `nav` daría, y es verificable sin duplicar listas.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

AREAS = ("tecnica", "usuario")

# Excepción heredada, anterior a la v1.0.1 y fuera de su alcance.
#
# `landing.md` documenta la landing original —el baseline previo a este
# circuito— y nunca entró en la zona FEATURE_LINKS de ningún índice,
# porque no vino de una etapa que corriera `update-doc-indexes.ps1`.
# Es la única página realmente inalcanzable de las 38, y lo era desde
# antes de esta release.
#
# No se corrige acá: agregarla exigiría tocar la región gestionada de los
# dos índices por una feature que no es esta. Queda declarada, con nombre
# y motivo, para que el guard no la tape y para que la próxima etapa que
# toque documentación de la landing la cierre.
HUERFANAS_HEREDADAS = {"landing.md"}


def paginas(area: str) -> set:
    return {p.name for p in (ROOT / "docs" / area).glob("*.md")} - {"index.md"}


def enlazadas(area: str) -> set:
    indice = (ROOT / "docs" / area / "index.md").read_text(encoding="utf-8")
    return set(re.findall(r"\]\(([^)]+\.md)\)", indice))


@pytest.mark.parametrize("area", AREAS)
def test_toda_pagina_esta_enlazada_desde_el_indice_de_su_area(area):
    huerfanas = paginas(area) - enlazadas(area) - HUERFANAS_HEREDADAS

    assert not huerfanas, (
        f"docs/{area}/ tiene páginas a las que no se llega desde ningún lado: "
        + ", ".join(sorted(huerfanas))
        + ". No están en `nav` —por diseño— y tampoco en el índice, así que "
        "quedan publicadas y sin ruta de acceso."
    )


@pytest.mark.parametrize("area", AREAS)
def test_la_excepcion_heredada_sigue_siendo_la_que_dice_ser(area):
    """Verificación en negativo de la lista de excepciones.

    Si alguien cierra `landing.md` en un índice, la excepción deja de
    tener sentido y hay que borrarla de la lista en vez de arrastrarla
    para siempre. Este test avisa en ese momento.
    """
    for nombre in HUERFANAS_HEREDADAS:
        assert (ROOT / "docs" / area / nombre).is_file(), (
            f"'{nombre}' figura como excepción heredada y ya no existe en docs/{area}/: "
            "sacala de HUERFANAS_HEREDADAS."
        )
        assert nombre not in enlazadas(area), (
            f"'{nombre}' ya está enlazada desde docs/{area}/index.md: "
            "sacala de HUERFANAS_HEREDADAS, la excepción quedó obsoleta."
        )


@pytest.mark.parametrize("area", AREAS)
def test_la_documentacion_de_esta_release_es_alcanzable(area):
    """Lo que introdujo la v1.0.1, comprobado aparte.

    Las dos páginas nuevas aparecen en el `INFO` de MkDocs junto con las
    otras 36, pero sí están enlazadas. El `INFO` no distingue entre
    'fuera de nav' e 'inalcanzable'; este test sí.
    """
    assert "identidad-privacidad-white-label.md" in enlazadas(area), (
        f"la documentación de la v1.0.1 no está enlazada desde docs/{area}/index.md"
    )


def test_el_nav_de_mkdocs_apunta_a_los_dos_indices():
    """Si `nav` deja de incluir un índice, las 36 páginas se caen con él.

    Todo el esquema depende de que los dos índices estén navegables.
    """
    mkdocs = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
    for area in AREAS:
        assert f"{area}/index.md" in mkdocs, (
            f"mkdocs.yml ya no navega docs/{area}/index.md, que es la única "
            f"puerta de entrada a las páginas de {area}/"
        )
