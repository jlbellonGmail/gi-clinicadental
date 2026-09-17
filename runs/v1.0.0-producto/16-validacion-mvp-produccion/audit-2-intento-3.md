# audit-2 — intento 3 (evidencia del punto 16) — **APROBADA**

> **Procedencia.** Informe producido por **Codex CLI**, en modo
> `-s read-only`, sobre una copia aislada de `runs/` y del árbol liberado
> en **`4e861340d6812b82e6b2b605e5111d2c5b80140a`** (`main`, PR #38,
> desplegado en Production como `6295205198`). Codex no escribe en este
> repositorio: Claude Code persiste el informe **literalmente**, sin
> reinterpretar hallazgos, veredicto ni recomendaciones.
>
> - **Fecha**: 2026-09-06
> - **Auditor**: Codex CLI (contingencia autorizada por el humano)
> - **Alcance**: la **evidencia**, no el candidato. Último control antes
>   del HITL 2.
> - **Veredicto**: **APROBADA**
> - **Intento anterior**: `audit-2-intento-2.md`, `NO APROBADA`, por el
>   `audit-2.md` obsoleto que aprobaba otro deployment. Corregido con un
>   aviso de artefacto superado.
>
> Al auditor se le declararon por escrito, antes de auditar, los dos
> pendientes —V12 sin confirmar en teléfono real y las cinco filas
> sintéticas sin descartar— para que los juzgara él en vez de auditarlos
> de oídas.
>
> Lo que sigue es el texto del auditor, sin modificar.

---

```yaml
status: approved
attempt: 3
feedback:
  - El aviso antepuesto en `runs/audit-2.md` alcanza: identifica el SHA y deployment superados, explica por qué ya no aplican y corrige las dos imprecisiones sin borrar el informe original.
  - V12 y las cinco filas sintéticas pendientes están declaradas con claridad como acciones del HITL 2; no se presentan como validadas ni cerradas.
```

La evidencia es fiel al estado verificado:

- `runs/decision.md` documenta los fallos propios completos: diagnóstico equivocado del 500, marca incrustada en píxeles, medición con `innerWidth`, tres guards ineficaces y empeoramiento temporal de `404.html` (`decision.md`, secciones correspondientes desde la línea 900).
- La corrección de los guards está respaldada por los cuatro rechazos reales de `audit-1-intento-5.md` a `audit-1-intento-8.md` y la aprobación de `audit-1-intento-9.md`. Los nueve intentos numerados están persistidos; además existe la auditoría de contingencia separada.
- El hallazgo incorrecto sobre el supuesto conteo de seis tests está respondido en `decision.md`, en la sección “Un hallazgo del auditor que no era correcto”. Se verifican ocho funciones y el auditor posterior confirma la cifra.
- `runs/test-report-5.md:403-405` registra `npm test` 213/213, `pytest` 59/59 y `mkdocs build --strict` OK.
- `runs/decision.md` declara en la sección de pendientes las cinco filas sintéticas para pasar a `estado='descartado'` y la comprobación visual de V12 en teléfono real. `test-report-5.md:425-437` y `:505` explican que las mediciones locales no sustituyen esa comprobación.
- No encontré secretos operativos, tokens, cookies, cabeceras `Authorization`, claves de Supabase ni passwords SMTP. Solo aparecen nombres de variables, placeholders, categorías o fragmentos no utilizables.
- No encontré nombres, teléfonos, emails de pacientes ni información clínica real. Los datos usados están descritos como sintéticos o controlados.
- `producto/ROADMAP.md:119` mantiene `[ ] 16-validacion-mvp-produccion`. No hay tag y la feature sigue sin mergear, conforme a `decision.md`.
- `runs/audit-2.md:1-13` deja visible que el informe aprobado histórico corresponde a otro árbol; el informe original permanece intacto. Esto evita que se confunda con el estado actual.
- La ausencia de GitHub Pages está declarada como limitación de entorno y no como pendiente oculto.

La evidencia permite llegar al HITL 2. El MVP todavía no debe declararse cerrado antes de resolver explícitamente las cinco filas y la validación visual en teléfono real.

AUDITORÍA: APROBADA