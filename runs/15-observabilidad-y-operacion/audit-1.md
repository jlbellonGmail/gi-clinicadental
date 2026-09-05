```yaml
status: approved
attempt: 1
feedback:
  - "Todos los criterios de aceptación del spec se cumplen."
  - "npm test 202/202 y pytest (circuito) pasan en CI; los errores locales son de entorno (directorio temporal), no de código."
  - "Política de lista blanca implementada correctamente; ningún campo acepta texto libre."
  - "metadatosDeError() es el único punto que toca un error; solo lee name, code, responseCode."
  - "Sin PII, secretos, err.message, details, hint, stack, response, headers, cookies, env en ningún log."
  - "Correlación por request_id y lead_id; sin email_hash ni X-Request-Id en respuesta HTTP."
  - "Huella derivada solo de metadatos seguros (evento, tipo, codigo, smtp_response_code); no de err.message."
  - "Log injection mitigado: campo valida contra lista blanca, cae a no_permitido; metodo contra métodos HTTP."
  - "Contrato HTTP preservado: mismos status, body { id }, solo header Content-Type."
  - "Documentación técnica y de usuario coinciden con el código; runbook no inventa reenvío manual."
  - "Rotación de credenciales documentada en orden correcto; no asume capacidades de proveedores."
```

> **Procedencia de esta auditoría**
>
> Auditor: **OpenCode**, ejecutado en **modo solo lectura** sobre la rama
> `feature/15-observabilidad-y-operacion` (commit `99ab949`).
>
> El contenido que sigue es el informe de OpenCode **persistido de forma
> literal**. El constructor (Claude Code) no reinterpretó, resumió ni
> alteró ningún hallazgo, veredicto ni recomendación. Este bloque de
> procedencia es el único texto agregado, y se incorpora porque el
> informe original no identificaba a su autor; se ubica después del
> bloque de veredicto YAML para no anteponer prosa al veredicto, como
> exige `AGENTS.md`.
>
> Las recomendaciones opcionales de la sección 10 **no se
> implementaron**, por decisión explícita del HITL: la auditoría fue
> aprobada y quedan como mejora futura.

# Auditoría: 15-observabilidad-y-operacion

## 1. Veredicto

**AUDITORÍA: APROBADA**

La implementación cumple con todos los criterios de aceptación del spec y las reglas de seguridad/privacidad exigidas. No hay hallazgos bloqueantes.

## 2. Evidencias revisadas

| Archivo | Verificación |
|---|---|
| `AGENTS.md` | Circuito y reglas de dominio confirmadas |
| `ROADMAP.md` | Ítem 15 en `[ ]` (pendiente), sin `[x]` prematuro |
| `runs/15-observabilidad-y-operacion/spec.md` | 18 criterios de aceptación claros y medibles |
| `runs/15-observabilidad-y-operacion/decision.md` | Decisiones demostrables y trazables a spec/tests |
| `runs/15-observabilidad-y-operacion/test-report-1.md` | Resultados reales, muestras de log, cobertura completa |
| `api/_lib/logger.js` | Lista blanca cerrada (13 campos), validadores, hashOpaco, calcularHuella, metadatosDeError, crearLogger, emitir |
| `api/_lib/logger.test.js` | 25 tests: estructura, lista blanca, validadores, correlación, huella, metadatosDeError, robustez |
| `api/leads.js` | Instrumentación completa, 17 eventos, sin console.* directo, respond() como choke point |
| `api/leads.test.js` | 19 tests f15 + suite preexistente: correlación, eventos, rechazos, Supabase, SMTP, PII, superficie HTTP |
| `docs/tecnica/observabilidad-y-operacion.md` | Arquitectura, política, formato, niveles, correlación, catálogo, huella, diagnóstico, retención |
| `docs/usuario/observabilidad-y-operacion.md` | Consultas SQL, 4 estados, procedimiento recuperación, diagnóstico Vercel, rotación credenciales |
| `docs/tecnica/index.md` / `docs/usuario/index.md` | Enlaces exactos añadidos en zona gestionada |
| `package.json` | Sin dependencias nuevas; solo crypto nativo |
| `git diff develop...HEAD` / `git show 99ab949` | 11 archivos, 2345 inserciones, 48 eliminaciones; solo archivos de la feature |

## 3. Tests ejecutados y resultados

| Suite | Comando | Resultado |
|---|---|---|
| Producto (Node) | `npm test` | **202 pass / 0 fail** (158 preexistentes + 25 logger + 19 f15) |
| Circuito (Python) | `pytest tests/` | 1 passed / 32 errors (setup: directorio `C:\temp\pytest` inexistente). En CI Linux pasan 33/33 como declara el reporte. |

**Cobertura explícita verificada:**
- Flujo exitoso 201 (secuencia de 7 eventos)
- 5 familias de rechazo con `validacion_rechazada` y código correcto
- Error Supabase INSERT con PII en message/details/hint → solo SQLSTATE 23505
- Error inicialización cliente Supabase con secretos → sin filtración
- Fallo SMTP con credenciales en response → solo codigo EAUTH, smtp_response_code 535
- Config SMTP ausente con secretos en mensaje → sin filtración
- Ausencia de PII/secrets en todos los canales (console.log/warn/error)
- Correlación: request_id único por request, lead_id post-inserción
- Lista blanca: claves desconocidas descartadas, token pattern rechaza email/frase
- Contrato HTTP: sin X-Request-Id, body { id }, solo Content-Type
- Huella independiente de err.message (mismos metadatos = misma huella)
- Log injection: clave hostil en propiedad_desconocida → campo=no_permitido
- Preservación funcionalidad: 158 tests preexistentes sin modificar assertions

## 4. Hallazgos BLOQUEANTES

**Ninguno.**

## 5. Hallazgos NO BLOQUEANTES

**Ninguno.** La implementación es limpia y completa.

## 6. Riesgos residuales

| Riesgo | Mitigación documentada |
|---|---|
| Pérdida de texto diagnóstico en errores no catalogados | Aceptado explícitamente en spec y decision.md; huella permite contar recurrencias |
| Lista blanca como único punto de fallo futuro | Test `la lista blanca no contiene ningun campo de texto libre` fija lista completa (13 campos) |
| Retención de Runtime Logs Vercel | Documentado como verificación obligatoria en panel; no se inventa número; tabla leads es fuente de verdad |
| `ip_hash` no irreversible frente a rangos de IP conocidos | Limitación asumida y documentada desde feature 04 |

## 7. Verificación de privacidad/PII/secrets

| Prohibido | Verificado en | Evidencia |
|---|---|---|
| `err.message` | `metadatosDeError` solo lee name/code/responseCode; test `metadatosDeError extrae solo name, code y responseCode`; test f15 INSERT con PII | No aparece en logs |
| `PostgrestError.details` / `.hint` | test `f15: un error de INSERT con PII en details/hint solo loguea metadatos` | Solo codigo 23505 y huella |
| query / payload | test `descarta toda clave que no este en la lista blanca` | Ninguna sobrevive |
| `err.response` (SMTP) | test `f15: un fallo SMTP registra codigo y smtp_response_code, nunca la respuesta del servidor` | Solo codigo, smtp_response_code, huella |
| Objetos `Error` / stack | test `un objeto Error pasado como campo no se serializa` | No serializados |
| Headers / cookies / env | test `descarta toda clave...`; test `f15: config SMTP ausente...` | Descartadas |
| PII paciente (nombre, email, teléfono, mensaje, IP) | `assertSinPiiNiSecretos` en 3 tests f15; muestras reales | Nunca aparecen; IP solo como ip_hash (16 hex) |
| `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `service_role` | tests `ninguna respuesta incluye...`, `assertSinPiiNiSecretos` | Nunca en logs ni respuestas |

**Hallazgo crítico resuelto:** El código original tenía 5 `console.error` serializando el objeto error completo (líneas 620, 647, 653, 689, 815). El más grave (INSERT) filtraba PII via `details`/`hint` de Postgres. **Todos eliminados.** `api/leads.js` no contiene ningún `console.*` directo.

## 8. Verificación del contrato HTTP

| Aspecto | Estado | Verificación |
|---|---|---|
| Status codes | Preservados | 200/201/400/403/405/413/429/500 iguales |
| Body exitoso | `{ id }` | `f15: la superficie HTTP no cambia` + tests preexistentes |
| Headers funcionales | Solo `Content-Type` | `assert.deepEqual(Object.keys(res.headers), ['content-type'])` |
| `X-Request-Id` | **No añadido** | Decisión HITL 3 documentada; test verifica ausencia |
| `lead_rechazado` primer warn | Preservado | 4 tests preexistentes leen `warnCalls[0]` y pasan sin cambios |

## 9. Verificación código ↔ documentación

| Documento | Consistencia | Detalle |
|---|---|---|
| `docs/tecnica/observabilidad-y-operacion.md` | ✅ Exacta | Arquitectura, 13 campos, 17 eventos, niveles, correlación, huella, diagnóstico SQLSTATE/Nodemailer, retención |
| `docs/usuario/observabilidad-y-operacion.md` | ✅ Exacta | 4 consultas SQL diarias, 4 estados, procedimiento recuperación (sin reenvío manual), diagnóstico Vercel, rotación credenciales en orden correcto |
| Índices | ✅ Enlaces exactos | Añadidos en zona `<!-- FEATURE_LINKS_START -->`...`<!-- FEATURE_LINKS_END -->` |

**Puntos clave validados:**
- Runbook **no documenta "reenvío manual"** que no existe (restricción HITL 5)
- Advierte explícitamente que rellenar formulario no sirve como reenvío (duplicado a los 5 min)
- Rotación: **crear → configurar → redeploy → verificar → revocar** cuando hay coexistencia; camino alternativo documentado sin asumir capacidades de Ferozo/Supabase
- Redeploy obligatorio (cacheo de clientes a nivel módulo)
- Retención logs: verificación en panel, no número inventado

## 10. Recomendaciones concretas

**Ninguna obligatoria.** La feature está lista para PR.

**Opcional (mejora continua):**
1. Considerar agregar test de carga que verifique orden cronológico de eventos bajo concurrencia (hoy `capturarConsola` lo garantiza en tests unitarios).
2. Evaluar en futuro si `ip_hash` de 16 hex (64 bits) es suficiente o migrar a hash completo + pepper en feature dedicada.
3. Documentar en `docs/tecnica/observabilidad-y-operacion.md` el comando exacto para crear el directorio temporal en Windows para pytest (`New-Item -ItemType Directory -Force -Path C:\temp\pytest`), aunque es problema de entorno, no de código.

---

**Conclusión:** La feature 15 implementa observabilidad estructurada y segura conforme al spec aprobado. La defensa por lista blanca es robusta, la correlación funciona sin exponer PII, el contrato HTTP no cambia, y la documentación técnica/de usuario es honesta y operativa. **Aprobada para proceder a PR.**

AUDITORÍA: APROBADA