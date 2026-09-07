-- Migración: agregar `estado_comunicacion` a `public.leads`
-- Feature: 16-validacion-mvp-produccion
--
-- POR QUÉ NO ALCANZAN LOS FLAGS QUE YA EXISTEN
--
-- `notificacion_clinica_enviada` y `confirmacion_paciente_enviada` dicen
-- si cada correo salió, y se conservan tal cual. Pero para operar hace
-- falta responder otra pregunta: *¿este lead necesita que alguien lo
-- mire?* Con los flags solos hay que deducirlo (`false` puede significar
-- "falló" o "todavía no se intentó"), y no hay dónde anotar que la
-- clínica ya lo gestionó a mano.
--
-- `estado` tampoco sirve: es el seguimiento COMERCIAL del lead (nuevo →
-- contactado → confirmado → descartado). Mezclar ahí el estado de la
-- comunicación automática confundiría dos ciclos de vida distintos: un
-- lead puede estar `contactado` y aun así tener un correo sin enviar.
--
-- Por eso una columna propia, con los cuatro estados del ciclo de vida
-- de la comunicación automática.
--
-- El esquema se nombra explícitamente (`public.leads`) en todos los
-- pasos: depender del `search_path` de quien ejecute la migración es
-- innecesario y puede apuntar a otra tabla homónima.

-- Paso 1: la columna. El default cubre las filas existentes para poder
-- declararla `not null`; el paso 3 las reclasifica con su valor real.
alter table public.leads
    add column if not exists estado_comunicacion text not null default 'pendiente';

-- Paso 2: el CHECK, aparte y con nombre, para poder evolucionarlo sin
-- tocar la columna.
--
-- `if not exists` no aplica a constraints, así que se protege con un
-- bloque condicional. La comprobación se ancla a `conrelid`: buscar solo
-- por `conname` daría un falso positivo si otra tabla —de este esquema o
-- de cualquier otro— tuviera un constraint con el mismo nombre, y la
-- migración se saltaría el CHECK creyendo que ya existe.
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'leads_estado_comunicacion_check'
          and conrelid = 'public.leads'::regclass
          and contype = 'c'
    ) then
        alter table public.leads
            add constraint leads_estado_comunicacion_check
            check (estado_comunicacion in (
                'pendiente',
                'completa',
                'requiere_revision',
                'resuelta_manual'
            ));
    end if;
end $$;

-- Paso 3: backfill de las filas históricas.
--
-- Sin esto, todos los leads anteriores quedarían en `pendiente`, que
-- significa "el proceso de notificaciones todavía no terminó" — y en esas
-- filas terminó hace tiempo. Se clasifica con lo único que se sabe de
-- ellas, que son sus dos flags:
--
--   ambos TRUE  -> 'completa'
--   cualquier otra combinación -> 'requiere_revision'
--
-- Es deliberadamente conservador: `requiere_revision` incluye tanto los
-- fallos reales como los `null` o cualquier estado que no sea un TRUE
-- explícito. Preferimos que alguien mire de más a que un lead con una
-- notificación fallida quede invisible.
--
-- `is not true` en vez de `= false` justamente por eso: cubre `false` y
-- `null` con la misma regla.
--
-- SOLO se tocan las filas que siguen en `pendiente`. Eso hace el paso
-- reejecutable sin pisar nada: en una segunda corrida, las filas ya
-- clasificadas —incluidas las que la clínica marcó `resuelta_manual`—
-- quedan intactas.
--
-- Nota sobre concurrencia: un lead insertado justo mientras corre esta
-- migración está en `pendiente` con sus flags todavía en `false`, así que
-- el backfill lo marcaría `requiere_revision`. No es un problema: el
-- propio endpoint sobrescribe ese valor al terminar sus envíos, unos
-- milisegundos después. Y si esa invocación se cortó a la mitad,
-- `requiere_revision` es exactamente lo que corresponde.
update public.leads
set estado_comunicacion = case
        when notificacion_clinica_enviada is true
         and confirmacion_paciente_enviada is true
            then 'completa'
        else 'requiere_revision'
    end,
    fecha_actualizacion = now()
where estado_comunicacion = 'pendiente';

comment on column public.leads.estado_comunicacion is
    'Ciclo de vida de la notificacion automatica, independiente de `estado` (que es el seguimiento comercial). pendiente: el lead se inserto y todavia no se resolvieron los envios. completa: los dos correos salieron y la base lo refleja. requiere_revision: al menos uno no pudo completarse -o la base no lo refleja- y alguien tiene que gestionarlo a mano; el lead NO se borra y al solicitante NO se le pide reenviar. resuelta_manual: la clinica ya se ocupo del caso.';

-- Paso 4: índice para la cola operativa.
--
-- La consulta operativa es siempre "dame los que hay que revisar", nunca
-- un barrido de la tabla entera. Parcial y no total porque
-- `requiere_revision` deberia ser una minoria muy chica de las filas.
--
-- EXCLUYE los leads `descartado`, y esa exclusión vive acá y no en el
-- backfill a propósito. Un lead descartado que tuvo una notificación
-- fallida SIGUE teniendo `estado_comunicacion = 'requiere_revision'`:
-- eso es lo que realmente pasó, y sobrescribirlo con `resuelta_manual`
-- afirmaría que alguien gestionó esa comunicación —lo que no es cierto—
-- y borraría el dato. Lo que cambia es que ya no hace falta perseguirlo,
-- porque la clínica cerró el caso por el otro eje, el comercial.
--
-- Así los dos ciclos de vida siguen siendo independientes, cada columna
-- dice la verdad, y la cola muestra solo lo accionable. El predicado del
-- índice y el `where` de la consulta documentada son el mismo.
-- Se recrea siempre: una corrida anterior pudo haberlo creado con el
-- predicado viejo, sin la exclusion de `descartado`, y `create index if
-- not exists` no lo actualizaria.
drop index if exists public.leads_requieren_revision_idx;

create index if not exists leads_requieren_revision_idx
    on public.leads (fecha_creacion desc)
    where estado_comunicacion = 'requiere_revision'
      and estado <> 'descartado';
