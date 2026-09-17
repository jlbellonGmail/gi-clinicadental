# audit-1, intento 3 — Re-auditoría del candidato de release

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **OpenCode** |
> | **Modo** | **Solo lectura** — sobre una copia aislada del árbol, sin `.git`, fuera del repositorio |
> | **Motor** | `opencode 1.18.27`, agente `plan`, modelo `opencode/nemotron-3-ultra-free` |
> | **SHA auditado** | `199121181654952900efe501f60d0f64c6c30ea5` (`origin/develop`) |
> | **Fecha de auditoría** | 2026-09-06 |
> | **Intento** | 3 |
> | **Alcance** | Candidato de release del punto 16, con foco en la PR #28 (instrumentación `supabase_host` / `supabase_path`) y en su riesgo de privacidad. |
> | **Persistido por** | **Claude Code**, literalmente |
>
> **Por qué hay un intento 3.** El intento 2 aprobó `8611e96`, que se
> liberó y se desplegó; el endpoint siguió fallando y hubo que agregar
> instrumentación (PR #28). Ese cambio toca el módulo que declara la
> garantía de no filtrar PII, y la consulta instrumentada lleva el email
> del paciente en su query string: por eso se re-audita con foco en
> privacidad, no sólo por la regla de "SHA auditado = SHA liberado".
>
> El informe que sigue es la salida **íntegra y sin editar** de OpenCode.
> Claude Code no resumió, no reinterpretó y no corrigió hallazgos,
> recomendaciones ni veredicto — se conserva incluso su línea de
> preámbulo antes del bloque YAML. Cualquier respuesta de Claude Code
> vive en `decision.md`, nunca dentro de este archivo.

---

Now I have a thorough understanding of the codebase. Let me perform the audit and produce the report.
```yaml
status: approved
attempt: 3
feedback:
  - La implementación de `metadatosDeEndpoint()` en `api/leads.js:258-265` lee únicamente `host` y `pathname` del builder; nunca accede a `search` (query string). Defensa en profundidad: el logger rechaza cualquier valor con `?`, `=`, `&`, `@`, espacio o `%` via `PATRON_HOST`/`PATRON_PATH` (`api/_lib/logger.js:48-49`).
  - Patrones `PATRON_HOST` (`^[A-Za-z0-9.-]{1,253}$`) y `PATRON_PATH` (`^\/[A-Za-z0-9/_.-]{0,200}$`) excluyen efectivamente `?`, `=`, `&`, `@`, espacio y `%`. Un email URL-encodeado (`%40`) no pasa. Tests en `logger.test.js:441-469` confirman rechazo entero (no truncado) de path con query y host con credenciales.
  - Garantía de feature 15 intacta: `CAMPOS` en `logger.js:137-173` no tiene campos de texto libre; `supabase_host`/`supabase_path` usan `validarPatron` estricto. Test de guardia en `logger.test.js:149-169` fallaría si se agregara uno.
  - El patrón de builder en dos pasos (`consultaDuplicados` / `consultaInsercion` en `leads.js:696-741`, `757-796`) no altera comportamiento: mismo orden de evaluación, misma respuesta HTTP, mismos efectos; solo permite leer `.url` antes del `await`.
  - Coherencia total: código (`leads.js`, `logger.js`), `docs/tecnica/observabilidad-y-operacion.md:107-108` (tabla de campos), `docs/tecnica/observabilidad-y-operacion.md:155,157` (catálogo de eventos) y `runs/16-*/decision.md` coinciden.
  - Sin tags en el repo; `ROADMAP.md:119` mantiene `[ ] 16-validacion-mvp-produccion`.
  - Artefactos en `runs/16-*/` discuten formas/categorías de claves y URLs, nunca valores reales (ej. `test-report-2.md` Anexo C.5 muestra comando de decodificación con placeholder `<SUPABASE_SERVICE_ROLE_KEY>`).
  - Candidato `origin/develop @ 1991211` listo para PR `develop → main` con CI verde; secuencia documentada en `decision.md` y `docs/tecnica/validacion-mvp-produccion.md`.
```

**Informe detallado**

### 1. `metadatosDeEndpoint()` — solo host y pathname (`api/leads.js:258-265`)

```javascript
function metadatosDeEndpoint(builder) {
  try {
    const url = new URL(String(builder.url));
    return { supabase_host: url.host, supabase_path: url.pathname };
  } catch (_) {
    return {};
  }
}
```

- Construye `URL` desde `builder.url` (el endpoint completo que el cliente PostgREST armó).
- Extrae **exclusivamente** `url.host` y `url.pathname`.
- **Nunca** lee `url.search` (el query string), `url.hash` ni `url.href`.
- Comentario explícito líneas 245-249: «REGLA DURA: el query string NO se lee nunca… `search` es PII».
- Llamado en dos sitios: línea 726 (`supabase_duplicados_error`) y línea 790 (`supabase_insercion_error`), pasando el builder *antes* del `await`.

**Veredicto**: cumple. No hay vía por la que el query string (donde viaja `email=ilike.paciente%40ejemplo.com`) salga de esta función.

### 2. Patrones `PATRON_HOST` / `PATRON_PATH` — rechazo entero, no truncado (`logger.js:48-49`)

```javascript
const PATRON_HOST = /^[A-Za-z0-9.-]{1,253}$/;
const PATRON_PATH = /^\/[A-Za-z0-9/_.-]{0,200}$/;
```

- `PATRON_HOST`: solo alfanuméricos, `.` y `-`. Excluye `?`, `=`, `&`, `@`, espacio, `%`.
- `PATRON_PATH`: inicia con `/`, luego alfanuméricos, `/`, `_`, `.`, `-`. Excluye `?`, `=`, `&`, `@`, espacio, `%`.
- Validador `validarPatron` (`logger.js:119-121`) devuelve `VALOR_NO_VALIDO` (`'no_valido'`) si **no** matchea completo — **no trunca**.

Tests `logger.test.js:441-469`:
- `supabase_path: '/rest/v1/leads?email=ilike.paciente@example.com'` → `no_valido` (línea 465), email no aparece en JSON (línea 466).
- `supabase_host: 'usuario:clave@abcdef.supabase.co'` → `no_valido` (línea 468), credencial no aparece (línea 469).

**Veredicto**: cumple. Cualquier intento de colar query string, credenciales embebidas o `%40` es rechazado entero.

### 3. Email URL-encodeado (`%40`)

- `%` no está en ninguno de los dos patrones → rechazado por `validarPatron` → `no_valido`.
- Test implícito: al no permitir `%`, `%40` no puede pasar.

### 4. Garantía feature 15 — sin campos de texto libre

- `CAMPOS` (`logger.js:137-173`) declara 18 campos, todos con validadores acotados (`validarEnum`, `validarPatron`, `validarEntero`, `validarToken`).
- `supabase_host` → `validarPatron(PATRON_HOST)`, `supabase_path` → `validarPatron(PATRON_PATH)`.
- Test de guardia `logger.test.js:149-169` compara `NOMBRES_DE_CAMPOS` contra lista esperada exacta; fallaría si se agregara un campo sin validador estricto.

### 5. Tests del cliente falso y `.url`

- No hay tests de producto en `tests/` (solo tests del circuito agéntico).
- Los tests en `logger.test.js:441-469` validan la **lógica del logger** inyectando valores directamente a `emitir()`, no vía cliente falso.
- El builder real de `@supabase/supabase-js` expone `.url` (confirmado en `test-report-2.md` Anexo A.1, línea 439-444: URL reconstruida localmente).
- El patrón de dos pasos en `leads.js` usa ese `.url` antes del `await`; no hay test que ejerza el cliente falso porque no existe capa de test de producto todavía — esto es consistente con el estado del proyecto («tests de producto cuando exista algo real que testear», `AGENTS.md`).

### 6. Builder en dos pasos — comportamiento funcional inalterado

`leads.js:696-741` (duplicados) y `757-796` (inserción):
```javascript
const consultaDuplicados = supabase.from('leads').select('id').ilike(...).eq(...).gte(...).limit(1);
const { data, error, status } = await consultaDuplicados;
```
- Separar la construcción del `await` **no cambia** orden de evaluación, filtros, ni respuesta HTTP.
- Solo habilita leer `consultaDuplicados.url` en el bloque `catch` / error.
- Mismo `try/catch`, mismo `respond(500)`, mismos efectos laterales.

### 7. Coherencia código ↔ docs ↔ runs

| Artefacto | Campos documentados | Coincide |
|---|---|---|
| `logger.js:169-170` | `supabase_host`, `supabase_path` con validadores | ✅ |
| `leads.js:258-265` | `metadatosDeEndpoint` retorna esos dos | ✅ |
| `docs/tecnica/observabilidad-y-operacion.md:107-108` | Tabla de campos con mismos patrones y nota «sólo pathname» | ✅ |
| `docs/tecnica/observabilidad-y-operacion.md:155,157` | Catálogo eventos `supabase_duplicados_error` y `supabase_insercion_error` incluyen ambos | ✅ |
| `runs/16-*/decision.md` | Registra decisión de agregar `supabase_status_code` (PR #26) y `supabase_host/path` (PR #28) | ✅ |

### 8. Tags y ROADMAP

- `git tag` → (no hay repo git en el workdir, pero `decision.md:43` confirma «main sigue intacto en a034703, sin tags»).
- `ROADMAP.md:119`: `- [ ] 16-validacion-mvp-produccion` (sin `[-]` ni `[x]`).

### 9. Filtración de secretos en `runs/`

Revisados `audit-1.md`, `audit-1-intento-2.md`, `test-report-1.md`, `test-report-2.md`, `decision.md`, `spec.md`:
- Hablan de **formas** (`«termina en .supabase.co»`, «formato JWT», «clave legacy», «sb_secret_…»), **categorías** (`«variable presente/ausente»`, «entorno Production/Preview»), nunca valores.
- `test-report-2.md` Anexo C.5 muestra comando Python con placeholder `<SUPABASE_SERVICE_ROLE_KEY>`.
- `decision.md` Anexo D.5: «Reportar únicamente esas dos líneas [ref y role]. Ninguna de las dos es secreta.»

### 10. Preparación `develop → main`

- Candidato auditado: `origin/develop @ 199121181654952900efe501f60d0f64c6c30ea5` (SHA del mensaje).
- `decision.md` sección «Secuencia de release» (líneas 58-79) y «Rollback» (líneas 306-329) documentan el camino completo.
- `docs/tecnica/validacion-mvp-produccion.md` sección «Secuencia de release» (líneas 58-79) idem.
- PRs pre-release (#21, #22, #23, #25, #26) ya mergeadas a `develop` con CI verde.
- Falta: PR `develop → main`, deployment Production, validación V1-V12, `audit-2`, HITL 2, tag humano `v1.0.0`, `ready-for-pr.ps1` → `[-]` → PR a `develop` → merge → `[x]`.

---

**Conclusión**: La instrumentación de `supabase_host` y `supabase_path` cumple con los requisitos de privacidad de forma estricta. No hay hallazgos bloqueantes.
