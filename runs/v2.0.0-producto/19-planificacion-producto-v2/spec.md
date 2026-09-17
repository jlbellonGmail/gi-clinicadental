# Spec — 19-planificacion-producto-v2

## Objetivo

Convertir la visión aprobada de ClínicaDental v2 en un diseño funcional,
arquitectónico y de roadmap ejecutable, sin implementar funcionalidades,
migraciones, endpoints ni cambios de infraestructura.

## Baseline

La unidad parte de `develop@35737852297ee7d02c7f2e8023d1ff4e5b423b46`, con
release de tooling `v1.0.2` y producto funcional `1.0.1`. La procedencia del
mecanismo es Template `v2.0.0@f5d4b6cc029c34c0d0c05831bfd28134276fa167`.

## Alcance

- Inventariar capacidades reales de v1 desde código, tests, configuración y documentación.
- Definir brechas, dominios, dependencias y arquitectura funcional de v2.
- Diseñar unidades incrementales con alcance, exclusiones, dependencias, riesgos, aceptación, evidencias y cierre.
- Identificar la primera unidad de construcción posterior a esta planificación.
- Incorporar multi-clínica/multi-sede, dominio clínico, reserva directa y uso seguro con pacientes reales.

## Exclusiones

No se implementan agenda, pacientes v2, historia clínica, odontograma,
tratamientos, pagos, endpoints, tablas, chatbot, voz, UI, despliegues, tags,
releases ni cambios en main, Template, secretos o infraestructura.

## Criterios de aceptación

1. `docs/tecnica/planificacion-producto-v2.md` contiene baseline, brechas, mapa funcional, dependencias, roadmap, primera unidad, riesgos, decisiones confirmadas, pendientes y criterios.
2. `docs/usuario/planificacion-producto-v2.md` explica el alcance y el siguiente flujo sin presentar planificación como funcionalidad existente.
3. `runs/v2.0.0-producto/19-planificacion-producto-v2/decision.md` registra decisiones demostrables y el modo SDD obtenido por ASSESS.
4. `runs/v2.0.0-producto/19-planificacion-producto-v2/work-unit.json` mantiene identidad exacta entre ROADMAP, rama, unitId, canonicalSlug y runPath, sin usar `v2.0.0` como versión de producto.
5. Los índices técnico y de usuario contienen un enlace exacto a la documentación.
6. Cada unidad futura tiene criterios verificables, evidencias esperadas y condición de cierre.
7. La revisión final confirma que no se modificó funcionalidad ni se crearon artefactos fuera del alcance.
