[CmdletBinding()]
param([string]$RepositoryRoot=(git rev-parse --show-toplevel))
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'identity-contract.ps1')
$root=Get-IdentityRoot $RepositoryRoot
$runs=Join-Path $root 'runs'
if (!(Test-Path -LiteralPath $runs -PathType Container)) { 'No manifests to validate'; exit 0 }
$checked=0
Get-ChildItem -LiteralPath $runs -Filter work-unit.json -File -Recurse | ForEach-Object {
    $manifest=$_.FullName
    $lifecycle=Join-Path $_.Directory.FullName 'lifecycle.json'
    if (Test-Path -LiteralPath $lifecycle) {
        $record=Get-Content -LiteralPath $lifecycle -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$record.lifecycle -ceq 'CLOSED') {
            $u=Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($field in @('schemaVersion','lifecycle','unitId','branch','baseCommit')) {
                if ($null -eq $record.$field -or [string]::IsNullOrWhiteSpace([string]$record.$field)) { throw "lifecycle.json sin campo requerido '$field': $manifest" }
            }
            if ([string]$record.lifecycle -cne 'CLOSED') { throw "lifecycle.json no declara CLOSED: $manifest" }
            if ([string]::IsNullOrWhiteSpace([string]$record.unitId) -or [string]$record.unitId -cne [string]$u.unitId) { throw "lifecycle.json unitId ausente o contradictorio: $manifest" }
            if ([string]::IsNullOrWhiteSpace([string]$record.branch) -or [string]$record.branch -cne [string]$u.branch) { throw "lifecycle.json branch ausente o contradictorio: $manifest" }
            # Compatibilidad explícita: la adopción histórica conserva ACTIVE
            # en work-unit.json y CLOSED en lifecycle.json; no se reescribe.
            if (-not [string]::IsNullOrWhiteSpace([string]$u.lifecycle) -and [string]$u.lifecycle -cne 'CLOSED' -and [string]$u.lifecycle -cne 'ACTIVE') { throw "work-unit.json lifecycle invalido: $manifest" }
            Assert-WorkUnitIdentity -Slug ([string]$u.canonicalSlug) -Branch ([string]$u.branch) -RunPath ([string]$u.runPath) -SkipRoadmap -RepositoryRoot $root | Out-Null
            return
        }
    }
    $u=Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$u.branch) -or [string]::IsNullOrWhiteSpace([string]$u.canonicalSlug)) { throw "Manifiesto sin identidad: $manifest" }
    Assert-WorkUnitIdentity -Slug ([string]$u.canonicalSlug) -Branch ([string]$u.branch) -RunPath ([string]$u.runPath) -RepositoryRoot $root | Out-Null
    $checked++
}
"Unit identities OK: $checked manifest(s)"
