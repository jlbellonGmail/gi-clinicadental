"""El título de una etapa se declara una vez, no se adivina cuatro veces.

## El defecto

`Get-FeatureInfo` derivaba el título capitalizando el slug:
`identidad-privacidad-white-label` → `Identidad Privacidad White Label`.
Los dos índices dicen `Identidad, privacidad y white-label`, que es el
título correcto. `Assert-FeatureContract` compara uno contra otro, así que
el contrato **solo pasaba si quien invocaba el script se acordaba de pasar
`-Title` con el texto exacto**. Si se olvidaba, fallaba contra índices bien
escritos, y la salida invitaba a "arreglar" el índice degradándolo al
título derivado.

`ready-for-pr.ps1` lo empeoraba: obtenía el título de documentación
recortándole el prefijo al de la PR con

    $Title -replace "^Feature [0-9]{2}-", ""

un patrón que solo contempla hitos `NN-`. Para una release de
mantenimiento `vX.Y.Z-slug` no recortaba nada y el título de
documentación quedaba en `Feature v1.0.1-identidad-privacidad-white-label`.
El contrato no podía pasar por ninguna vía.

## La corrección

`scripts/feature-titles.json` declara el título canónico. Lo consultan
`Get-FeatureInfo` y, a través de él, `Assert-FeatureContract`,
`ready-for-pr.ps1` y `update-doc-indexes.ps1`. El título de la PR y el de
la documentación quedaron separados: `-Title` es de la PR, `-DocTitle` el
escape hatch de la documentación.
"""

import json
import re
import subprocess
from pathlib import Path

import pytest

from test_feature_contract_scripts import powershell

ROOT = Path(__file__).resolve().parents[1]

REGISTRO = ROOT / "scripts" / "feature-titles.json"
CONTRACT = ROOT / "scripts" / "feature-contract.ps1"
READY_FOR_PR = ROOT / "scripts" / "ready-for-pr.ps1"

SLUG = "v1.0.1-identidad-privacidad-white-label"
DOC_SLUG = "identidad-privacidad-white-label"


def registro() -> dict:
    return json.loads(REGISTRO.read_text(encoding="utf-8"))["titulos"]


def titulo_en_indice(area: str) -> str:
    indice = (ROOT / "docs" / area / "index.md").read_text(encoding="utf-8")
    encontrado = re.search(rf"(?m)^- \[([^\]]+)\]\({DOC_SLUG}\.md\)\s*$", indice)
    assert encontrado, f"docs/{area}/index.md no enlaza {DOC_SLUG}.md"
    return encontrado.group(1)


def test_esta_release_declara_su_titulo_canonico():
    assert SLUG in registro(), (
        f"'{SLUG}' no declara título canónico en scripts/feature-titles.json"
    )


@pytest.mark.parametrize("area", ["tecnica", "usuario"])
def test_el_titulo_declarado_es_el_que_llevan_los_indices(area):
    """Los índices no se degradan al título derivado; el registro los sigue."""
    assert titulo_en_indice(area) == registro()[SLUG], (
        f"docs/{area}/index.md dice '{titulo_en_indice(area)}' y el registro "
        f"declara '{registro()[SLUG]}'"
    )


def test_los_dos_indices_coinciden_entre_si():
    assert titulo_en_indice("tecnica") == titulo_en_indice("usuario"), (
        "los dos índices usan títulos distintos para la misma etapa; "
        "Assert-FeatureContract exige el mismo en ambos"
    )


def test_el_titulo_canonico_no_es_el_derivado_del_slug():
    """Verificación en negativo: si fueran iguales, esto no probaría nada.

    El registro existe justamente porque el derivado es peor. Si algún día
    coincidieran, los demás tests de este archivo pasarían por accidente.
    """
    derivado = " ".join(p.capitalize() for p in DOC_SLUG.split("-"))
    assert registro()[SLUG] != derivado, (
        "el título canónico coincide con el derivado del slug: estos tests "
        "dejarían de demostrar que el registro se está usando"
    )


def run_ps(comando: str):
    return subprocess.run(
        [powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", comando],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_get_feature_info_resuelve_el_titulo_sin_que_se_lo_pasen():
    """El punto de todo el cambio: no depender de la memoria del invocante."""
    resultado = run_ps(
        f". ./scripts/feature-contract.ps1; (Get-FeatureInfo -Slug '{SLUG}').Title"
    )
    assert resultado.returncode == 0, resultado.stderr
    assert resultado.stdout.strip() == registro()[SLUG], (
        f"Get-FeatureInfo devolvió '{resultado.stdout.strip()}'"
    )


def test_el_contrato_pasa_sin_titulo_explicito():
    resultado = run_ps(
        f". ./scripts/feature-contract.ps1; Assert-FeatureContract -Slug '{SLUG}'"
    )
    assert resultado.returncode == 0, (
        "Assert-FeatureContract falla si no se le pasa el título a mano:\n"
        + resultado.stderr
    )


def test_un_titulo_explicito_sigue_ganandole_al_registro():
    """El escape hatch tiene que seguir existiendo."""
    resultado = run_ps(
        f". ./scripts/feature-contract.ps1; (Get-FeatureInfo -Slug '{SLUG}' -Title 'Otro').Title"
    )
    assert resultado.returncode == 0, resultado.stderr
    assert resultado.stdout.strip() == "Otro"


def test_una_etapa_sin_entrada_cae_al_titulo_derivado():
    """Las etapas históricas no cambian de comportamiento."""
    resultado = run_ps(
        ". ./scripts/feature-contract.ps1; (Get-FeatureInfo -Slug '98-etapa-inventada').Title"
    )
    assert resultado.returncode == 0, resultado.stderr
    assert resultado.stdout.strip() == "Etapa Inventada"


def test_ready_for_pr_ya_no_recorta_el_titulo_con_un_patron_de_hito():
    """El `-replace "^Feature [0-9]{2}-"` era ciego a `vX.Y.Z-`."""
    fuente = READY_FOR_PR.read_text(encoding="utf-8")
    codigo = re.sub(r"(?m)^\s*#.*$", "", fuente)
    assert "-replace \"^Feature [0-9]{2}-\"" not in codigo, (
        "sigue derivando el título de documentación del título de la PR con un "
        "patrón que solo contempla hitos NN-"
    )


def test_ready_for_pr_separa_el_titulo_de_la_pr_del_de_la_documentacion():
    fuente = READY_FOR_PR.read_text(encoding="utf-8")
    assert "$DocTitle" in fuente, "no expone -DocTitle"
    assert "\"--title\", $prTitle" in fuente, (
        "la PR debería titularse con $prTitle, no con la variable que alimenta el contrato"
    )


def test_el_registro_no_declara_titulos_vacios():
    for slug, titulo in registro().items():
        assert titulo and titulo.strip(), f"'{slug}' declara un título vacío"
