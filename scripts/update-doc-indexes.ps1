param(
    [Parameter(Mandatory = $true)]
    [string] $Slug,

    # Opcional: si no se pasa, sale del titulo canonico declarado en
    # scripts/feature-titles.json, y si tampoco esta ahi, del slug.
    [string] $Title = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "feature-contract.ps1")

$info = Get-FeatureInfo -Slug $Slug -Title $Title
$changed = $false

# Preflight de ambos indices antes de escribir. Evita que un indice quede
# modificado si el otro tiene marcadores, enlaces o destinos invalidos.
[void] (Update-DocsIndex -IndexPath $info.TechnicalIndex -TargetPath $info.TechnicalDoc -Title $info.Title -ValidateOnly)
[void] (Update-DocsIndex -IndexPath $info.UserIndex -TargetPath $info.UserDoc -Title $info.Title -ValidateOnly)

if (Update-DocsIndex -IndexPath $info.TechnicalIndex -TargetPath $info.TechnicalDoc -Title $info.Title) {
    Write-Host "==> Agregado enlace tecnico: $($info.TechnicalIndex) -> $($info.DocSlug).md"
    $changed = $true
}

if (Update-DocsIndex -IndexPath $info.UserIndex -TargetPath $info.UserDoc -Title $info.Title) {
    Write-Host "==> Agregado enlace de usuario: $($info.UserIndex) -> $($info.DocSlug).md"
    $changed = $true
}

Assert-IndexLink -IndexPath $info.TechnicalIndex -TargetPath $info.TechnicalDoc -Title $info.Title
Assert-IndexLink -IndexPath $info.UserIndex -TargetPath $info.UserDoc -Title $info.Title

if (-not $changed) {
    Write-Host "==> Indices ya estaban completos para $Slug."
}
