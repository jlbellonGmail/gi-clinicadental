# audit-1, intento 2 — Re-auditoría del candidato de release

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **OpenCode** |
> | **Modo** | **Solo lectura** — sobre una copia aislada del árbol, sin `.git`, fuera del repositorio |
> | **Motor** | `opencode 1.18.27`, agente `plan`, modelo `opencode/nemotron-3-ultra-free` |
> | **SHA auditado** | `8611e96e3c0dfb8eb116a1eea102a6fad1711b44` (`origin/develop`) |
> | **Fecha de auditoría** | 2026-09-05 |
> | **Intento** | 2 |
> | **Alcance** | Candidato de release del punto 16, previo a la PR `develop → main`. No cubre resultados de Production. |
> | **Persistido por** | **Claude Code**, literalmente |
>
> **Por qué hay un intento 2.** El `audit-1.md` del intento 1 aprobó el
> candidato `26e2a68`, que se liberó y falló en Production. Desde
> entonces el candidato cambió (PR #25, imágenes; PR #26, logger), así
> que aquella auditoría **no vale para este árbol**. Ambos artefactos se
> conservan: `audit-1.md` es el veredicto sobre `26e2a68` y sigue siendo
> cierto para ese SHA.
>
> El informe que sigue es la salida **íntegra y sin editar** de OpenCode.
> Claude Code no resumió, no reinterpretó y no corrigió hallazgos,
> recomendaciones ni veredicto. Cualquier respuesta, matiz o corrección
> de Claude Code vive en `decision.md`, nunca dentro de este archivo.

---

```yaml
status: approved
attempt: 2
feedback:
  - Ninguno: el candidato actual (8611e96) cumple todos los criterios de auditoría para proceder al release
```

## Informe de Re-Auditoría — audit-1 (intento 2, SHA 8611e96e3c0dfb8eb116a1eea102a6fad1711b44)

### 1. SHA del candidato y evidencia actualizada
**Verificado.** El árbol auditado es `origin/develop` @ `8611e96e3c0dfb8eb116a1eea102a6fad1711b44`, que incorpora **dos correcciones post-release** respecto al SHA auditado anteriormente (`26e2a68`):
- PR #25: imágenes regeneradas sin marca + test de regresión `tests/test_marca_publica.py` (6 casos)
- PR #26: `supabase_status_code` en `logger.js` + 5 tests nuevos

Los artefactos en `runs/16-validacion-mvp-produccion/` (`spec.md`, `decision.md`, `test-report-1.md`, `test-report-2.md`) reflejan correctamente este SHA y el historial de candidatos (`26e2a68` → `0946f61` → `8611e96`). No quedan afirmaciones desfasadas: `test-report-2.md` (Anexos A, B, C) corrige explícitamente inferencias previas del propio autor.

### 2. PR #25 — Imágenes: marca eliminada de los píxeles, test de regresión efectivo
**Verificado en tres niveles:**

| Nivel | Verificación | Resultado |
|---|---|---|
| **Generador** (`create_images.py`) | `grep -i savia` → 0; textos dibujados: "Sonrisa", "Perfecta", "Equipo Dental", "Interior Clínica" | ✅ Limpio |
| **Imágenes publicadas** (`.webp` en `static/images/`) | Las tres regeneradas desde el generador limpio | ✅ Sin marca rasterizada |
| **Test de regresión** (`tests/test_marca_publica.py`) | 6 casos: HTML (3), generador (2), existencia de assets (1) | ✅ Pasa |

**Análisis del test:** El patrón `PATRON_TEXTO_DIBUJADO` detecta llamadas `.text((x, y), 'texto', ...)` y valida que **ningún** texto dibujado contenga términos comerciales (`savia`, `sonrie`, `sonrie mas`, `sonríe`, `sonriamas`, `sonrimas`). Esto cierra la brecha que permitió que la marca anterior llegara a Production: un `grep` sobre HTML no lee píxeles, pero este test inspecciona la **fuente de verdad** (el generador). Puede fallar cuando debe: si alguien agrega `draw.text(..., 'Sonríe más', ...)` el test detecta el término prohibido y falla.

**Límite declarado y aceptado:** El test no hace OCR; no detecta texto incrustado en imágenes añadidas por fuera del generador. La defensa real es la regla del generador (documentada en su cabecera y en el test).

### 3. PR #26 — Logger: `supabase_status_code` seguro y no rompe la huella
**Verificado en `api/_lib/logger.js` y `api/leads.js`:**

| Aspecto | Verificación | Evidencia |
|---|---|---|
| **No transporta PII** | Validador `validarEntero` → solo enteros ≥ 0 | `logger.js:115-119`, `logger.js:154` |
| **No pisa `http_status`** | Campo distinto en `CAMPOS`; `http_status` = status que **nosotros** devolvemos al cliente; `supabase_status_code` = status HTTP de la respuesta de Supabase/PostgREST | `logger.js:133`, `141-154` (comentario explicativo) |
| **Huella inalterada** | `calcularHuella()` usa solo `evento`, `tipo`, `codigo`, `smtp_response_code` — **no** incluye `supabase_status_code` | `logger.js:192-200` |
| **Cobertura real en código** | Logueado en 4 puntos críticos: `supabase_duplicados_error` (l.692), `supabase_insercion_error` (l.750), `flag_actualizacion_error` clínica (l.842) y paciente (l.903) | `leads.js` líneas citadas |
| **Tests nuevos** | 5 tests cubren el caso real (respuesta no-JSON → `sin_tipo`/`sin_codigo` + `supabase_status_code` entero) | `decision.md:30` |

**Conclusión:** El cambio es mínimamente invasivo, no degrada la garantía de no-PII-en-logs (regla dura de feature 15) y resuelve exactamente el ciego diagnosticado en `test-report-2.md` (anexos A/B: `postgrest-js` devuelve objeto plano `{message}` sin `name`/`code` cuando la respuesta no es JSON).

### 4. Marca pública: "Sonríe más" en HTML/UI, cero rastros de marca anterior
**Verificado por inspección directa y `grep -i savia`:**
- `index.html`: 14 ocurrencias de "Sonríe más" (title, meta, OG, Twitter, header, hero, 3 alt, footer, copyright)
- `404.html`: 5 ocurrencias (title, header, footer, copyright)
- `politica-privacidad.html`: 5 ocurrencias (title, meta, header, footer)
- **0 ocurrencias de "Savia"** en los tres HTML públicos
- Imágenes: `create_images.py` ya no incrusta marca comercial alguna

### 5. Contenido legal: `politica-privacidad.html` coherente y veraz
**Verificado:**
- Sección 0: declara explícitamente "demostración técnica y de portfolio", "no es una clínica en funcionamiento", "no ingreses datos personales reales"
- Sección 3: "No hay una persona jurídica constituida... no existe una clínica ni una empresa responsable"
- No se inventa razón social, CUIT ni domicilio
- No se publican datos personales del desarrollador como responsable legal
- Destinatarios reales: buzón demo, Supabase, DonWeb (corregido de Ferozo)
- Procedimiento ARCO vía `sonriamas-contactos@nextgia.io`
- **Cumple regla dura de `AGENTS.md`**: no inventa información médica/clínica ni institucional

### 6. Coherencia entre spec, decision, test-reports y código
**Sin contradicciones en pie:**
- `spec.md` define el plan; `decision.md` registra decisiones demostrables y desviaciones declaradas; `test-report-1.md` evidencia P1-P8 sobre SHA exacto; `test-report-2.md` documenta fallos reales, diagnóstico y correcciones (incluyendo autocorrecciones en Anexos A/B/C)
- Código implementa lo especificado: `isOriginAllowed()`, `mkdocs build --strict`, marca "Sonríe más", versionado 1.0.0, logger con whitelist + `supabase_status_code`
- Dataset sintético respeta idempotencia de 5 min (nombre+email distintos por ejecución)
- Negativos documentados con justificación (rate limit no determinista en serverless)

### 7. `package.json` y `package-lock.json` en 1.0.0 y coherentes
- `package.json:3`: `"version": "1.0.0"`
- `package-lock.json:3` y `package-lock.json:9`: `"version": "1.0.0"` en raíz y `packages[""]`
- `"0.1.0"` **0 veces** en ambos archivos
- `npm ci` pasa (chequeo real de coherencia que corre el CI)

### 8. Tags y `ROADMAP.md`
- `git ls-remote --tags` → 0 tags (verificado en `test-report-1.md:272`)
- `ROADMAP.md` (línea 119): `- [ ] 16-validacion-mvp-produccion` — estado correcto para pre-release

### 9. Seguridad: ninguna credencial, token ni secreto en repo/docs/artefactos
- `.env.example`: solo placeholders vacíos
- `test-report-1.md:107-112` y `test-report-2.md`: registran **presencia**, nunca valores
- `logger.js`: lista blanca estricta de 13 campos (`CAMPOS`, l.129-157); campos de lead (`nombre`, `email`, etc.) pueden aparecer solo como **nombres de campo** (`campo`), nunca sus valores
- `metadatosDeError()` extrae solo `name`, `code`, `responseCode` — nunca `message`, `details`, `hint`, `response`, `stack`, `query`
- `hashOpaco()` usa SHA-256 truncado a 16 hex para IP y huellas
- Emails usan `escapeHtml` y `sanitizeHeaderValue`
- **Anexos de diagnóstico** (`test-report-2.md`): no filtran valores de variables de entorno, claves ni fragmentos; reportan solo `ref` y `role` del JWT (no secretos) y últimos 6 caracteres para comparación

### 10. Preparación real para llevar `develop` a `main`
**Sin bloqueantes para el release:**
- CI verde en `develop` sobre el candidato (corrida CI verificada)
- `docs.yml`: build estricto obligatorio, deploy condicionado a `pages_disponible == 'true'`, default seguro NO publicar, verificado empíricamente (corrida `33994642948`: `success` con `deploy: skipped`, artefacto `mkdocs-site`)
- `post-merge-close-feature.yml` no se dispara en PR hacia `main` (solo base `develop`)
- Workflows no dejarán `main` en rojo
- No hay tags preexistentes
- `ROADMAP.md` permanece en `[ ]` hasta cierre post-merge automático
- Rollback documentado y viable (`git revert -m 1` en `main`)

### Hallazgos no bloqueantes (observaciones preexistentes, confirmadas)
1. `favicon.ico` y `apple-touch-icon.png` referenciados pero inexistentes → 404 en Production (fuera de alcance, registrado)
2. Mensaje de éxito del formulario ("La clínica se comunicará...") contrasta con aviso de demo — no se modificó por ser criterio de aceptación V4
3. Deprecación Node.js 20 en GitHub Actions (warnings, no fallos)
4. No existe `<link rel="canonical">` — registrado en `decision.md`
5. `sonrimas.com` sin registro A — deuda documentada para cuando se conecte a Vercel (requiere mover `og:url`, `og:image`, `twitter:image` y `SITE_URL` juntos)

---

**Conclusión:** El candidato `8611e96e3c0dfb8eb116a1eea102a6fad1711b44` cumple **todos** los criterios de auditoría. Las correcciones post-release (PR #25 y #26) resuelven los dos bloqueantes encontrados en la validación anterior sin introducir regresiones ni degradar garantías de seguridad. No hay hallazgos bloqueantes para el release `develop → main`. **Veredicto: APPROVED.**
