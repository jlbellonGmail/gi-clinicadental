# Validación del MVP en producción — Guía de usuario

Qué es esta etapa, qué se comprueba, qué tiene que hacer una persona y
cómo saber si el MVP quedó realmente cerrado.

## Para qué sirve

Es la comprobación final antes de dar por terminado el MVP: se recorre el
circuito completo **en el sitio público real**, con datos de prueba
inventados a propósito, y se verifica que un paciente que completa el
formulario termine efectivamente en la base de datos de la clínica y que
los dos correos lleguen.

Hasta esta etapa, todo lo anterior se había verificado en pruebas
automatizadas y en entornos de vista previa. Esto responde otra pregunta:
**¿funciona de verdad, en el sitio que ve el paciente?**

## Qué se comprueba, en orden

1. El sitio público carga.
2. Se acepta la política de privacidad.
3. Se envía un formulario válido.
4. La API responde correctamente.
5. El lead queda creado en la base de datos.
6. Llega el aviso por correo a la clínica.
7. Llega la confirmación por correo al paciente.
8. La fila queda con el estado y las marcas correctas.
9. Los registros técnicos (logs) quedan completos.
10. En esos registros **no aparece ningún dato personal ni contraseña**.
11. Todo se ve y funciona bien desde una computadora.
12. Todo se ve y funciona bien desde un celular.

El MVP sólo puede cerrarse si las doce comprobaciones pasan **sin
credenciales expuestas, sin errores críticos y sin pasos manuales que no
estén documentados**.

## Los dos momentos en que hace falta una persona

Todo el resto es automático. Sólo hay **dos** decisiones humanas:

| | Cuándo | Qué se decide |
|---|---|---|
| **HITL 1** | Antes de empezar | Aprobar el plan de la etapa |
| **HITL 2** | Con toda la evidencia a la vista | Aceptar (o no) el cierre del MVP |

No hay aprobaciones intermedias. Las revisiones automáticas, las pruebas,
la auditoría independiente y la publicación son pasos del proceso, no
puntos de decisión.

## Tareas concretas de la persona

Además de las dos decisiones, hay tres cosas que sólo puede hacer
alguien con acceso a los paneles:

1. **Antes de publicar** — en Vercel y Supabase: confirmar que las
   variables del entorno de producción están cargadas, que la tabla de
   leads existe con sus protecciones, y que la dirección pública del sitio
   está correctamente declarada. Se anota **si están o no**, nunca su
   contenido.
2. **Aportar las casillas de correo de prueba**: dos direcciones
   controladas (una para la prueba de escritorio y otra para la de
   celular) y confirmar que se puede abrir el buzón donde la clínica
   recibe los avisos.
3. **Después de la validación**: marcar los leads de prueba como
   `descartado` en el panel de Supabase.

## Los datos de prueba

Están pensados para que nadie los confunda con un paciente real:

| Campo | Escritorio | Celular |
|---|---|---|
| Nombre | `PRUEBA MVP16 DESKTOP` | `PRUEBA MVP16 MOVIL` |
| Correo | una casilla controlada | otra casilla controlada |
| Servicio | Otros | Otros |
| Mensaje | `PRUEBA SINTETICA MVP16 - no es un paciente real - no contactar` + la fecha | ídem |

**No se usa ningún nombre, teléfono, correo ni dato clínico de una persona
real.** Las direcciones de correo las aporta la persona responsable; no se
inventan ni se deducen.

Las dos pruebas usan nombre y correo distintos a propósito: el sistema
descarta envíos repetidos dentro de una ventana de 5 minutos y, si los
datos fueran iguales, la segunda prueba no enviaría correos y parecería un
error donde no lo hay.

## Qué pasa con los leads de prueba

**No se borran.** Quedan en la base de datos como evidencia de que la
validación ocurrió, y se cambian a estado **`descartado`** desde el panel
de Supabase. Así no aparecen en la bandeja de leads pendientes de la
clínica pero la trazabilidad se conserva.

El procedimiento para cambiar estados es el mismo que se usa a diario y
está descrito en
[Observabilidad y operación](observabilidad-y-operacion.md).

## Dos correcciones que se hicieron antes de publicar

No son funcionalidad nueva; son arreglos necesarios para que el primer
sitio estable no salga con errores visibles:

- **La marca**. Varias partes del sitio —el título de la pestaña, los
  textos que aparecen al compartir el enlace en redes sociales y las
  descripciones de las imágenes— todavía decían **"Savia Dental"**, un
  nombre de plantilla, en lugar de **"Sonríe más"**. Se corrigió en las 17
  ocurrencias de las tres páginas públicas.
- **La publicación de la documentación**. El proceso automático que
  construye este manual habría fallado al primer intento, porque intentaba
  publicarlo en GitHub Pages y **Pages no está disponible en este
  repositorio**: es privado y el plan actual no lo incluye. Como no se va a
  cambiar la visibilidad del repositorio ni el plan, se ajustó el proceso
  para que **siempre construya la documentación y verifique que no haya
  enlaces rotos** —eso sigue siendo obligatorio— y **omita la publicación
  sin dar error**. El manual queda descargable desde cada ejecución, como
  archivo adjunto. Si algún día Pages se habilita, la publicación se
  reactiva sola.

También se marcó la versión del proyecto como **1.0.0**, que es la que
corresponde al primer MVP estable en producción.

## Cómo saber si el MVP quedó cerrado

Tres señales, en este orden:

1. En `ROADMAP.md`, el ítem 16 aparece como **`[x]`**. Ese estado lo pone
   una automatización **sólo después** de que la evidencia se integró; no
   se marca a mano.
2. Existe la etiqueta de versión **`v1.0.0`** en el repositorio. La crea
   una persona, nunca un agente, y sólo cuando se cumplen las tres
   condiciones: producción validada, auditoría independiente aprobada y
   HITL 2 aprobado.
3. En `runs/v1.0.0-producto/16-validacion-mvp-produccion/` están el reporte de la prueba
   real (`test-report-2.md`), las capturas y el documento de decisiones.

Si falta cualquiera de las tres, **el MVP no está cerrado**, por más que
el sitio se vea funcionando.

## Si algo falla

No se oculta y no se cierra el MVP. Los fallos se clasifican en tres
grupos, porque la acción es distinta en cada caso:

- **Configuración** (falta una variable, una contraseña cambió, la
  dirección del sitio no coincide): lo corrige una persona en el panel
  correspondiente y se vuelve a probar. **No se toca el código.**
- **Defecto del programa**: se explica la causa y el alcance antes de
  corregir nada. Si el arreglo es pequeño e imprescindible, se hace y se
  repite todo el ciclo de validación. Si es más grande, se anota como
  trabajo aparte y **el MVP no se cierra todavía**.
- **Problema del proveedor** (el servidor de correo, la base de datos o el
  hosting están caídos): se registra la evidencia y se reintenta más
  tarde. No se parchea el código para tapar una caída ajena.

En cualquiera de los tres casos, **no se crea la etiqueta de versión
mientras exista un bloqueo**.

## Si el sitio publicado presenta un problema grave

Hay dos formas de volver atrás, y conviene conocer su límite:

1. **Rápida**: desde el panel de Vercel se puede volver a publicar la
   versión anterior. Aviso importante: la única versión anterior es la del
   19 de agosto de 2026, **sin el formulario funcionando**. Sirve para
   contener el problema, no como estado definitivo.
2. **Ordenada**: revertir el cambio en el repositorio, lo que republica el
   sitio automáticamente y deja constancia de qué se revirtió y por qué.

Dos cosas que **el rollback no deshace**: los leads que ya se guardaron en
la base de datos, y los correos que ya se enviaron.

## Preguntas frecuentes

**¿Por qué hay que publicar antes de validar?**
Porque el sitio público se actualiza únicamente desde la rama estable, y
antes de esta etapa esa rama estaba 86 cambios por detrás: no tenía ni el
formulario funcional ni la página de privacidad. No había forma de validar
en producción algo que producción todavía no tenía.

**¿Por qué no se validó en una vista previa?**
Los entornos de vista previa del proyecto exigen iniciar sesión en Vercel,
así que no reproducen la experiencia de un paciente anónimo. El único
entorno público es producción.

**¿Alguien puede usar el formulario mientras se hace la prueba?**
Sí. Desde el momento en que se publica, el sitio queda operativo para
cualquier visitante. Por eso la ventana de validación es corta y los datos
de prueba llevan el prefijo `PRUEBA MVP16`, para distinguirlos siempre de
un paciente real.

**¿Se prueba el bloqueo por envíos repetidos?**
No en producción. Ese límite depende de la instancia del servidor que
atienda cada pedido, así que la prueba no sería concluyente y generaría
leads y correos innecesarios. Está cubierto por las pruebas automáticas.

**¿Quién audita el resultado?**
Una herramienta independiente (OpenCode) revisa **en modo sólo lectura**,
primero lo que se va a publicar y después la evidencia de la prueba real.
Su informe se guarda tal cual, sin reinterpretarlo.

## Documentación relacionada

- [Pipeline de despliegue Vercel](pipeline-despliegue-vercel.md) — cómo se
  publica el sitio
- [Observabilidad y operación](observabilidad-y-operacion.md) — cómo
  revisar leads, estados y notificaciones fallidas
- [Seguridad y política de privacidad](seguridad-y-politica-privacidad.md)
  — qué se informa al paciente y qué consentimiento se registra
