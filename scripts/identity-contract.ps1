function Get-IdentityRoot {
    param([string] $RepositoryRoot = "")
    if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) { $RepositoryRoot = (& git rev-parse --show-toplevel) -join "`n" }
    if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) { throw "No pude detectar la raiz del repositorio." }
    return [System.IO.Path]::GetFullPath($RepositoryRoot.Trim())
}

function Get-NormalizedRunPath {
    param([Parameter(Mandatory=$true)][string]$RepositoryRoot,[Parameter(Mandatory=$true)][string]$RunPath)
    if ([System.IO.Path]::IsPathRooted($RunPath)) { throw "runPath debe ser relativo al repositorio: $RunPath" }
    $runsRoot = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot "runs"))
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot $RunPath))
    $prefix = $runsRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "runPath fuera del directorio permitido runs/: $RunPath"
    }
    return $candidate
}

function Get-BranchIdentity {
    param([Parameter(Mandatory=$true)][string]$Branch)
    if ($Branch -notmatch '^feature/(?<id>([0-9]{2}|v[0-9]+\.[0-9]+\.[0-9]+)-[a-z0-9]+(?:-[a-z0-9]+)*)$') {
        throw "La rama no tiene un identificador de etapa soportado: $Branch"
    }
    return $Matches.id
}

function Get-ExactRoadmapEntry {
    param([Parameter(Mandatory=$true)][string]$RepositoryRoot,[Parameter(Mandatory=$true)][string]$Identity)
    $roadmap = Join-Path $RepositoryRoot "ROADMAP.md"
    if (-not (Test-Path -LiteralPath $roadmap -PathType Leaf)) { throw "ROADMAP.md ausente." }
    $escaped = [regex]::Escape($Identity)
    $matches = [regex]::Matches((Get-Content -LiteralPath $roadmap -Raw -Encoding UTF8), "(?m)^- \[(?<state>[ x-])\] $escaped(?=\s|$).*" )
    if ($matches.Count -eq 0) { throw "No existe una entrada exacta para '$Identity'." }
    if ($matches.Count -gt 1) { throw "ROADMAP.md contiene mas de una coincidencia exacta para '$Identity'." }
    return $matches[0]
}

function Get-ManifestForIdentity {
    param([Parameter(Mandatory=$true)][string]$RepositoryRoot,[Parameter(Mandatory=$true)][string]$Identity,[string]$RunPath="")
    $runsRoot = Join-Path $RepositoryRoot "runs"
    $files = @()
    $all = @()
    if (Test-Path -LiteralPath $runsRoot -PathType Container) {
        $all = @(Get-ChildItem -LiteralPath $runsRoot -Filter work-unit.json -File -Recurse | Where-Object {
            $closed = Join-Path $_.Directory.FullName 'lifecycle.json'
            if (Test-Path -LiteralPath $closed) {
                $record = Get-Content -LiteralPath $closed -Raw -Encoding UTF8 | ConvertFrom-Json
                if ([string]$record.lifecycle -ceq 'CLOSED') { return $false }
            }
            return $true
        } | ForEach-Object { $_.FullName })
    }
    if (-not [string]::IsNullOrWhiteSpace($RunPath)) {
        $dir = Get-NormalizedRunPath $RepositoryRoot $RunPath
        $requested = [System.IO.Path]::GetFullPath((Join-Path $dir "work-unit.json"))
        $related = @($all | Where-Object {
            $candidate = Get-Content -LiteralPath $_ -Raw -Encoding UTF8 | ConvertFrom-Json
            ([string]$candidate.unitId -ceq $Identity) -or
            ([string]$candidate.canonicalSlug -ceq $Identity) -or
            ([string]$candidate.branch -ceq "feature/$Identity")
        })
        if ($related.Count -gt 1) { throw "Identidad ambigua: hay manifiestos contractualmente relacionados para '$Identity'." }
        if (-not (Test-Path -LiteralPath $requested -PathType Leaf) -and $all.Count -gt 0) { throw "Identidad ambigua: existe un manifiesto activo alternativo y falta el declarado para '$Identity'." }
        if ($related.Count -eq 1 -and $related[0] -cne $requested) { throw "Manifiesto ubicado fuera del runPath declarado para '$Identity'." }
        $files = @($requested)
    } else {
        $files = @($all | Where-Object {
            $candidate = Get-Content -LiteralPath $_ -Raw -Encoding UTF8 | ConvertFrom-Json
            ([string]$candidate.unitId -ceq $Identity) -or
            ([string]$candidate.canonicalSlug -ceq $Identity) -or
            ([string]$candidate.branch -ceq "feature/$Identity")
        })
    }
    if ($files.Count -gt 1) { throw "Identidad ambigua: hay varios work-unit.json para '$Identity'." }
    if ($files.Count -eq 0 -or -not (Test-Path -LiteralPath $files[0] -PathType Leaf)) { return $null }
    return Get-Item -LiteralPath $files[0]
}

function Assert-WorkUnitIdentity {
    param(
        [Parameter(Mandatory=$true)][string]$Slug,
        [Parameter(Mandatory=$true)][string]$Branch,
        [string]$RunPath="",
        [ValidateSet('any','pending','ready','done')][string]$RoadmapState='any',
        [switch]$SkipRoadmap,
        [string]$RepositoryRoot=""
    )
    $root = Get-IdentityRoot $RepositoryRoot
    $branchIdentity = Get-BranchIdentity $Branch
    if ($branchIdentity -cne $Slug) { throw "Identidad contradictoria: rama '$Branch' deriva '$branchIdentity', pero se recibió '$Slug'." }
    $state = 'historical-closed'
    if (-not $SkipRoadmap) {
        $entry = Get-ExactRoadmapEntry $root $Slug
        $state = $entry.Groups['state'].Value
        $expected = @{ pending=' '; ready='-'; done='x' }[$RoadmapState]
        if ($RoadmapState -ne 'any' -and $state -cne $expected) { throw "ROADMAP.md tiene estado '$state' para '$Slug'; se esperaba '$RoadmapState'." }
    }
    if (-not [string]::IsNullOrWhiteSpace($RunPath)) {
        $requestedRun = Get-NormalizedRunPath $root $RunPath
        if ((Split-Path -Leaf $requestedRun) -cne $Slug) { throw "runPath no termina exactamente en '$Slug'." }
    }
    $manifest = Get-ManifestForIdentity $root $Slug $RunPath
    if ($null -eq $manifest) {
        $otherManifest = Get-ManifestForIdentity $root $Slug
        if ($null -ne $otherManifest) { throw "Manifiesto ausente en el runPath declarado para '$Slug'; existe otra ubicación de manifiesto." }
        return [pscustomobject]@{ identity=$Slug; legacy=$true; roadmapState=$state }
    }
    $unit = Get-Content -LiteralPath $manifest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($field in @('unitId','canonicalSlug','branch','runPath')) {
        if ([string]::IsNullOrWhiteSpace([string]$unit.$field)) { throw "Manifiesto sin identidad: campo '$field'." }
    }
    if ($unit.unitId -cne $Slug -or $unit.canonicalSlug -cne $Slug -or $unit.branch -cne $Branch) { throw "Manifiesto contradictorio para '$Slug'." }
    $actualRun = [System.IO.Path]::GetFullPath($manifest.Directory.FullName)
    $declaredRun = Get-NormalizedRunPath $root ([string]$unit.runPath)
    if ((Split-Path -Leaf $declaredRun) -cne $Slug) { throw "runPath no termina exactamente en '$Slug'." }
    if ($actualRun.TrimEnd('\','/') -cne $declaredRun.TrimEnd('\','/')) { throw "runPath no corresponde al directorio del manifiesto para '$Slug'." }
    if (-not [string]::IsNullOrWhiteSpace($RunPath)) {
        $expectedRun = Get-NormalizedRunPath $root $RunPath
        if ($declaredRun.TrimEnd('\','/') -cne $expectedRun.TrimEnd('\','/')) { throw "runPath recibido no corresponde al manifiesto para '$Slug'." }
    }
    return [pscustomobject]@{ identity=$Slug; legacy=$false; roadmapState=$state; manifest=$manifest.FullName; runPath=$declaredRun }
}
