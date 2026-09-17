status: approved
attempt: 5
feedback: []

# Validación final local

- `pytest -q`: 163 passed in 184.53s.
- Tests focalizados de identidad/cierre: 23 passed.
- `validate-unit-identities.ps1`: PASS; 1 manifiesto activo validado. Los
  manifiestos históricos CLOSED se inspeccionan con campos mínimos y regla
  explícita cuando están presentes en el checkout.
- CI remoto: pendiente; no se declara PASS.
