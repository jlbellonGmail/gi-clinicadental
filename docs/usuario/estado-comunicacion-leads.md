# Solicitudes que necesitan revisión — guía de uso

## Qué pasa cuando falla un correo

Cuando alguien envía el formulario, el sistema hace tres cosas:

1. **Guarda la solicitud.**
2. Avisa a la clínica por correo.
3. Le confirma la recepción a la persona por correo.

El paso 1 es el importante: **la solicitud queda guardada aunque los
correos fallen.** Nunca se pierde por un problema de correo.

Si alguno de los dos correos no sale, esa solicitud queda marcada como
**"requiere revisión"**, y hay que gestionarla a mano. Es un caso poco
frecuente, pero tiene que revisarse: si el que falló fue el aviso a la
clínica, **nadie se enteró por correo de que llegó esa solicitud**.

## Qué ve la persona que completó el formulario

| Situación | Mensaje que ve |
|---|---|
| Todo salió bien | **Solicitud enviada** — "Recibimos tu solicitud correctamente." |
| La solicitud se guardó pero falló algún correo | **Solicitud registrada** — "Tuvimos un inconveniente al completar las notificaciones, pero tu solicitud quedó registrada." |
| La solicitud no se pudo guardar | **No pudimos registrar tu solicitud** — "Intentá nuevamente en unos minutos." |

En el segundo caso el mensaje dice explícitamente **"No es necesario que
vuelvas a enviar el formulario"**. Es importante: la solicitud ya está
guardada, y reenviarla crearía una duplicada.

Solo en el tercer caso se le pide reintentar, porque ahí no quedó nada
guardado.

Ningún mensaje afirma que se haya enviado un correo. El sitio confirma lo
único que puede asegurar en ese momento: que recibió la solicitud.

## Cómo revisar las solicitudes pendientes

En el panel de **Supabase**, sección **SQL Editor**:

```sql
select id, fecha_creacion, nombre, email, servicio,
       notificacion_clinica_enviada, confirmacion_paciente_enviada
from leads
where estado_comunicacion in ('requiere_revision', 'pendiente')
order by fecha_creacion desc;
```

Las dos últimas columnas dicen qué correo faltó:

- `notificacion_clinica_enviada` en `false` → **la clínica no recibió el
  aviso**. Esta consulta es la única forma de enterarse.
- `confirmacion_paciente_enviada` en `false` → la persona no recibió su
  confirmación. Conviene tenerlo en cuenta al llamarla: puede no estar
  segura de que su solicitud llegó.

## Después de gestionarla

Cuando ya se contactó a la persona, marcá esa solicitud como resuelta:

```sql
update leads
set estado_comunicacion = 'resuelta_manual',
    fecha_actualizacion = now()
where id = 'PEGAR-ACA-EL-ID-DE-LA-FILA';
```

**Siempre con el `id` de esa fila.** Nunca sin `where`: eso tocaría todas
las solicitudes.

## Lo que no hay que hacer

- **No borrar la solicitud.** Los datos de contacto son lo valioso; el
  correo se puede reenviar, una solicitud borrada no se recupera.
- **No pedirle a la persona que vuelva a completar el formulario.** Ya
  está guardada, y se crearía una duplicada.
- **No reenviar el correo de confirmación sin mirar antes la columna.** Si
  ya se había enviado, un segundo correo confunde.
