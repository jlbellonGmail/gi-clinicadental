-- Migración: agregar `estado_comunicacion` a `leads`
-- Feature: 16-validacion-mvp-produccion
--
-- POR QUÉ NO ALCANZAN LOS FLAGS QUE YA EXISTEN
--
-- `notificacion_clinica_enviada` y `confirmacion_paciente_enviada` dicen
-- si cada correo salió, y se conservan tal cual. Pero para operar hace
-- falta responder otra pregunta: *¿este lead necesita que alguien lo
-- mire?* Con los flags sola hay que deducirlo (`false` puede significar
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

alter table leads
    add column if not exists estado_comunicacion text not null default 'pendiente';

-- El CHECK va aparte y con nombre, para poder evolucionarlo sin tocar la
-- columna. `if not exists` no aplica a constraints, así que se protege
-- con un bloque condicional: la migración tiene que poder reejecutarse.
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'leads_estado_comunicacion_check'
    ) then
        alter table leads
            add constraint leads_estado_comunicacion_check
            check (estado_comunicacion in (
                'pendiente',
                'completa',
                'requiere_revision',
                'resuelta_manual'
            ));
    end if;
end $$;

comment on column leads.estado_comunicacion is
    'Ciclo de vida de la notificacion automatica, independiente de `estado` (que es el seguimiento comercial). pendiente: el lead se inserto y todavia no se resolvieron los envios. completa: los dos correos salieron. requiere_revision: al menos uno no pudo completarse y alguien tiene que gestionarlo a mano; el lead NO se borra y al solicitante NO se le pide reenviar. resuelta_manual: la clinica ya se ocupo del caso.';

-- Índice parcial: la consulta operativa es siempre "dame los que hay que
-- revisar", nunca un barrido de la tabla entera. Parcial y no total
-- porque `requiere_revision` debería ser una minoría muy chica de las
-- filas, y así el índice se mantiene pequeño.
create index if not exists leads_requieren_revision_idx
    on leads (fecha_creacion desc)
    where estado_comunicacion = 'requiere_revision';
