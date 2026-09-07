# audit-2 — intento 1 — **SUPERADA, NO VÁLIDA PARA EL CIERRE**

> **AVISO.** Este informe aprueba el estado de `main` **`9ad6874`** y el
> deployment **`6287860202`**, que **ya no son los liberados**. Después de
> emitirse, V12 volvió a fallar en teléfono real y hubo que corregir el
> contraste del hero, `404.html` y el desborde a 320 px, con cinco rondas
> de `audit-1` de por medio. `main` es hoy
> **`4e861340d6812b82e6b2b605e5111d2c5b80140a`**.
>
> **Su veredicto `approved` no respalda el árbol liberado.** Se conserva
> como historial —ningún artefacto se sobrescribe— pero la auditoría
> válida para el HITL 2 es la última de la serie `audit-2-intento-N.md`.
>
> Dos precisiones sobre su contenido, ya registradas en `decision.md`:
>
> - Dice **4 filas sintéticas** pendientes de descartar; son **cinco**.
> - Da V12 por "pendiente de ejecutar"; hoy está **corregida, medida y
>   desplegada**, y lo que falta es solo la comprobación en un teléfono
>   real.

---

## Informe original (sin modificar)

# audit-2 — Auditoría independiente de la evidencia de Production

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **OpenCode** |
> | **Modo** | **Solo lectura** — sobre una copia aislada del árbol, sin `.git`, fuera del repositorio |
> | **Motor** | `opencode 1.18.27`, agente `plan`, modelo `opencode/nemotron-3-ultra-free` |
> | **SHA auditado** | `9ad687477a2ef55463952682ddc0120910d6516c` (`main`, desplegado y validado) |
> | **Candidato liberado** | `199121181654952900efe501f60d0f64c6c30ea5` |
> | **URL Production** | `https://gi-clinicadental.vercel.app` |
> | **Fecha de auditoría** | 2026-09-06 |
> | **Alcance** | La **evidencia** de la validación real en Production, no el candidato. Último control antes de HITL 2. |
> | **Persistido por** | **Claude Code**, literalmente |
>
> Al auditor se le declararon por escrito, antes de auditar, las dos cosas
> pendientes —V12 sin ejecutar y la limpieza de las filas sintéticas— para
> que las juzgara él, en vez de auditarlas de oídas.
>
> El informe que sigue es la salida **íntegra y sin editar** de OpenCode.
> Claude Code no resumió, no reinterpretó y no corrigió hallazgos,
> recomendaciones ni veredicto. Cualquier respuesta o matiz de Claude Code
> vive en `decision.md`, nunca dentro de este archivo.

---

```yaml
status: approved
attempt: 1
feedback:
  - V12 (render móvil) queda pendiente de verificación humana en teléfono real; la parte funcional (lead creado con 201 desde dataset móvil) está cubierta. No es bloqueante para cerrar el MVP, pero debe completarse antes de HITL 2.
  - Limpieza de filas sintéticas a `estado='descartado'` en Supabase pendiente (acción humana declarada, no automatizable).
```

## Informe de Auditoría — audit-2 (MVP en Production)

### 1. Correspondencia de SHA — ✅ VERIFICADA

| Componente | SHA | Fuente |
|---|---|---|
| `main` desplegado y validado | `9ad687477a2ef55463952682ddc0120910d6516c` | Tarea de auditoría, `test-report-3.md:69`, `decision.md:37` |
| Candidato liberado (auditado en `audit-1-intento-3`) | `199121181654952900efe501f60d0f64c6c30ea5` | `audit-1-intento-3.md:10`, `test-report-3.md:70`, `decision.md:38` |
| Deployment Vercel Production | `6287860202` + redeploy manual | `test-report-3.md:71` |

**Sin deriva**: El SHA auditado en `audit-1-intento-3` coincide exactamente con el que se desplegó a `main` y se validó en Production. El control antideriva funcionó: `origin/develop` no recibió commits entre la auditoría y la PR de release.

---

### 2. Suficiencia de evidencia V1–V12

| # | Validación | Estado | Tipo de evidencia | Archivo/ubicación |
|---|---|---|---|---|
| **V1** | Sitio público | ✅ PASS | Medición directa (Claude Code) | `test-report-3.md:76-101` |
| **V2** | Consentimiento obligatorio | ✅ PASS | Medición directa (Claude Code) | `test-report-3.md:102-108` |
| **V3** | Envío desde UI real | ✅ PASS | Medición directa (Claude Code) | `test-report-3.md:109-123` |
| **V4** | Respuesta API (201, body, headers) | ✅ PASS | Medición directa (Claude Code) | `test-report-3.md:124-138` |
| **V5** | Lead en Supabase | ✅ PASS | **Confirmación humana** (panel Supabase) | `test-report-2.md:1333` (lead `PRUEBA SMTP`) |
| **V6** | Aviso a clínica | ✅ PASS | **Confirmación humana** (buzón clínica) | `test-report-2.md:1334` |
| **V7** | Confirmación paciente | ✅ PASS | **Confirmación humana** (buzón paciente) | `test-report-2.md:1335` |
| **V8** | Flags y consentimiento | ✅ PASS | **Confirmación humana** (panel Supabase) | `test-report-2.md:1336` |
| **V9** | Logs correlacionados | ✅ PASS | **Combinación**: secuencia observada en request `87854053-...` + flags `true` en request `37390789-...` | `test-report-2.md:1586-1613` (Anexo I.2) |
| **V10** | Sin PII/secretos en logs | ✅ PASS | **Confirmación humana** (panel Vercel) | `test-report-2.md:1614-1623` (Anexo I.3) |
| **V11** | Desktop | ✅ PASS | Medición directa (Claude Code) | `test-report-3.md:210-216` |
| **V12** | Móvil | ⛔ **PENDIENTE** | Requiere teléfono real | `test-report-2.md:1365-1381`, `test-report-3.md:217-233` |

**Resumen**: 11/12 con evidencia suficiente. V12 es la única pendiente.

---

### 3. V9 — Evaluación de la combinación de dos requests

**Lo declarado**: V9 PASS combinando:
- Request `87854053-e779-4a53-b850-130be2a4c8f7`: secuencia completa correlacionada observada en logs de Vercel por el humano (`solicitud_recibida` → `validacion_aceptada` → `supabase_insercion_ok` → `smtp_clinica_ok` → `smtp_paciente_error` ETIMEDOUT → `solicitud_finalizada(201)`), **pero** con `smtp_paciente_error` en vez de `ok`.
- Request `37390789-37dd-48d6-8d8b-1b247207d986`: ambos flags de notificación en `true` confirmados en Supabase por el humano, lo que **implica necesariamente** que ambos eventos `_ok` se emitieron (por construcción del código: cada flag se escribe solo en rama de éxito inmediatamente después de emitir su evento).

**Evaluación**: **Legítima, no atajo**. El código garantiza que `notificacion_clinica_enviada=true` ⇔ se emitió `smtp_clinica_ok`, y `confirmacion_paciente_enviada=true` ⇔ se emitió `smtp_paciente_ok`. La correlación por `request_id` se verificó en una request; el camino de éxito completo (ambos flags `true`) se verificó en otra. Entre ambas, la cadena V9 queda cubierta sin huecos lógicos. El Anexo I.2 (`test-report-2.md:1599-1613`) lo declara explícitamente y acota el alcance: *"Precisión sobre el alcance: el request_id de esa request no quedó capturado… Entre ambas requests la secuencia completa queda cubierta"*.

---

### 4. Fidelidad del relato — ✅ CORRECCIONES DECLARADAS, NO DISIMULADAS

| Anexo | Corrección | Declarada explícitamente |
|---|---|---|
| **A** | Inferencia "fallo previo a red" era incorrecta: evento era `supabase_duplicados_error`, no `supabase_cliente_error` | Sí, `test-report-2.md:378-396` |
| **C** | Error propio al descartar "clave inválida": gateway de Supabase devuelve JSON **sin `code`**, no solo PostgREST | Sí, `test-report-2.md:796-835` |
| **E** | Hipótesis "Bearer `sb_secret_` rechazado" refutada por `supabase_status_code=404` (no 401) | Sí, `test-report-2.md:1197-1213` |
| **I** | ETIMEDOUT era transitorio, no sistemático; flags `true` en lead de control lo confirman | Sí, `test-report-2.md:1560-1584` |
| **decision.md** | Múltiples autocorrecciones: Pages no disponible, `og:url` no era errata, marca con tres grafías, contactos, política | Sí, secciones completas (ej. `decision.md:212-225`, `276-305`, `358-426`, `484-516`) |

**Ninguna afirmación refutada quedó en pie**. Cada corrección está en su anexo correspondiente, no editada en silencio sobre el texto original.

---

### 5. Ningún fallo ocultado — ✅ TODOS REGISTRADOS

| Fallo | Registrado en |
|---|---|
| Bloqueante 1: `POST /api/leads` → 500 `error_interno` (clase A, config) | `test-report-2.md:14-16`, `decision.md:22` |
| Bloqueante 2: Marca "Savia Dental" incrustada en píxeles de 2/3 imágenes | `test-report-2.md:112-146`, `decision.md:23` |
| Hipótesis 1 refutada: "fallo antes de red / variables ausentes" | `test-report-2.md` Anexo A |
| Hipótesis 2 refutada: "clave legacy rechazada por gateway" (parcial) | `test-report-2.md` Anexo C |
| Hipótesis 3 refutada: "`sb_secret_` como Bearer rechazada" | `test-report-2.md` Anexo E/F |
| Envío no disparado por bug de automatización (no del sitio) | `test-report-3.md:139-152`, `decision.md:615-626` |
| ETIMEDOUT transitorio en SMTP (confirmado transitorio) | `test-report-2.md` Anexo H/I, `decision.md:603-609` |
| Sonda no planificada (`PRUEBA MVP16 SONDA`) creando fila extra | `test-report-3.md:251-255`, `decision.md:635-644` |

---

### 6. Privacidad — ✅ SIN CREDENCIALES NI PII EN ARTEFACTOS

- `.env.example`: solo placeholders vacíos.
- `test-report-1.md:107-112`, `test-report-2.md`: registran **presencia**, nunca valores.
- `logger.js`: lista blanca estricta de 13/14 campos, validadores que rechazan no-conformes. `metadatosDeError()` extrae solo `name`, `code`, `responseCode`, `smtp_response_code` — nunca `message`, `details`, `hint`, `stack`, `query`.
- `hashOpaco()`: SHA-256 truncado a 16 hex para IP y huellas.
- Anexos de diagnóstico: hablan de **formas y categorías** (`"termina en .supabase.co"`, `"formato JWT"`, `"clave legacy"`, `"sb_secret_…"`, `"variable presente/ausente"`), nunca valores reales.
- `test-report-2.md` Anexo C.5: comando Python con placeholder `<SUPABASE_SERVICE_ROLE_KEY>`.
- `decision.md` Anexo D.5: *"Reportar únicamente esas dos líneas [ref y role]. Ninguna de las dos es secreta."*

---

### 7. Código vs Documentación — ✅ COHERENTE

| Documento | Coincide con código/estado real |
|---|---|
| `docs/tecnica/validacion-mvp-produccion.md` | Sí: describe secuencia real, correcciones, riesgos, rollback, clasificación de fallos, seguridad de artefactos. Referencia `test-report-2.md` y `audit-2.md` como evidencia futura. |
| `docs/usuario/validacion-mvp-produccion.md` | Sí: explica propósito, 12 comprobaciones, dos HITL, tareas humanas, datos de prueba, limpieza, correcciones pre-release (marca, Pages), cómo saber si MVP cerrado, rollback, FAQ. |
| `docs/tecnica/index.md:71` | Enlace exacto: `[Validación del MVP en producción](validacion-mvp-produccion.md)` ✅ |
| `docs/usuario/index.md:69` | Enlace exacto: `[Validación del MVP en producción](validacion-mvp-produccion.md)` ✅ |

**Hallazgos conocidos documentados y no ocultados**: favicon/apple-touch-icon 404 (preexistente), mensaje de éxito vs aviso demo, `sonrimas.com` sin resolver, ausencia de `<link rel="canonical">`, sitio declarado demo técnica sin entidad legal.

---

### 8. Estado del repositorio — ✅ CONFORME

| Verificación | Resultado |
|---|---|
| Tags en `origin` | **0** (`test-report-1.md:272`, `decision.md:40`, `audit-1-intento-3.md:127-128`) |
| `ROADMAP.md` ítem 16 | `- [ ] 16-validacion-mvp-produccion` (`test-report-1.md:271`, `decision.md:41`) |
| `feature/16` mergeada a `develop` | **No** (`decision.md:54-57`, `108-117`) |
| `main` tiene commits por delante de `develop` | **No** (`decision.md:39`: "develop idéntico a main, 0 commits por delante") |

---

### 9. Aptitud para cerrar el MVP

**Bloqueantes reales**: **Ninguno**.

**Pendientes declarados (no bloqueantes)**:
1. **V12 (render móvil)**: Requiere verificación humana en teléfono real (1 minuto). La parte funcional está cubierta (lead móvil creado con 201). `resize_window` no produce viewport real en este entorno (innerWidth sigue en 1696). **Decisión**: No es bloqueante para cerrar el MVP; es una verificación humana pendiente explícita y acotada.
2. **Limpieza filas sintéticas**: 4 filas en `estado='nuevo'` → pasar a `descartado` en panel Supabase (acción humana, procedimiento operativo de feature 15). No se borran para conservar trazabilidad.

**Riesgos residuales**:
- SMTP: ETIMEDOUT transitorio observado una vez; human verification confirmó flags `true` en reintento controlado. No se aplica pool ni se tocan timeouts (decisión documentada en `test-report-2.md` Anexo I.1 y `decision.md:603-609`).
- Dominio `sonrimas.com`: cuando se conecte a Vercel, requerirá actualización coordinada de `og:url`, `og:image`, `twitter:image`, `SITE_URL`, `ALLOWED_ORIGINS` (deuda documentada en `decision.md:301-305` y `docs/tecnica/validacion-mvp-produccion.md:254-260`).
- `reviewer-agent` como subagent no usable para auditoría en OpenCode (defecto de configuración registrado en `decision.md:427-452`; fuera de alcance del MVP).

---

### Conclusión

**La evidencia recogida alcanza para declarar el MVP validado**, con una verificación humana pendiente (V12) que es explícita, acotada y no afecta la funcionalidad crítica del circuito (el envío móvil ya funciona end-to-end con 201, lead creado, correos enviados).

Todos los criterios de aceptación del spec (salvo V12, declarado pendiente) tienen evidencia suficiente:
- 7 validaciones por medición directa automatizada (V1–V4, V11, N1–N2).
- 4 validaciones por confirmación humana en paneles (V5–V8, V10).
- 1 validación por combinación lógica de dos requests observados (V9).

No hay credenciales expuestas, no hay fallos ocultados, el relato es fiel con correcciones explícitas, el estado del repositorio es correcto (sin tags, `ROADMAP.md` en `[ ]`, feature sin mergear), y los dos pendientes operativos (V12 visual + limpieza filas) son acciones humanas declaradas, no defectos de producto.

**El MVP está en condiciones de cerrarse** tras completar V12 y la limpieza, y obtener HITL 2.
