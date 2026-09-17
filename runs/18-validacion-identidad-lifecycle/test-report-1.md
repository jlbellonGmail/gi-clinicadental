status: approved
attempt: 1
feedback: []

# Verificaciones locales

- `pytest -q`: 156 passed in 250.47s.
- `pytest -q tests/test_identity_contract.py tests/test_close_feature_script.py tests/test_nomenclatura_de_etapa.py`: 36 passed after one reproducible rerun of an environmental temporary-git permission error.
- `validate-unit-identities.ps1`: PASS; one active manifest validated and the historical closed manifest validated with its explicit compatibility rule.
- CI remoto: pendiente; no se declara PASS.
