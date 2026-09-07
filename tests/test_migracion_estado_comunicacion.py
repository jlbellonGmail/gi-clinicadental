"""Guardas de la migración `estado_comunicacion`.

No hay PostgreSQL en CI, así que estos tests son **estructurales**: leen
el SQL y verifican las propiedades que se decidieron a conciencia. No
ejecutan la migración ni comprueban su efecto sobre datos reales.

Origen: la revisión humana del SQL antes de aplicarlo en Production
detectó dos defectos que ninguna herramienta automática miraba —el
backfill faltante y un `pg_constraint` sin anclar a la tabla—. Estas
guardas existen para que no vuelvan.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRACION = (
    ROOT
    / "supabase"
    / "migrations"
    / "20260907093000_add_estado_comunicacion.sql"
)

ESTADOS = ("pendiente", "completa", "requiere_revision", "resuelta_manual")


def sql() -> str:
    return MIGRACION.read_text(encoding="utf-8")


def sql_sin_comentarios() -> str:
    """El SQL efectivo. Un `public.leads` citado en un comentario no cuenta."""
    return "\n".join(
        linea.split("--")[0] for linea in sql().splitlines()
    )


def test_la_migracion_existe_y_declara_los_cuatro_estados():
    codigo = sql_sin_comentarios()
    assert "estado_comunicacion" in codigo
    for estado in ESTADOS:
        assert "'" + estado + "'" in codigo, "Falta el estado " + estado


def test_todas_las_sentencias_nombran_el_esquema():
    """`public.leads` explícito: no depender del `search_path`.

    Quien ejecute la migración puede tener otro `search_path`, y una tabla
    `leads` en otro esquema haría que la migración toque la tabla
    equivocada sin avisar.
    """
    codigo = sql_sin_comentarios()

    # Cada referencia a la tabla va precedida por `public.`; lo que queda
    # son nombres de objeto (constraint, índice), que no son referencias.
    permitidos = {"leads_estado_comunicacion_check", "leads_requieren_revision_idx"}
    huerfanas = []
    calificadas = 0
    for coincidencia in re.finditer(r"[\w.]*\bleads\b[\w]*", codigo):
        texto = coincidencia.group(0)
        if texto.startswith("public.leads"):
            calificadas += 1
            continue
        if texto in permitidos:
            continue
        huerfanas.append(texto)

    assert not huerfanas, (
        "Referencias a `leads` sin esquema explícito: " + ", ".join(sorted(set(huerfanas)))
    )
    # Control del propio test: si el parser dejara de encontrar nada, la
    # ausencia de huérfanas no probaría absolutamente nada.
    assert calificadas >= 4, (
        "El parser encontró solo "
        + str(calificadas)
        + " referencias a `public.leads`; la migración debería tener al "
        "menos cuatro (columna, constraint, backfill, índice)."
    )


def test_el_constraint_se_verifica_contra_esta_tabla_y_no_solo_por_nombre():
    """Buscar solo por `conname` puede dar un falso positivo.

    `pg_constraint` es global: si otra tabla —de este esquema o de
    cualquier otro— tuviera un constraint con el mismo nombre, la
    migración se saltaría el CHECK creyendo que ya existe, y la columna
    quedaría sin validar.
    """
    codigo = sql_sin_comentarios()
    assert "pg_constraint" in codigo, "Falta la comprobación de existencia del constraint"
    assert "conrelid" in codigo, (
        "La comprobación sobre `pg_constraint` tiene que anclarse a la "
        "tabla con `conrelid`, no confiar solo en el nombre."
    )
    assert re.search(
        r"conrelid\s*=\s*'public\.leads'::regclass", codigo
    ), "El `conrelid` debe compararse contra `'public.leads'::regclass`"


def test_hay_backfill_de_las_filas_historicas():
    """Sin backfill, todo lead anterior queda mintiendo.

    `pendiente` significa "el proceso de notificaciones todavía no
    terminó". En una fila de hace semanas terminó hace tiempo, y su
    resultado se conoce: está en los dos flags.
    """
    codigo = sql_sin_comentarios()
    assert re.search(r"update\s+public\.leads", codigo, re.I), (
        "Falta el UPDATE de backfill sobre `public.leads`"
    )
    assert "notificacion_clinica_enviada" in codigo
    assert "confirmacion_paciente_enviada" in codigo


def test_el_backfill_es_conservador_con_los_null():
    """`is not true` y no `= false`.

    Un flag en `null` no es una notificación enviada. Tratarlo como
    `completa` dejaría invisible un lead cuya notificación quizá falló.
    """
    codigo = sql_sin_comentarios()
    backfill = codigo[codigo.lower().index("update"):]
    assert re.search(r"is\s+true", backfill, re.I), (
        "La condición de `completa` debe exigir `is true` explícito"
    )
    assert not re.search(r"=\s*false", backfill, re.I), (
        "Comparar con `= false` deja los `null` fuera de la regla. Usar "
        "`is true` para exigir el positivo explícito."
    )


def test_el_backfill_solo_toca_las_filas_todavia_pendientes():
    """Reejecución segura: no pisa lo que ya se clasificó.

    En una segunda corrida, una fila que la clínica marcó
    `resuelta_manual` no puede volver a `requiere_revision`.
    """
    codigo = sql_sin_comentarios()
    backfill = codigo[codigo.lower().index("update"):]
    assert re.search(
        r"where\s+estado_comunicacion\s*=\s*'pendiente'", backfill, re.I
    ), (
        "El backfill debe acotarse a las filas que siguen en `pendiente`, "
        "o una reejecución pisaría los estados ya resueltos."
    )


def test_la_migracion_es_reejecutable():
    codigo = sql_sin_comentarios()
    assert re.search(r"add column if not exists", codigo, re.I)
    assert re.search(r"create index if not exists", codigo, re.I)
    assert re.search(r"if not exists\s*\(\s*select 1\s*from pg_constraint", codigo, re.I | re.S), (
        "El constraint necesita su guarda condicional: `if not exists` no "
        "aplica a `add constraint`."
    )


def test_la_cola_operativa_excluye_los_leads_descartados():
    """Un lead descartado no necesita que nadie lo persiga.

    La exclusión vive en el índice y en la consulta, **no** en el
    backfill: `estado_comunicacion` sigue diciendo lo que realmente pasó
    con la notificación. Sobrescribirlo con `resuelta_manual` afirmaría
    que alguien gestionó esa comunicación —lo que no es cierto— y borraría
    el dato.
    """
    codigo = sql_sin_comentarios()
    indice = codigo[codigo.lower().index("create index"):]
    assert "estado_comunicacion = 'requiere_revision'" in indice
    assert re.search(r"estado\s*<>\s*'descartado'", indice), (
        "El índice parcial de la cola operativa debe excluir los "
        "`descartado`."
    )

    # Y el backfill NO debe mirar `estado`: son dos ejes independientes.
    backfill = codigo[codigo.lower().index("update"):codigo.lower().index("create index")]
    assert "'descartado'" not in backfill, (
        "El backfill no debe clasificar según el estado comercial: "
        "mezclaría los dos ciclos de vida."
    )


def test_el_indice_se_recrea_para_que_el_predicado_sea_el_vigente():
    """`create index if not exists` no actualiza un índice ya existente.

    Una corrida anterior pudo dejarlo con el predicado viejo, sin la
    exclusión de `descartado`.
    """
    codigo = sql_sin_comentarios()
    assert re.search(
        r"drop index if exists\s+public\.leads_requieren_revision_idx", codigo, re.I
    ), "El índice debe recrearse, no solo crearse si falta"
    assert codigo.lower().index("drop index") < codigo.lower().index("create index")


def test_la_consulta_documentada_coincide_con_el_indice():
    """Si la consulta y el índice divergen, el índice deja de servir."""
    doc = (ROOT / "docs" / "tecnica" / "estado-comunicacion-leads.md").read_text(
        encoding="utf-8"
    )
    assert re.search(r"estado\s*<>\s*'descartado'", doc), (
        "La consulta operativa documentada debe excluir los `descartado`, "
        "igual que el índice parcial."
    )
