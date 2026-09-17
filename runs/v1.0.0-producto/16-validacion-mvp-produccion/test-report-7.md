# Test report 7 — Diálogo, éxito parcial y estado de comunicación

**Etapa**: 16-validacion-mvp-produccion.
**Fecha**: 2026-09-07.
**Autor**: Claude Code.
**Origen**: ampliación de alcance pedida por el humano, con un
**bloqueante** reportado: el diálogo "Solicitud enviada" se veía al entrar
al sitio.

```yaml
status: liberado_pendiente_de_migracion_y_validacion_C
candidato_aprobado: a64c6e91441286bda99b70094362e6a3870906cf   # PR 44
main: af85b8b62221ee8f0364d3851e27b0d4b23139d0                 # PR 45
deployment: 6309506246 (Production, success)
auditorias:
  - audit-4-punto-16.md (Codex, sobre 08f97e2, NO APROBADA)
  - audit-5-punto-16.md (Codex, sobre a64c6e9, APROBADA)
suites:
  npm_test: 272/272   # eran 248
  pytest: 69/69       # eran 60
  mkdocs_strict: ok
verificacion_en_las_dos_direcciones:
  defectos_en_rojo: 28
  cambios_inocuos_en_verde: 4
production:
  A_carga_inicial: PASS
  B_refresh: PASS
  C_envio_real: pendiente de la migracion
pendiente:
  - aplicar la migracion en el Supabase de Production
  - validacion C (un envio real)
  - revisar logs
  - descartar los leads sinteticos
```

## El bloqueante: por qué el diálogo se veía al cargar

**No era JavaScript.** El atributo `hidden` estaba puesto en el HTML y
`modal.hidden` era `true`. Lo que fallaba era la cascada:

```
[hidden] { display: none }   <- hoja del NAVEGADOR (user agent)
.modal   { display: flex }   <- hoja del SITIO (autor)
```

**Cualquier regla de autor le gana a la del agente de usuario**, sin
importar la especificidad. El `display: flex` anulaba el `hidden`.

Reproducido en Production antes de tocar nada: `hidden` presente,
`modal.hidden === true`, `display` computado `flex`, altura renderizada
distinta de cero.

### Lo grave: los tests decían que estaba bien

`script.test.js` comprobaba `modal.hidden === true` — **y era cierto**.
Con el mismo HTML y el mismo CSS, jsdom devuelve `display: none`, porque
su cascada no modela la precedencia entre estilos de autor y de agente de
usuario. **Un guard que corre en el motor equivocado no es un guard.**

Es la quinta vez en esta etapa que aparece un guard incapaz de ver su
defecto, y la más instructiva: los cuatro anteriores tenían errores de
implementación; éste era correcto y aun así ciego, porque el entorno de
test no reproduce el fenómeno.

### Corrección

```css
[hidden] {
    display: none !important;
}
```

La red idiomática, que además protege a cualquier elemento futuro que use
`hidden`. El guard que la vigila vive en `tests/test_dialogo_resultado.py`
—sobre el CSS, no sobre jsdom— y la comprobación final se hizo en un
navegador real.

## Tres resultados terminales, no dos

Un `201` significa "el lead quedó registrado", **no** que las dos
notificaciones hayan salido. El endpoint ahora lo informa:

```json
{ "id": "...", "comunicacion_completa": true, "requiere_revision": false }
```

| Resultado | Título | Formulario | ¿Invita a reintentar? |
|---|---|---|---|
| Éxito completo | Solicitud enviada | se limpia | no |
| Éxito parcial | Solicitud registrada | se limpia | **no**, lo dice explícitamente |
| Fallo de registro | No pudimos registrar tu solicitud | **se conserva** | sí |

La regla crítica: en el parcial **el lead ya existe**, así que invitar a
reenviar generaría un duplicado. Ante la duda —un `201` sin el campo, o
con el cuerpo ilegible— se elige lo conservador: **parcial**.

Una sola infraestructura de diálogo para los tres, con los textos en el
HTML. Ningún mensaje afirma que se haya enviado un correo.

## Estado operativo: dos preguntas, no una

`audit-4` encontró que el estado podía quedar `completa` con la base
inconsistente. Si un correo salía pero su `UPDATE` de flag fallaba, el
flag quedaba en `false`, la consulta operativa **no encontraba ese lead**,
y `estado_comunicacion` decía `completa`. Quedaba invisible.

Son dos preguntas distintas:

| Pregunta | Decide |
|---|---|
| ¿Salieron los dos correos? | el mensaje que ve la persona |
| ¿La base **refleja** que salieron? | `estado_comunicacion` |

Ahora `completa` exige las dos cosas. Conservador a propósito: revisar de
más cuesta un minuto; un lead invisible cuesta una solicitud.

## SMTP: la pregunta no era si el fallo fue pasajero

La versión anterior reintentaba `ETIMEDOUT`. **Está mal**: un timeout de
socket puede ocurrir *después* de que el servidor aceptó el mensaje, y
reintentar manda el correo dos veces.

Ahora solo se reintenta lo que se puede demostrar que no llegó a
entregarse: errores de conexión y DNS, `ETIMEDOUT` marcado como
`command: 'CONN'`, y rechazos SMTP 4xx explícitos. Lo demás queda en
`requiere_revision`, visible para operación. Se conserva el pool de una
conexión.

## Un guard de privacidad que no comprobaba lo que decía

La verificación en negativo destapó que el guard del logger fijaba los
**nombres** de los campos permitidos, no su comportamiento: cambiar un
validador cerrado por uno de texto libre pasaba en verde. Hay un test
nuevo que alimenta cada campo con una cadena hostil y exige que no salga
intacta por ningún canal.

## Auditoría independiente

| Ronda | SHA | Veredicto |
|---|---|---|
| `audit-4-punto-16` | `08f97e2` | NO APROBADA — estado inconsistente, hueco en el guard de `[hidden]`, fallo de red ambiguo |
| `audit-5-punto-16` | `a64c6e9` | **APROBADA** |

## Validación en Production

| | |
|---|---|
| PR de release | **#45**, `develop` → `main` |
| `main` | `af85b8b62221ee8f0364d3851e27b0d4b23139d0` |
| Deployment | `6309506246`, Production, **success** |

### A — Abrir el sitio desde cero: **PASS**

| Comprobación | Resultado |
|---|---|
| Atributo `hidden` presente | sí |
| `display` computado | **`none`** |
| Altura renderizada | **0 px** |
| Variantes visibles | **0** |
| `body.con-modal` | ausente |
| Scroll horizontal | no |

### B — Refresh: **PASS**

Idéntico, valor por valor.

### C — Envío real: **pendiente**

Requiere la migración aplicada, para que la validación cubra también el
estado persistido en una sola prueba en vez de dos.

## Lo que falta, y por qué no lo puedo hacer

1. **Aplicar la migración** `20260907093000_add_estado_comunicacion.sql`
   en el Supabase de Production. No tengo credenciales, y no debo tenerlas.
   Sin ella el sitio **no se rompe** —el `INSERT` no menciona la columna y
   el `UPDATE` del estado es no fatal, con un test que lo fija— pero el
   estado operativo no se persiste.
2. **La validación C**, que se hace una sola vez después de la migración.
3. **Revisar los logs** de esa request.
4. **Descartar los leads sintéticos.**
