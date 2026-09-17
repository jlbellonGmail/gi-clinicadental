# audit-1 — Auditoría independiente del candidato de release

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **OpenCode** |
> | **Modo** | **Solo lectura** — sobre una copia aislada del árbol, sin `.git`, fuera del repositorio |
> | **Motor** | `opencode 1.18.27`, agente `plan`, modelo `opencode/nemotron-3-ultra-free` |
> | **SHA auditado** | `26e2a682bcb0eb635c9f2d3e69c1062968cd81dd` (`origin/develop`) |
> | **Fecha de auditoría** | 2026-09-05 |
> | **Alcance** | Candidato de release del punto 16, previo a la PR `develop → main`. No cubre resultados de Production: todavía no existen. |
> | **Persistido por** | **Claude Code**, literalmente |
>
> El informe que sigue es la salida **íntegra y sin editar** de OpenCode.
> Claude Code no resumió, no reinterpretó y no corrigió hallazgos,
> recomendaciones ni veredicto, ni siquiera la redacción o el preámbulo.
> Cualquier respuesta, matiz o desviación de proceso de Claude Code vive
> en `decision.md`, nunca dentro de este archivo.

---

Now I have all the information needed to perform the audit. Let me compile the findings.

```yaml
status: approved
attempt: 1
feedback:
  - Ninguno: el candidato de release cumple todos los criterios de auditoría para proceder al release
```

## Informe de Auditoría — audit-1 (SHA 26e2a682bcb0eb635c9f2d3e69c1062968cd81dd)

### 1. SHA del candidato
**Verificado.** `test-report-1.md:16` y `test-report-1.md:49` confirman que el candidato auditado es `26e2a682bcb0eb635c9f2d3e69c1062968cd81dd` (`origin/develop`). Dos candidatos previos (`60dbb6c`, `74297a7`) fueron reemplazados por PRs #22 y #23; la auditoría se ejecuta sobre el árbol exacto final.

### 2. Alcance del punto 16
**Coherente.** `ROADMAP.md:119` define el ítem 16 como validación funcional completa en Production. `spec.md` detalla el mismo alcance: release previo + validación V1-V12 + evidencia. No hay scope creep: las únicas modificaciones de producto son las correcciones acotadas pre-release (marca, OG, `docs.yml`, versionado npm) declaradas en `spec.md:87-207` y ejecutadas en ramas `release/v1.0.0-preparacion` y `fix/docs-pages-no-disponible`, fuera del patrón `feature/NN-slug` para no disparar el cierre automático.

### 3. Marca visible "Sonríe más"
**Verificado en los tres HTML públicos:**
- `index.html`: `<title>` (l.6), `meta description` (l.7), `og:title` (l.13), `og:description` (l.14), `og:site_name` (l.19), `twitter:title` (l.21), `twitter:description` (l.22), logo header (l.32), hero paragraph (l.53), 3 `alt` de imágenes (l.60, l.133, l.159), logo footer (l.215), copyright (l.246)
- `404.html`: `<title>` (l.6), logo header (l.15), logo footer (l.45), copyright (l.72)
- `politica-privacidad.html`: `<title>` (l.6), `meta description` (l.7), logo header (l.17), copyright (l.159)

**0 ocurrencias de "Savia Dental"** en los tres archivos (verificado por lectura directa y `test-report-1.md:245`).

### 4. Ausencia de "Savia Dental"
**Confirmado.** `grep -c "Savia"` → 0 en `index.html`, `404.html`, `politica-privacidad.html`. Los `.md` históricos en `docs/` y `runs/` conservan menciones descriptivas del estado anterior, lo cual es correcto (`AGENTS.md` prohíbe reescribir artefactos de otro agente).

### 5. Open Graph y Twitter Card
**Coherentes y con URLs absolutas:**
- `og:url`: `https://gi-clinicadental.vercel.app` (l.15) — coincide con `SITE_URL`/`ALLOWED_ORIGINS` del preflight P4
- `og:image`: `https://gi-clinicadental.vercel.app/static/images/paciente-sonrisa.webp` (l.17) — absoluta
- `twitter:image`: misma URL absoluta (l.23)
- `og:site_name`: "Sonríe más" (l.19)
- Twitter Card: `summary_large_image` (l.20)

La corrección alinea el metadato público con la configuración de backend (`isOriginAllowed()`), cerrando el riesgo R1.

### 6. `.github/workflows/docs.yml`
**Cumple todos los requisitos:**
- **Gate obligatorio**: `mkdocs build --strict` en job `build` sin condición (`docs.yml:69`). No hay `if:` que lo saltee.
- **Job `build` sin pasos de Pages**: solo checkout, setup-python, install, build estricto, upload artifact (`docs.yml:56-79`).
- **Deploy condicionado y seguro**: job `deploy` con `if: needs.build.outputs.pages_disponible == 'true'` (`docs.yml:104`). Paso de detección con `continue-on-error: true`; 404/403/fallo de red/salida vacía → `disponible=false` → deploy omitido (`docs.yml:86-98`). Job `skipped` no pone la corrida en rojo.
- **Artefacto**: `mkdocs-site` (14 días) disponible para descarga.
- **Verificación empírica**: corrida `33994642948` sobre `26e2a68` → `success` con `build: success`, `deploy: skipped`, artefacto 5.3MB (`test-report-1.md:230-236`).
- **Default seguro**: NO publicar por defecto. Sin deuda de mantenimiento: si Pages se habilita, el workflow lo detecta solo.

### 7. `package.json` y `package-lock.json`
**Ambos en versión 1.0.0 y coherentes:**
- `package.json:3`: `"version": "1.0.0"`
- `package-lock.json:3` y `package-lock.json:9`: `"version": "1.0.0"` en dos ubicaciones (raíz y `packages[""]`)
- `test-report-1.md:70-77` confirma `npm ci` exit 0 (chequeo real de coherencia que corre el CI).

### 8. Tags y ROADMAP.md
**Verificado:**
- `git ls-remote --tags origin` → 0 tags (`test-report-1.md:272`)
- `ROADMAP.md` en `origin/develop`: `- [ ] 16-validacion-mvp-produccion` (`test-report-1.md:271`, `decision.md:20`)
- `main` intacto en `a034703` (`test-report-1.md:273`)

### 9. Configuración de Production
**Coherente:**
- `api/leads.js:207-226`: `isOriginAllowed()` compara por igualdad exacta contra `SITE_URL`, `ALLOWED_ORIGINS` y `https://${VERCEL_URL}`.
- `api/leads.js:163-171`: `resolveOriginConfigFromEnv()` lee `SITE_URL`, `ALLOWED_ORIGINS`, `VERCEL_URL` en cada request.
- `.env.example:43`: `SITE_URL=http://localhost:3000` (local); en Production Vercel se sobreescribe.
- Preflight P4 confirmado: `SITE_URL` y `ALLOWED_ORIGINS` contienen **exactamente** `https://gi-clinicadental.vercel.app` (`test-report-1.md:127-129`).
- Coherencia verificada: el origen público declarado en el sitio (`og:url`, `og:image`, `twitter:image`) coincide con lo que el backend acepta.

### 10. Seguridad — credenciales y PII en logs
**Sin credenciales ni secretos en repo, docs ni artefactos:**
- `.env.example` usa solo placeholders vacíos (l.16-19, 22, 26, 31, 35, 38, 43, 51)
- `test-report-1.md:107-112` registra presencia, nunca valores
- `logger.js` implementa **lista blanca estricta** (`CAMPOS`, l.129-143): solo 13 campos permitidos, cada uno con validador que rechaza valores no conformes. Campos de lead (`nombre`, `email`, `telefono`, `mensaje`, etc.) pueden aparecer como **nombres de campo** (`campo`), nunca sus valores.
- `metadatosDeError()` (l.204-222) extrae solo `name`, `code`, `responseCode` — nunca `message`, `details`, `hint`, `response`, `stack`, `query`.
- `hashOpaco()` usa SHA-256 truncado a 16 hex para IP y huellas.
- `buildClinicNotificationEmail` / `buildPatientConfirmationEmail` usan `escapeHtml` y `sanitizeHeaderValue` para evitar inyección.
- `supabase-client.js` usa `SUPABASE_SERVICE_ROLE_KEY` solo server-side, caché en módulo, nunca expuesto.

### 11. Contenido legal — politica-privacidad.html
**Coherente, suficiente, no afirma nada falso:**
- Sección 0 declara explícitamente: "Sonríe más no es una clínica en funcionamiento... demostración técnica y de portfolio... no ingreses datos personales reales ni información clínica" (`politica-privacidad.html:33-47`).
- Sección 3: "No hay una persona jurídica constituida... no existe una clínica ni una empresa responsable" (`politica-privacidad.html:90-94`). No se inventa razón social, CUIT ni domicilio.
- Sección 4: destinatarios reales (buzón demo, Supabase, DonWeb) sin afirmar entidad inexistente (`politica-privacidad.html:113-118`).
- Sección 6: procedimiento ARCO vía `sonriamas-contactos@nextgia.io` (`politica-privacidad.html:138-149`).
- Aviso repetido en formulario (`index.html:163-170`) y consentimiento (`index.html:196-198`).
- Cumple regla dura de `AGENTS.md`: no inventa información médica/clínica ni institucional.

### 12. Coherencia spec / decision / test-report / código
**Sin contradicciones detectadas:**
- `spec.md` describe el plan; `decision.md` registra decisiones demostrables y desviaciones declaradas; `test-report-1.md` evidencia P1-P8 completados sobre el SHA exacto.
- Código implementa lo especificado: `isOriginAllowed()` (l.207-226), `mkdocs build --strict` obligatorio, marca "Sonríe más" en HTML, versionado 1.0.0, logger con whitelist.
- `decision.md:103-118` explica por qué `audit-1` audita el candidato real — verificado: la auditoría se ejecuta sobre `26e2a68` después de integrar correcciones y preflight.
- `decision.md:139-229` corrige `AGENTS.md` respecto a Pages — `docs.yml` ya refleja la corrección.
- `decision.md:243-272` corrige afirmación previa sobre `og:url` — el dominio `sonrimas.com` es institucional (feature 10) pero no resuelve; se alinea a `gi-clinicadental.vercel.app`.
- Dataset sintético en `spec.md:252-267` respeta idempotencia de 5 min (nombre+email distinctos por ejecución).
- Negativos de bajo impacto documentados y excluidos con justificación (rate limit no determinista en serverless).

### 13. Preparación real para release `develop → main`
**Sin bloqueantes:**
- CI verde en `develop` sobre `26e2a68` (corrida `33994570282`, `test-report-1.md:61`)
- `docs.yml` verde con `deploy: skipped` verificado empíricamente (corrida `33994642948`)
- `post-merge-close-feature.yml` no se dispara en PR hacia `main` (solo base `develop`)
- Workflows no dejarán `main` en rojo
- No hay tags preexistentes
- `ROADMAP.md` permanece en `[ ]` hasta cierre post-merge automático
- Rollback documentado y viable (`git revert -m 1` en `main`)

### Hallazgos no bloqueantes (observaciones preexistentes)
1. `favicon.ico` y `apple-touch-icon.png` referenciados pero inexistentes → 404 en Production (fuera de alcance, registrado en `test-report-1.md:288-292`).
2. Mensaje de éxito del formulario ("La clínica se comunicará...") contrasta con aviso de demo técnica — no se modificó por ser criterio de aceptación V4 (`test-report-1.md:293-297`).
3. Deprecación Node.js 20 en GitHub Actions (warnings, no fallos) — mantenimiento futuro.
4. No existe `<link rel="canonical">` — registrado en `decision.md:277-280`, fuera de alcance.
5. `sonrimas.com` sin registro A — dominio institucional feature 10, deuda documentada para cuando se conecte a Vercel.

---

**Conclusión:** El candidato `26e2a682bcb0eb635c9f2d3e69c1062968cd81dd` cumple todos los criterios de auditoría. No hay hallazgos bloqueantes para el release. **Veredicto: APPROVED.**
