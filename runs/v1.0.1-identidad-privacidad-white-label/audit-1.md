# audit-1 — Auditoría independiente del candidato v1.0.1

> **Procedencia del artefacto**
>
> | | |
> |---|---|
> | **Auditor** | **OpenCode** |
> | **Modo** | Solo lectura |
> | **SHA auditado** | `42eb36e240b1a8386a0c527ae127d5ae9e4ae89d` |
> | **Fecha** | 2026-09-08 |
> | **Alcance** | Candidato de la release de mantenimiento v1.0.1, previo a la PR hacia `develop`. |
> | **Persistido por** | **Claude Code** |
>
> **Limitación de procedencia, declarada explícitamente.**
> A diferencia de `runs/16-validacion-mvp-produccion/audit-1.md`, este
> archivo **no contiene la salida íntegra de OpenCode**: esa salida no
> llegó a la sesión de Claude Code. Lo que se conserva abajo es el
> **veredicto y los hallazgos tal como los transmitió el humano**,
> reproducidos sin resumir, sin reinterpretar y sin corregir.
>
> Claude Code no redactó hallazgos, no los amplió y no los suavizó. Los
> encabezados de sección son los que traía el texto recibido. Cualquier
> respuesta, matiz, verificación o desviación de proceso de Claude Code
> vive en `decision.md`, nunca dentro de este archivo.
>
> Si se quiere la trazabilidad completa hasta el transcript original de
> OpenCode, debe adjuntarse ese transcript como `audit-1-opencode.txt` o
> reejecutarse la auditoría con la salida capturada.

---

```yaml
status: rejected
attempt: 1
feedback:
  - spec.md conserva referencias obsoletas a runs/17-...
  - spec.md referencia docs/usuario/imagenes-del-sitio.md, que no existe
  - spec.md describe una implementacion de imagenes que no es la final (<picture> AVIF/WebP/fallback)
  - mkdocs reporta paginas fuera de nav
  - fragilidad alrededor del titulo canonico "Identidad, privacidad y white-label" y el titulo derivado por defecto
  - comentario interno en style.css que contiene "Sonrie mas"
```

## Veredicto

**AUDITORÍA: NO APROBADA**

El producto fue considerado técnicamente apto. Los hallazgos son de
circuito/documentación.

- NO abrir PR todavía.
- NO hacer release.
- NO crear tag.

## Hallazgos

### 1. `spec.md` — referencias obsoletas y descripción que no es la del sistema final

Actualizar todas las referencias obsoletas:

- `runs/17-...` → `runs/v1.0.1-identidad-privacidad-white-label/...`
- eliminar/corregir la referencia a `docs/usuario/imagenes-del-sitio.md`
  si ese archivo no existe;
- hacer que la spec refleje la implementación final de imágenes:
  - WebP directo;
  - no `<picture>` AVIF/WebP/fallback si eso no se implementó;
  - inventario/guía consolidado donde realmente quedó.

La spec debe describir el sistema FINAL, no decisiones descartadas.

### 2. MkDocs — páginas fuera de `nav`

Investigar los warnings de páginas fuera de `nav`. Determinar:

- cuáles son preexistentes;
- cuáles fueron introducidos por v1.0.1.

Si los introducidos por v1.0.1 pueden corregirse sin ampliar alcance,
corregirlos.

No hacer una reestructuración masiva de documentación histórica
únicamente para eliminar warnings preexistentes.

Documentar con precisión cualquier warning heredado que permanezca.

### 3. Título canónico

Eliminar la fragilidad señalada alrededor de
`Identidad, privacidad y white-label` y el título derivado por defecto.

Preferencia: definir/documentar explícitamente el título canónico de esta
release y asegurar que `ready-for-pr.ps1`, `Get-FeatureInfo`, los índices
y `Assert-FeatureContract` usen una fuente coherente o reciban
explícitamente el título cuando corresponda.

No degradar los índices para adaptarlos a un título derivado peor.

### 4. CSS

El comentario interno que contiene `Sonrie mas` **no es superficie
pública**. Puede corregirse por higiene si no genera ruido, pero **no
debe tratarse como defecto funcional**.

## Condición de reauditoría

`audit-1` no se marca como aprobado. El nuevo SHA candidato debe pasarse
nuevamente a OpenCode en solo lectura, y esa segunda auditoría debe
producir `AUDITORÍA: APROBADA` o `AUDITORÍA: NO APROBADA` y persistirse
como `audit-2.md`.

No se abre PR hasta obtener auditoría independiente aprobada.
