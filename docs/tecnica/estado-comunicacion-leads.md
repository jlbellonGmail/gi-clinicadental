# Estado de comunicación de los leads — documentación técnica

## El problema que resuelve

Un `201` del endpoint significa **"el lead quedó registrado"**. No
significa que las dos notificaciones por correo hayan salido.

Los dos flags que ya existían —`notificacion_clinica_enviada` y
`confirmacion_paciente_enviada`— dicen si cada correo salió, y se
conservan. Pero para operar hacía falta responder otra pregunta:
*¿este lead necesita que alguien lo mire?* Con los flags solos hay que
deducirlo, porque un `false` puede significar dos cosas distintas —"falló"
o "todavía no se intentó"— y no hay dónde anotar que la clínica ya lo
gestionó a mano.

## La columna

`leads.estado_comunicacion`, agregada en
`supabase/migrations/20260907093000_add_estado_comunicacion.sql`.

| Estado | Significa |
|---|---|
| `pendiente` | el lead se insertó y todavía no se resolvieron los envíos |
| `completa` | los dos correos salieron |
| `requiere_revision` | al menos uno no pudo completarse: alguien tiene que gestionarlo |
| `resuelta_manual` | la clínica ya se ocupó del caso |

**No se mezcla con `estado`**, que es el seguimiento *comercial* del lead
(`nuevo` → `contactado` → `confirmado` → `descartado`). Son dos ciclos de
vida distintos: un lead puede estar `contactado` y aun así tener un correo
sin enviar.

### Por qué el `default` importa

La columna se declara `not null default 'pendiente'`, y el `INSERT` del
endpoint **no la menciona**. Es deliberado: si el `INSERT` la nombrara y
la migración no estuviera aplicada, la inserción entera fallaría y se
perdería el lead. Dejándola al `default`, el camino crítico no depende de
la migración.

## Cómo se escribe

Después de resolver los dos envíos, y **antes** de responder:

```js
// Lo que ve la persona: ¿salieron los dos correos?
const comunicacionCompleta = clinicSendSucceeded && patientSendSucceeded;
// Lo que ve operación: ¿la base lo refleja? Ver "Cuándo se marca
// requiere_revision" más abajo.
const baseConsistente = clinicFlagPersistido && patientFlagPersistido;
const estadoComunicacion =
  comunicacionCompleta && baseConsistente ? 'completa' : 'requiere_revision';
```

Ese `UPDATE` es **deliberadamente no fatal** y va separado de los flags.
El dato crítico es el lead, y ya está insertado: si la columna no existe
todavía, el `UPDATE` falla, se registra el evento
`estado_comunicacion_error`, y ni la respuesta ni los flags se ven
afectados. Hay un test que lo fija.

El valor de la respuesta **se deriva en memoria**, no se relee de la base:
el contrato con el frontend no depende de que ese `UPDATE` salga bien.

## Contrato con el frontend

```json
{ "id": "...", "comunicacion_completa": true, "requiere_revision": false }
```

Tres campos y nada más. **No se expone** nada de SMTP, ni el proveedor, ni
códigos, ni motivos, ni qué envío falló: el frontend no lo necesita y
exponerlo solo agregaría superficie. Hay un test que verifica que el
cuerpo serializado no contenga esas palabras.

El camino de idempotencia —cuando se detecta un duplicado reciente—
devuelve el estado **real del lead que ya existe**, derivado de sus dos
flags. No reenvía correos y no afirma una comunicación completa que quizá
no ocurrió.

## Procedimiento operativo

### Encontrar los leads que necesitan revisión

Desde el SQL Editor de Supabase, con `service_role`:

```sql
select id, fecha_creacion, nombre, email, servicio,
       notificacion_clinica_enviada, confirmacion_paciente_enviada
from public.leads
where estado_comunicacion = 'requiere_revision'
  and estado <> 'descartado'
order by fecha_creacion desc;
```

Los dos flags dicen **cuál** de los dos correos faltó: si
`notificacion_clinica_enviada` es `false`, la clínica nunca se enteró por
correo y este listado es la única forma de verlo.

Hay un índice parcial (`leads_requieren_revision_idx`) con **exactamente
este predicado**. Es parcial y no total porque `requiere_revision` debería
ser una minoría muy chica de las filas, y hay un test que verifica que la
consulta documentada y el índice no diverjan: si divergen, el índice deja
de servir.

### Por qué se excluyen los `descartado`

Un lead que la clínica ya descartó no necesita que nadie lo persiga,
aunque su notificación haya fallado.

La exclusión vive **en la consulta y en el índice, no en el dato**. El
`estado_comunicacion` de ese lead sigue diciendo `requiere_revision`,
porque eso es lo que realmente pasó con su notificación. Sobrescribirlo
con `resuelta_manual` durante el backfill habría afirmado que alguien
gestionó esa comunicación —lo que no es cierto— y habría borrado la
información.

Así los dos ejes siguen siendo independientes: `estado` dice dónde está
comercialmente, `estado_comunicacion` dice qué pasó con los correos, y la
cola operativa —que es una tercera cosa: qué hay que hacer hoy— se arma
combinando los dos.

### Marcar uno como resuelto

Cuando alguien ya se comunicó con la persona:

```sql
update public.leads
set estado_comunicacion = 'resuelta_manual',
    fecha_actualizacion = now()
where id = '<uuid del lead>';
```

**Siempre por `id`.** Nunca un `update` masivo sobre la tabla: un `where`
mal escrito puede tocar leads reales.

### Lo que NO hay que hacer

- **No borrar el lead.** Un fallo de correo no es motivo para perder una
  solicitud: los datos de la persona son lo valioso.
- **No pedirle a la persona que reenvíe el formulario.** El lead ya está
  guardado; reenviar lo duplicaría. El diálogo de éxito parcial se lo dice
  explícitamente.
- **No reenviar el correo a mano sin mirar los flags.** Si
  `confirmacion_paciente_enviada` es `true`, el paciente ya recibió su
  confirmación y un segundo correo sería confuso.

## Por qué no hay un panel de administración

Para este MVP alcanza con persistencia correcta, un estado explícito, una
consulta segura y un procedimiento documentado. Construir una aplicación
administrativa ahora sería trabajo grande para un volumen que todavía no
existe, y la clínica ya entra al panel de Supabase.

## El backfill de los leads históricos

La columna se agrega con `default 'pendiente'` para poder declararla
`not null`, pero dejarla así sería mentir: `pendiente` significa "el
proceso de notificaciones todavía no terminó", y en una fila de hace
semanas terminó hace tiempo. Su resultado ya se conoce — está en los dos
flags.

Por eso la migración reclasifica las filas existentes:

| Condición | Estado asignado |
|---|---|
| `notificacion_clinica_enviada is true` **y** `confirmacion_paciente_enviada is true` | `completa` |
| cualquier otra combinación | `requiere_revision` |

Es deliberadamente conservador. Se usa `is true` y no `= false`, así que
un flag en `null` cae en `requiere_revision` junto con los `false`: un
`null` no es una notificación enviada, y preferimos que alguien mire de
más antes que dejar invisible un lead cuya notificación quizá falló.

**El backfill solo toca las filas que siguen en `pendiente`.** Eso lo hace
reejecutable sin daño: en una segunda corrida, las filas ya clasificadas
—incluidas las que la clínica marcó `resuelta_manual`— quedan intactas.

Después de la migración, `pendiente` vuelve a significar lo que dice: un
lead nuevo cuyo proceso de notificaciones todavía no terminó.

## Cuándo se marca `requiere_revision`

No alcanza con "¿salieron los dos correos?". Son **dos preguntas
distintas**, y confundirlas dejaba la base mintiendo:

| Pregunta | Para qué sirve |
|---|---|
| ¿Salieron los dos correos? | decide el mensaje que ve la persona (`comunicacion_completa`) |
| ¿La base **refleja** que salieron? | decide `estado_comunicacion` |

Un correo puede enviarse y su `UPDATE` de flag fallar. Entonces el flag
queda en `false` y la consulta operativa no encontraría ese lead —
mientras `estado_comunicacion` decía `completa`. **Ese lead quedaba
invisible.** Lo señaló `audit-4-punto-16.md`.

Por eso `completa` exige las dos cosas: los dos envíos exitosos **y** los
dos flags persistidos. Si algo de eso falla, `requiere_revision`, aunque
los correos hayan salido. Es conservador a propósito: revisar de más
cuesta un minuto; un lead invisible cuesta una solicitud perdida.

## El fallo de red del navegador: un caso ambiguo declarado

Si el `fetch` del formulario **rechaza**, no hubo respuesta, y la request
pudo haber llegado e insertado el lead antes de perderse. Desde el
navegador no hay forma de distinguirlo.

En ese caso se muestra el diálogo de error, que invita a reintentar. Es
seguro porque el formulario conserva los datos y **el endpoint es
idempotente**: ante el mismo nombre y email dentro de su ventana devuelve
el lead que ya existe, sin insertar otro ni reenviar correos. Es la
segunda línea de defensa, y es la que cubre este caso.

**Límite residual, declarado:** pasada esa ventana, un reintento sobre un
lead que sí se había guardado crea un duplicado. Es inherente a cualquier
envío "al menos una vez" sin un identificador de intento generado en el
cliente. Si aparece, se ve como dos filas con el mismo email y minutos de
diferencia.

## Límite conocido

`pendiente` es un estado que en la práctica casi no se ve: solo existe
entre el `INSERT` y el `UPDATE` final, milisegundos después, dentro de la
misma request. Si aparece un lead que quedó en `pendiente`, significa que
la función se cortó a la mitad —timeout de plataforma, por ejemplo— y ese
caso **también hay que revisarlo a mano**: los correos pueden haber salido
o no.

Una consulta que los incluya:

```sql
select id, fecha_creacion, estado_comunicacion
from public.leads
where estado_comunicacion in ('requiere_revision', 'pendiente')
  and estado <> 'descartado'
order by fecha_creacion desc;
```
