# Validación del MVP en producción — Documentación técnica

Qué procedimiento se sigue para llevar el MVP a Production por primera
vez, validarlo con datos sintéticos y dejar evidencia verificable. Para
quien mantiene el código y tenga que repetir, auditar o revertir este
proceso.

## Por qué esta etapa no es una feature normal

Su entregable es **evidencia verificada**, no funcionalidad. Y arrastra
una dependencia que ninguna feature anterior tuvo: **Production se
actualiza desde `main`, pero la validación exige que Production ya tenga
el código**. El orden no es negociable — hay que releasear antes de poder
validar.

De ahí las dos particularidades del circuito en esta etapa:

1. La rama `feature/16-validacion-mvp-produccion` **no se mergea a
   `develop` hasta después de la validación**.
   `post-merge-close-feature.yml` marca `[x]` en cuanto una rama
   `feature/NN-slug` se mergea; hacerlo antes declararía el MVP cerrado
   sin pruebas. Durante todo el release, `ROADMAP.md` permanece en `[ ]`,
   que es la verdad en ese momento.
2. Las correcciones necesarias para el release viajan en una rama
   **deliberadamente fuera del patrón `feature/NN-slug`**
   (`release/v1.0.0-preparacion`). El workflow de cierre evalúa ese patrón
   con una expresión regular y, si no coincide, **se salta limpiamente sin
   fallar**. Así ninguna rama queda en rojo ni toca `ROADMAP.md` antes de
   tiempo.

## Estado de partida verificado (2026-09-03)

Antes de esta etapa, `main` estaba en `a034703`, el commit baseline de la
landing estática: **86 commits por detrás de `develop`**, 176 archivos de
diferencia.

Consecuencia comprobada sobre el sitio público
(`https://gi-clinicadental.vercel.app`):

| Comprobación | Resultado |
|---|---|
| `GET /` | 200, pero sirviendo el estado de 2026-08-19 |
| `GET /api/leads` | **404** — la función serverless no existía en Production |
| `GET /politica-privacidad.html` | **404** |
| `script.js` | contenía todavía `// Simulate API call` |
| Cabeceras de seguridad de `vercel.json` | **ausentes** |

En Vercel había **un solo deployment `Production`** en toda la historia
del proyecto (`2026-08-19`, ref `1b7735c`), y ese commit no contiene
`api/`, `package.json` ni `vercel.json`. Todos los demás deployments eran
`Preview`.

**Los Preview están protegidos por Vercel Authentication**
(`302 → vercel.com/sso-api`). Eso descarta validar el circuito completo
sobre un Preview sin sesión de Vercel, y es la razón técnica por la que la
validación se hace contra Production.

## Secuencia de release

```
 1  feature/16 (worktree A): spec + docs + decision parcial
 2  release/v1.0.0-preparacion (worktree B): correcciones pre-release
 3  Pruebas locales de las correcciones
 4  (sin accion humana: Pages no esta disponible; docs.yml ya lo contempla)
 5  PR release/... -> develop · CI verde · merge   => <SHA_CANDIDATO>
 6  Sincronizar develop dentro de feature/16
 7  Preflight P1-P8 -> test-report-1.md
 8  OpenCode audita <SHA_CANDIDATO> en solo lectura
 9  Claude Code persiste el informe literal en audit-1.md
10  rejected -> fix/<motivo> -> PR a develop -> nuevo candidato -> repetir 7-9
11  PR develop -> main "release: MVP v1.0.0" · CI verde · merge
12  Vercel despliega Production
13  Validación V1-V12 -> test-report-2.md + evidencia/
14  OpenCode audita la evidencia
15  Claude Code persiste el informe literal en audit-2.md
    HITL 2 -> aceptación final
16  Humano: git tag v1.0.0 <sha> && git push origin v1.0.0
17  ready-for-pr.ps1 -> [-] -> PR a develop -> merge -> [x]
```

Sólo hay **dos controles humanos** en toda la etapa: HITL 1 (aprobación
del plan) y HITL 2 (aceptación final del MVP). Todo lo demás —PRs, CI,
auditorías, merges, deployment— son pasos del circuito.

### Control antideriva

`audit-1` audita el **candidato real**: el árbol exacto que la PR
`develop → main` va a mover, no el spec en abstracto. Para que el
veredicto siga siendo válido cuando se abre esa PR:

- `audit-1.md` registra el `<SHA_CANDIDATO>` auditado.
- Antes de crear la PR hacia `main` se verifica que `origin/develop` siga
  apuntando a ese SHA.
- Si cambió, la auditoría **no vale** para el nuevo árbol y se repite el
  ciclo preflight → auditoría.

### Por qué la PR a `main` no usa `ready-for-pr.ps1`

Ese script fuerza `--base develop` (variable `BASE_BRANCH`, con
`develop` por defecto) y exige que `ROADMAP.md` tenga exactamente una
entrada `[-]` para el slug. Ninguna de las dos cosas aplica a un release.
La PR de release se crea directamente:

```powershell
gh pr create --base main --head develop --title "release: MVP v1.0.0" --body-file <evidencias>
```

`post-merge-close-feature.yml` sólo escucha `pull_request_target` con base
`develop`, así que una PR hacia `main` **no dispara** el cierre de
`ROADMAP.md`. Es intencional.

## Correcciones acotadas pre-release

Se incluyen en esta etapa porque el primer release estable no puede
publicar contenido incorrecto ni workflows conocidos como rojos.

### Marca

Se encontraron **17 ocurrencias de "Savia Dental"** en los tres HTML
públicos, mientras la marca visible en cabecera y pie ya era "Sonríe más":
`index.html` (11: `title`, `meta description`, Open Graph, Twitter Card,
párrafo visible y `alt` de las 3 imágenes), `404.html` (2) y
`politica-privacidad.html` (4).

Sustitución a **"Sonríe más"**, que es la marca ya usada en el propio
sitio, en `mkdocs.yml` (`site_name`) y en el ítem 10 de `ROADMAP.md`. No se
inventa denominación nueva: lo prohíben las reglas de dominio de
`AGENTS.md`.

Verificación mecánica: `grep -c "Savia"` → **0** en los tres archivos, más
inspección visual en V1 sobre el HTML realmente servido por Production.

**Fuera de la corrección, a propósito**: `create_images.py` (script de
desarrollo, excluido del deployment por `.vercelignore`) y los `.md` de
`docs/` y `runs/` que citan "Savia" describiendo el estado histórico.
`AGENTS.md` prohíbe sobrescribir artefactos de otro agente, y reescribir
evidencia pasada la falsearía.

### `docs.yml`

El diagnóstico tiene **dos causas distintas**, y conviene no
confundirlas:

- **Limitación de entorno, no configuración pendiente**: **GitHub Pages no
  está disponible en este repositorio.** Es privado y el plan actual no lo
  incluye. Settings → Pages muestra *"Upgrade or make this repository
  public to enable Pages"*, y `GET /repos/<owner>/<repo>/pages` devuelve
  404. No hay casilla que marcar. **Decisión del proyecto: no se cambia la
  visibilidad del repositorio ni el plan**, y en consecuencia **Pages no
  bloquea el MVP**: dónde se publica la documentación no puede detener un
  producto funcional.
- **Defecto del workflow versionado**: `docs.yml` usaba
  `mkdocs gh-deploy --force`, que publica empujando la rama `gh-pages` y
  por lo tanto exige *Source = "Deploy from a branch"* — y que además
  necesita Pages igual.

El problema operativo era el mismo en cualquier variante: `docs.yml` se
dispara con `push` a `main` filtrando por `docs/**` y `mkdocs.yml`, y el
release lleva `docs/` a `main` **por primera vez**, así que el workflow
**corre sí o sí** en ese merge. Cualquier versión que intentara publicar
habría dejado `main` en rojo el día del primer release estable.

#### El diseño: separar lo obligatorio de lo opcional

| | |
|---|---|
| **`mkdocs build --strict`** | **Obligatorio.** Sin condición, en el job `build`. Si un enlace queda roto o falta una página, la corrida falla, haya Pages o no. Sigue siendo el gate real de la documentación. |
| **Deploy a Pages** | **Opcional.** `configure-pages`, `upload-pages-artifact` y `deploy-pages` viven sólo en el job `deploy`, condicionado. |

- El job `build` **no contiene ningún paso de Pages**, así que no puede
  fallar por ese motivo.
- El sitio se sube como artefacto **`mkdocs-site`** (14 días de
  retención). Mientras la limitación siga vigente, ahí se descarga la
  documentación construida.
- Un paso consulta la API de Pages y expone la salida `pages_disponible`.
  El job `deploy` corre únicamente cuando vale `true`.
- **El default seguro es NO publicar**: 404 (no habilitado), 403 (plan que
  no lo incluye), un fallo de red o incluso que el propio paso de
  detección falle sin escribir salida, todos omiten el deploy. Un job
  `skipped` **no** pone la corrida en rojo.
- `workflow_dispatch` permite construir la documentación a demanda desde
  cualquier rama, sin esperar a un push a `main`.

**Verificación empírica**, no una promesa: la corrida `33826977524`,
disparada con `workflow_dispatch` sobre `develop`, terminó
`completed/success` con `build: success`, `deploy: skipped` y el artefacto
`mkdocs-site` de 5.379.313 bytes.

**Sin ajuste humano pendiente y sin deuda de mantenimiento.** Si algún día
Pages se habilita —repo público o plan que lo incluya— no hay que tocar el
workflow: basta con *Settings → Pages → Build and deployment → Source =
"GitHub Actions"* y el job `deploy` empieza a ejecutarse en la siguiente
corrida.

`AGENTS.md` afirmaba en tres lugares (Stack, CI/CD y Setup manual) que la
documentación se publica en Pages, y pedía un ajuste imposible de cumplir
acá. Las tres afirmaciones quedan corregidas: dejar una instrucción
irrealizable en el contrato que los agentes leen al arrancar es peor que
corregirla.

### Versionado npm

`package.json` declaraba `"version": "0.1.0"`, y `package-lock.json`
(`lockfileVersion: 3`) lo repetía en **dos lugares**: la raíz y el paquete
raíz `packages[""]`. Cambiar sólo `package.json` los deja
desincronizados.

```bash
npm version 1.0.0 --no-git-tag-version
```

`--no-git-tag-version` es obligatorio aquí: los agentes nunca crean tags
(`AGENTS.md`, sección Versionado), y el tag `v1.0.0` está reservado al
humano.

Verificación: `"version": "1.0.0"` aparece **2 veces** en
`package-lock.json` y `"0.1.0"` **0 veces** en ambos archivos. El chequeo
real de coherencia es **`npm ci`**, que falla por diseño si los dos
archivos discrepan — y es exactamente lo que corre el CI.

## Autoría de las auditorías

Separación estricta, verificable en cada artefacto:

| | |
|---|---|
| **Autor de la auditoría** | **OpenCode**, en **solo lectura**. No crea ni modifica `audit-1.md`, `audit-2.md` ni ningún otro archivo del repositorio. Sólo devuelve el informe. |
| **Persistencia del artefacto** | **Claude Code**, que escribe el informe **literal**, sin reinterpretar hallazgos, veredicto ni recomendaciones, sin resumir y sin corregir redacción. |

Cada `audit-N.md` abre con una cabecera de procedencia (autor, quién
persiste, fecha, SHA auditado, alcance) y a continuación el informe
íntegro con su bloque YAML `status / attempt / feedback` tal cual lo
emitió OpenCode. Cualquier respuesta o corrección de Claude Code va en
`decision.md`, **nunca dentro del artefacto de auditoría**.

**Reintentos**: un veredicto `rejected` se persiste como
`audit-1-intento-N.md` o `audit-2-intento-N.md`. `audit-1.md` y
`audit-2.md` quedan reservados para el veredicto **aprobado** de cada
etapa. Todos coinciden con el patrón `audit-*.md` que exige
`Assert-FeatureContract`, y ninguno sobrescribe a otro.

## Riesgo principal: validación de origen

Es el fallo más probable de toda la etapa, y conviene entenderlo antes de
diagnosticarlo a ciegas.

`isOriginAllowed()` (en `api/leads.js`) compara el header `Origin`
**por igualdad exacta** contra tres candidatos:

- `SITE_URL`
- cada entrada de `ALLOWED_ORIGINS`
- `https://${VERCEL_URL}`, cuando esa variable existe

En Production, **`VERCEL_URL` es la URL del deployment**
(`gi-clinicadental-<hash>-<team>.vercel.app`), **no el alias estable** que
el visitante tiene en la barra de direcciones. Si `SITE_URL` no coincide
exactamente con el origen público, todo envío desde la UI devuelve **403
`origen_no_permitido`**, y el frontend muestra *"Error en la conexión,
intente más tarde"* — un mensaje que no distingue esta causa de una caída
de red.

Por eso la comprobación es **bloqueante en el preflight (P4)**, antes del
release. En los logs se reconoce por `lead_rechazado` con
`motivo: origen_no_permitido`, seguido de `validacion_rechazada`.

## Qué se valida en Production

Doce comprobaciones (V1-V12) descritas en
`runs/v1.0.0-producto/16-validacion-mvp-produccion/spec.md`, más dos negativos de bajo
impacto:

- `GET /api/leads` → **405 `metodo_no_permitido`**. Sirve además como
  prueba de que Production efectivamente se actualizó: antes del release
  ese endpoint devolvía 404.
- Formulario sin consentimiento → bloqueado por el frontend, sin llegar a
  la API.

**No se prueba el rate limit en Production.** Es un limitador en memoria y
por instancia serverless: no es determinista entre instancias, y forzarlo
generaría leads y correos innecesarios. Su cobertura es automatizada
(`npm test`).

### Detalle de V4: qué se exige y qué no

Se exige HTTP 201, body exactamente `{ "id": "<uuid>" }`, **ausencia de
`X-Request-Id` añadido por la aplicación** (contrato fijado por el test
`f15: la superficie HTTP no cambia`) y presencia de las cabeceras de
seguridad de `vercel.json`.

**No se exige que la respuesta traiga únicamente `Content-Type`**: Vercel
añade sus propias cabeceras de infraestructura, y eso no es un fallo del
producto.

### Restricciones del dataset que afectan al resultado

- **Ventana de idempotencia de 5 minutos** sobre `email` (case-insensitive)
  + `nombre` (case-sensitive). Repetir el mismo par dentro de la ventana
  devuelve **201 con el id existente y no envía ningún correo**. Por eso
  las ejecuciones desktop y móvil usan nombre y email distintos: con datos
  iguales, V6, V7 y V8 darían un falso negativo.
- `sitio_web` y `formulario_mostrado_en` (honeypot y control temporal) no
  los envía el frontend; son opcionales y no rechazan.
- `telefono` viaja como `null`: el formulario no tiene ese campo. No es un
  defecto.

## Rollback

Disparadores: el sitio no carga; `/api/leads` responde 5xx sistemático; se
filtran PII o secretos; se envía correo incorrecto a terceros.

1. **Contención inmediata** — Vercel UI → Deployments → *Promote to
   Production* del anterior. **Ojo**: el único Production previo es el de
   `2026-08-19` (`1b7735c`), el sitio **sin backend**. Devuelve al estado
   anterior al release, con el formulario roto. Es contención, no estado
   final.
2. **Trazable y preferido** — `git revert -m 1 <merge-commit>` en `main` +
   push; Vercel redespliega automáticamente.
3. Si la causa es configuración: corregir la variable en Vercel y forzar
   redeploy, sin revert. El redeploy es obligatorio, no opcional: el
   cliente de Supabase y el transporter de Nodemailer se cachean a nivel
   de módulo (feature 15), así que una instancia caliente seguiría usando
   el valor viejo.
4. Si ya existiera el tag (no debería: va después de HITL 2), **no se
   borra ni se mueve** un tag publicado. Se documenta el incidente y el
   siguiente release lleva `v1.0.1`.

**Límites del rollback**: no revierte filas en Supabase (los leads
insertados quedan; se pasan a `descartado`) y no des-envía correos ya
emitidos.

## Clasificación de fallos

| Clase | Síntomas | Acción |
|---|---|---|
| **A — Entorno/configuración** | `403 origen_no_permitido`; `500` con `supabase_cliente_error` o `smtp_configuracion_error`; 201 con `notificacion_*_enviada=false` y `smtp_*_error` (`codigo=EAUTH`, `smtp_response_code=535`) | **No se toca código.** Corregir en el panel + redeploy forzado + re-ejecutar con dataset nuevo |
| **B — Defecto de código** | `500` con `error_no_controlado`; contrato HTTP distinto; flags que no reflejan la realidad; PII en un log | Declarar causa y alcance en `decision.md` **antes** de tocar nada. Si es acotado y necesario: corregir con tests, y repetir el ciclo completo (PR → preflight → auditoría → release → validación). Si no: abrir `17-<slug>` y **no cerrar el MVP** |
| **C — Externo** | `ETIMEDOUT`/`ECONNECTION` a SMTP; 5xx de Supabase; incidente del proveedor | Registrar `request_id`, `huella`, `codigo`, hora y evidencia. **No parchear código para tapar una caída externa.** Reintentar en otra ventana |

**Una fuga de PII en logs es bloqueante siempre.** En ningún caso se oculta
un fallo, se marca el MVP como cerrado ni se crea el tag.

## Seguridad de los artefactos

Nunca se escriben en `runs/` ni en `docs/` los valores de
`SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, tokens, cookies, cabeceras
`Authorization` ni secretos de Vercel. Tampoco capturas del panel de
variables de entorno, ni el contenido íntegro de los correos con la
dirección real de la clínica.

Se registra **presencia**, nunca **valor**: "`SMTP_PASS`: presente" es
evidencia válida; su contenido, no.

Los extractos de logs incluidos como evidencia llevan `request_id` y
`lead_id`, y **no** cabeceras ni cuerpos de request.

## Referencias

- Spec: `runs/v1.0.0-producto/16-validacion-mvp-produccion/spec.md`
- Auditorías: `runs/v1.0.0-producto/16-validacion-mvp-produccion/audit-1.md` (candidato) y
  `audit-2.md` (evidencia)
- Reportes: `runs/v1.0.0-producto/16-validacion-mvp-produccion/test-report-1.md`
  (preflight) y `test-report-2.md` (Production)
- Decisiones: `runs/v1.0.0-producto/16-validacion-mvp-produccion/decision.md`
- Documentación de usuario:
  [Validación del MVP en producción](../usuario/validacion-mvp-produccion.md)
- `docs/tecnica/pipeline-despliegue-vercel.md` — flujo de despliegue,
  variables por ambiente y troubleshooting
- `docs/tecnica/observabilidad-y-operacion.md` — catálogo de eventos,
  política de redacción y dónde consultar los logs
- `AGENTS.md` — Circuito, Git, Versionado, CI/CD, Reglas de dominio
