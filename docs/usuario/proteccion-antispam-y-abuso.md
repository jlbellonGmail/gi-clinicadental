# Protección antispam y abuso — documentación de usuario

## Para qué sirve

Suma varias capas de protección al formulario de contacto de la clínica
para reducir dos problemas típicos de cualquier formulario web público:

- **Envíos automatizados (bots/spam)**: programas que rellenan
  formularios en masa para meter contenido publicitario o malicioso en
  la lista de contactos de la clínica.
- **Envíos duplicados accidentales**: un mismo paciente que, por
  ansiedad, mala conexión o doble clic, termina enviando el mismo
  formulario dos veces en pocos minutos.

Ninguna de estas protecciones cambia lo que ve el paciente en el sitio
ni le pide nada adicional (no hay "marcá esta casilla para probar que no
sos un robot", no hay CAPTCHA visible). Trabajan de forma invisible, en
el servidor.

## Cómo funciona, en criollo

1. **Solo se aceptan pedidos que vengan realmente del sitio.** Si alguien
   intenta enviar datos directamente al sistema desde otro sitio web o
   una herramienta externa, se rechaza automáticamente.
2. **Un "campo trampa" invisible.** El formulario real (cuando se
   conecte, ver "Qué falta todavía" abajo) va a tener un campo oculto
   que ningún humano ve ni completa. Los bots que rellenan formularios a
   ciegas sí lo completan, y eso los delata: la solicitud se rechaza sin
   guardar nada.
3. **Un control de "esto se llenó demasiado rápido".** Si un formulario
   se envía en menos de 3 segundos desde que se mostró, es una señal
   fuerte de que no lo llenó una persona (nadie escribe nombre, email y
   mensaje en menos de 3 segundos). Se rechaza.
4. **Detección de duplicados recientes.** Si llega dos veces el mismo
   nombre y el mismo email dentro de los 5 minutos, la segunda vez no se
   guarda un contacto nuevo: se responde como si se hubiera guardado
   (para no confundir a quien envió el formulario, que no ve ningún
   error), pero por dentro no se duplica el registro.
5. **Registro interno de rechazos, sin datos personales.** Cada vez que
   se rechaza un intento (por cualquiera de los motivos de arriba), queda
   una anotación técnica interna con la fecha y el motivo, pero **nunca**
   con el nombre, email, teléfono o mensaje de quien lo envió, ni con su
   dirección de red en texto claro. Esto permite a quien mantiene el
   sitio ver cuánta actividad sospechosa hay, sin exponer datos de nadie.

## Qué NO hace (por ahora)

- **No agrega un CAPTCHA visible** (esas pruebas de "elegí las imágenes
  con semáforos" o "no soy un robot"). Se decidió no sumar esa fricción
  para el paciente mientras las protecciones invisibles de arriba sean
  suficientes. Si en el futuro se detecta abuso real que estas capas no
  frenan, agregar un CAPTCHA es una posibilidad a evaluar más adelante,
  con su propia decisión y su propio costo (depende de un servicio
  externo).
- **No elimina por completo la posibilidad de un envío duplicado en
  casos muy puntuales** (por ejemplo, si alguien hace doble clic en
  "Enviar" en el mismo instante, antes de que la página termine de
  procesar el primer clic). Es un caso raro y de bajo impacto: en el
  peor caso quedan dos contactos casi idénticos del mismo paciente,
  fáciles de identificar y unificar manualmente por quien gestiona los
  leads. No implica pérdida de información ni un riesgo de seguridad.

## Qué falta todavía

El formulario visible en el sitio (`index.html`) **todavía no está
conectado** a este sistema — sigue mostrando una confirmación simulada,
sin enviar datos reales a ningún lado. Esa conexión es una etapa
posterior del proyecto (feature `08-conexion-frontend-api`). Recién ahí
el "campo trampa" y el control de "se llenó demasiado rápido" empiezan a
operar contra visitantes reales del sitio; hasta entonces, estas
protecciones ya existen del lado del servidor, listas para cuando el
formulario se conecte.

## Dónde ver esto en funcionamiento

No hay nada que configurar manualmente para que estas protecciones
funcionen: quedan activas automáticamente en cuanto el sitio recibe
solicitudes reales al sistema de contacto. La única configuración
opcional es una lista de "sitios adicionales permitidos"
(`ALLOWED_ORIGINS`, en la configuración técnica de Vercel), útil solo si
en el futuro se necesita que más de un sitio web pueda enviar contactos
al mismo sistema — no hace falta tocarla para el funcionamiento normal
de la clínica.
