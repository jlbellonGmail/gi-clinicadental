# Operación del sistema de leads — Guía práctica

Para quien administra la captación de pacientes de Sonríe más: cómo saber
si un lead quedó sin atender, cómo detectar que un aviso por correo falló,
cómo llevar el seguimiento en Supabase y cómo cambiar una credencial sin
exponerla.

No hace falta ser programador. Sí hace falta acceso al panel de Supabase
y, para la parte de diagnóstico técnico, al panel de Vercel.

## De un vistazo

Cuando alguien completa el formulario del sitio pasan tres cosas
independientes:

1. **El lead se guarda** en la tabla `leads` de Supabase.
2. **La clínica recibe un aviso** por correo.
3. **El paciente recibe una confirmación** de que su solicitud llegó.

Lo importante: **si 2 o 3 fallan, el lead igual quedó guardado.** El
paciente ve el mensaje de éxito y la solicitud existe. Por eso el control
diario no es la casilla de correo, es la tabla.

## Panel de Supabase

Supabase → el proyecto → **Table Editor** → tabla `leads`. Para las
consultas de este documento, **SQL Editor**.

Columnas que importan para operar:

| Columna | Para qué |
|---|---|
| `id` | Identificador del lead. Es el `lead_id` que aparece en los logs técnicos. |
| `nombre`, `email`, `telefono`, `mensaje`, `servicio` | Datos de contacto que dejó el paciente. |
| `estado` | Seguimiento comercial: `nuevo`, `contactado`, `confirmado`, `descartado`. |
| `notificacion_clinica_enviada` | `true` si el aviso a la clínica salió bien. |
| `confirmacion_paciente_enviada` | `true` si la confirmación al paciente salió bien. |
| `fecha_creacion` | Cuándo llegó. |

Por ahora la administración se hace **exclusivamente desde este panel
protegido**. No existe un panel administrativo propio, y no está previsto
construirlo todavía.

## Revisión diaria

### 1. Leads pendientes de atender

```sql
select id, fecha_creacion, nombre, telefono, email, servicio
from leads
where estado = 'nuevo'
order by fecha_creacion asc;
```

Los más antiguos primero: son los que llevan más tiempo esperando.

### 2. Leads cuyo aviso por correo falló

Éstos son los urgentes: **nadie en la clínica recibió el correo**, así que
si no se miran acá, no se enteran por ningún otro lado.

```sql
select id, fecha_creacion, nombre, telefono, email
from leads
where notificacion_clinica_enviada = false
  and estado = 'nuevo'
order by fecha_creacion asc;
```

### 3. Pacientes que no recibieron su confirmación

Menos urgente, pero conviene saberlo antes de llamar: esa persona no
recibió ningún acuse, y puede no recordar haber enviado la solicitud.

```sql
select id, fecha_creacion, nombre, email
from leads
where confirmacion_paciente_enviada = false
order by fecha_creacion desc;
```

### 4. Resumen rápido del día

```sql
select estado,
       count(*) as total,
       count(*) filter (where notificacion_clinica_enviada = false) as sin_aviso
from leads
where fecha_creacion >= now() - interval '1 day'
group by estado;
```

## Llevar el seguimiento: los cuatro estados

| Estado | Significado |
|---|---|
| `nuevo` | Llegó y todavía nadie lo contactó. Es el valor inicial. |
| `contactado` | Alguien de la clínica ya se comunicó con la persona. |
| `confirmado` | El paciente tiene turno confirmado. |
| `descartado` | No prosperó: no contesta, no corresponde, duplicado, consulta fuera de alcance. |

Para cambiar el estado, en **Table Editor**: buscar la fila, hacer clic en
la celda `estado`, elegir el nuevo valor y guardar.

La base sólo acepta esos cuatro valores. Si se escribe cualquier otro, la
edición es rechazada — es una protección deliberada para que el seguimiento
no se llene de variantes.

## Qué hacer cuando un aviso falló

**Lo primero, y lo más importante: el lead no se perdió.** Está en la
tabla, con todos sus datos de contacto.

El procedimiento real es:

1. Detectar la fila con la consulta 2 de arriba.
2. **Contactar al paciente por los medios habituales** — teléfono o
   WhatsApp con los datos que se ven en el panel.
3. Pasar el `estado` a `contactado`.

### Sobre "reenviar" el aviso

**No existe hoy ningún mecanismo para reenviar una notificación**, ni un
botón ni un comando. No lo hay, y este documento no va a describir uno que
no existe. La recuperación es la de arriba: detectar y contactar a mano.

Y una advertencia concreta: **volver a completar el formulario no sirve
como reenvío.**

- Dentro de los primeros 5 minutos, el sistema reconoce la repetición y
  devuelve el lead que ya existe, sin mandar ningún correo nuevo.
- Pasados los 5 minutos, crea un **lead duplicado**, que después hay que
  limpiar a mano.

Un reenvío real es una funcionalidad pendiente, no una que esté escondida.

## Diagnóstico técnico en Vercel

Cuando hace falta saber *por qué* falló algo. Vercel Dashboard → el
proyecto → **Logs** (según la versión del panel, bajo *Observability* →
*Runtime Logs*).

Cada línea es un evento en formato técnico. Se puede buscar por el `id` del
lead —aparece como `lead_id`— para ver qué pasó con esa solicitud.

Qué significan los eventos que más importan:

| Si aparece | Quiere decir |
|---|---|
| `supabase_insercion_ok` | El lead se guardó bien. |
| `smtp_clinica_error` | El aviso a la clínica no salió. |
| `smtp_paciente_error` | La confirmación al paciente no salió. |
| `smtp_configuracion_error` | Falta o está mal alguna credencial de correo. |
| `error_no_controlado` | Fallo inesperado; hace falta soporte técnico. |

**Los logs no contienen datos personales de pacientes**: no llevan nombre,
correo, teléfono ni el texto del mensaje. Están diseñados así a propósito.
Para ver los datos del paciente se usa el panel de Supabase, que está
protegido.

El detalle de cada código está en la documentación técnica
(`docs/tecnica/observabilidad-y-operacion.md`).

**Atención**: cuánto tiempo se conservan estos logs depende del plan
contratado en Vercel. Conviene verificarlo en el panel antes de confiar en
que un log de hace días siga estando. La tabla `leads` en Supabase, en
cambio, es permanente.

## Cambiar una credencial sin exponerla

Aplica a la contraseña SMTP de Ferozo y a las claves de Supabase.

### Reglas que no se negocian

- Las credenciales viven **únicamente** en Vercel → Settings → Environment
  Variables. Nunca en el repositorio, en un documento, en un chat, en un
  correo ni en una captura de pantalla.
- `SUPABASE_SERVICE_ROLE_KEY` y `SMTP_PASS` son secretas. Si alguna se
  expuso, aunque sea por un momento, hay que rotarla — no alcanza con
  borrar el mensaje.
- Hay que cargarlas en **los dos entornos**, Preview y Production.

### Procedimiento recomendado (si el proveedor permite convivencia)

Cuando se pueden tener la credencial vieja y la nueva activas a la vez,
este orden evita cualquier corte:

1. **Crear** la credencial nueva en el proveedor, sin tocar la anterior.
2. **Configurarla** en Vercel → Settings → Environment Variables, en
   Preview y Production.
3. **Redesplegar.** Este paso es obligatorio, no opcional: mientras no se
   redespliega, el sistema puede seguir usando la credencial vieja, porque
   la conexión queda guardada en memoria de la instancia en ejecución.
4. **Verificar** que todo el circuito funciona: enviar una solicitud de
   prueba y comprobar que el lead se guarda y que llegan los dos correos.
5. **Recién entonces, revocar** la credencial anterior.

Si algo falla en el paso 4, se vuelve al valor anterior y se investiga: la
credencial vieja todavía funciona, así que no hay servicio caído.

### Si el proveedor NO permite convivencia

Es el caso típico de un cambio de contraseña SMTP, donde la anterior deja
de servir en el mismo momento. **Verificar antes cuál de los dos casos
aplica** a Ferozo y a Supabase; no se puede asumir.

Cuando no hay convivencia posible:

1. Elegir una **ventana de baja actividad** y avisar a la clínica.
2. Cambiar la credencial en el proveedor.
3. Actualizarla en Vercel, en los dos entornos.
4. Redesplegar de inmediato.
5. Verificar el circuito completo.
6. Revisar la consulta 2 de este documento: los leads que hayan entrado
   durante la ventana pueden haber quedado con
   `notificacion_clinica_enviada = false`, y se atienden a mano.

Entre los pasos 2 y 4 los correos van a fallar. Los leads se siguen
guardando igual — no se pierde ninguno.

### Después de rotar

Confirmar que el sistema quedó sano:

```sql
select count(*) as fallidos
from leads
where fecha_creacion >= now() - interval '1 hour'
  and notificacion_clinica_enviada = false;
```

Si da `0` después de una prueba real, la rotación salió bien.
