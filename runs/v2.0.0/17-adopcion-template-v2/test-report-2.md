status: approved
attempt: 2
feedback:
  - "pytest y Node pasan localmente con la CA legítima del sistema acotada al proceso."
  - "CI remoto permanece pendiente porque no hay push/PR autorizado."

# Reporte QA actualizado

- `pytest -q`: PASS, 150/150.
- `npm ping` con `NODE_OPTIONS=--use-system-ca`: PASS sobre HTTPS.
- `npm ci --no-audit --no-fund` con la misma opción de proceso: PASS, 50 paquetes.
- `npm test`: PASS, 337/337.
- `package.json` y `package-lock.json`: sin cambios.
- No se usó `strict-ssl=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` ni HTTP.
- CI remoto: PENDIENTE, sin push/PR.
