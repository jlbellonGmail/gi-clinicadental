# Rollback

## Antes de integrar

Conservar la rama, worktree y evidencias; revertir sólo los cambios de esta
unidad mediante un nuevo commit autorizado o retirar la unidad sin tocar
`develop`, `main`, tags, releases o infraestructura. No limpiar recursos que
contengan trabajo pendiente.

## Después de integrar

Crear un nuevo commit autorizado en la rama correspondiente que revierta la
adopción. No usar `reset --hard`, force-push ni reescritura de historia.
