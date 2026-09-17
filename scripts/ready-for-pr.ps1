param(
    [Parameter(Mandatory = $true)]
    [string] $Slug,

    # Titulo de la Pull Request. NO es el titulo de la documentacion.
    [string] $Title = "",

    # Escape hatch para el titulo canonico de la documentacion cuando la
    # etapa no tiene entrada en scripts/feature-titles.json.
    [string] $DocTitle = "",

    [string] $Version = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "feature-contract.ps1")

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string] $FilePath,

        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function Get-CheckedOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string] $FilePath,

        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    $output = & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
    return ($output -join "`n").Trim()
}

function Get-GitHubCliPath {
    $command = Get-Command gh -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $defaultPath = Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"
    if (Test-Path -LiteralPath $defaultPath) {
        return $defaultPath
    }

    throw "GitHub CLI (gh) no esta disponible. Instalalo y autenticalo para crear/verificar PRs automaticamente."
}

function Get-PowerShellPath {
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwsh) {
        return $pwsh.Source
    }

    $windowsPowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if ($windowsPowerShell) {
        return $windowsPowerShell.Source
    }

    throw "PowerShell no esta disponible para iniciar el reconciliador local."
}

function Invoke-GhJson {
    param(
        [Parameter(Mandatory = $true)]
        [string] $GitHubCliPath,

        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,

        [int[]] $AllowedExitCodes = @(0)
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $GitHubCliPath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $text = ($output | ForEach-Object { $_.ToString() }) -join "`n"

    if ($AllowedExitCodes -notcontains $exitCode) {
        throw "Command failed: gh $($Arguments -join ' ')`n$text"
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        StdOut = if ($exitCode -eq 0) { $text.Trim() } else { "" }
        StdErr = if ($exitCode -eq 0) { "" } else { $text.Trim() }
    }
}

function Get-ExistingPr {
    param(
        [Parameter(Mandatory = $true)]
        [string] $GitHubCliPath,

        [Parameter(Mandatory = $true)]
        [string] $Branch
    )

    $result = Invoke-GhJson -GitHubCliPath $GitHubCliPath -Arguments @(
        "pr", "view", $Branch,
        "--json", "number,url,baseRefName,state",
        "--jq", "."
    ) -AllowedExitCodes @(0, 1)

    if ($result.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($result.StdOut)) {
        return ($result.StdOut | ConvertFrom-Json)
    }

    $notFound = $result.StdErr -match "no pull requests found|not found|Could not resolve to a PullRequest"
    if ($notFound -or [string]::IsNullOrWhiteSpace($result.StdErr)) {
        return $null
    }

    throw "Error real consultando PR existente con gh: $($result.StdErr)"
}

# Titulo de la documentacion. Orden, de mas explicito a menos:
#
#   1. -DocTitle
#   2. el titulo canonico de scripts/feature-titles.json
#   3. -Title, como ultimo recurso y por compatibilidad: si alguien paso
#      un titulo y la etapa no declaro el suyo, es mejor que derivarlo
#   4. el derivado del slug, que resuelve Get-FeatureInfo
#
# El default "Feature <slug>" se calcula DESPUES, en $prTitle, para que no
# se cuele como titulo de documentacion cuando no se paso ninguno.
$docTitle = $DocTitle
if ([string]::IsNullOrWhiteSpace($docTitle)) {
    $docTitle = Get-CanonicalTitle -Slug $Slug
}
if ([string]::IsNullOrWhiteSpace($docTitle)) {
    $docTitle = $Title
}

$prTitle = if ([string]::IsNullOrWhiteSpace($Title)) { "Feature $Slug" } else { $Title }

$baseBranch = if ([string]::IsNullOrWhiteSpace($env:BASE_BRANCH)) { "develop" } else { $env:BASE_BRANCH }
$currentBranch = Get-CheckedOutput "git" @("branch", "--show-current")
# El titulo de la documentacion no se deriva del titulo de la PR. Antes si:
# se le quitaba el prefijo con `-replace "^Feature [0-9]{2}-"`, un patron
# que solo contemplaba hitos NN- y que dejaba 'Feature v1.0.1-identidad-...'
# entero cuando el slug era una release de mantenimiento. El titulo
# resultante no coincidia con ningun indice y el contrato fallaba.
# Ahora son dos cosas distintas: $prTitle es de la PR, y el de la
# documentacion sale del registro canonico (o de -DocTitle).
$info = Get-FeatureInfo -Slug $Slug -Title $docTitle -Version $Version

if ($currentBranch -eq $baseBranch -or $currentBranch -eq "main") {
    throw "Este script debe correr en una rama de feature, no en $currentBranch."
}

if (-not $currentBranch.StartsWith("feature/")) {
    throw "La rama actual debe empezar con 'feature/'. Rama actual: $currentBranch"
}

# La identidad debe validarse antes de cualquier cambio en ROADMAP.
Assert-WorkUnitIdentity -Slug $Slug -Branch $currentBranch -RunPath (Get-FeatureInfo -Slug $Slug -Version $Version).RunDir

& git diff --quiet
$unstagedStatus = $LASTEXITCODE
& git diff --cached --quiet
$stagedStatus = $LASTEXITCODE
if ($unstagedStatus -ne 0 -or $stagedStatus -ne 0) {
    throw "Hay cambios sin commitear antes de marcar READY_FOR_PR. Commit de implementacion, tests y docs requerido."
}

$roadmapPath = "ROADMAP.md"
$roadmap = Get-Content -LiteralPath $roadmapPath -Raw -Encoding UTF8
$escapedSlug = [regex]::Escape($Slug)

if ($roadmap -match "(?m)^- \[x\] $escapedSlug\b") {
    throw "$Slug ya figura como [x]. No se puede marcar READY_FOR_PR despues del cierre."
}

if ($roadmap -match "(?m)^- \[-\] $escapedSlug\b") {
    Write-Host "==> $Slug ya esta en READY_FOR_PR."
}
else {
    $pendingPattern = "(?m)^- \[[ ~]\] ($escapedSlug.*)$"
    if ($roadmap -notmatch $pendingPattern) {
        throw "No encontre '$Slug' pendiente en ROADMAP.md."
    }

    Write-Host "==> Marcando '$Slug' como READY_FOR_PR en ROADMAP.md..."
    $pendingRegex = [regex]::new($pendingPattern)
    $updatedRoadmap = $pendingRegex.Replace($roadmap, '- [-] $1', 1)
    Set-Content -LiteralPath $roadmapPath -Value $updatedRoadmap -Encoding UTF8
    Invoke-Checked "git" @("add", $roadmapPath)
    Invoke-Checked "git" @("commit", "-m", "docs: marcar $Slug como ready for PR")
}

Assert-FeatureContract -Slug $Slug -Title $info.Title -Version $Version -RequireReadyRoadmap

Write-Host "==> Pusheando $currentBranch..."
Invoke-Checked "git" @("push", "-u", "origin", $currentBranch)

$ghPath = Get-GitHubCliPath
$powerShellPath = Get-PowerShellPath
$existingPr = Get-ExistingPr -GitHubCliPath $ghPath -Branch $currentBranch
if ($null -ne $existingPr -and $existingPr.state -ne "OPEN") {
    # 'gh pr view <rama>' tambien devuelve PRs ya MERGED o CLOSED de esa
    # misma rama. Reutilizarlas dejaria los commits nuevos sin PR abierta
    # (caso real: 14-pipeline-despliegue-vercel, mergeada como #18 antes de
    # que se commitearan docs, decision y ROADMAP). Solo una PR OPEN cuenta
    # como existente; con cualquier otro estado se crea una PR nueva.
    Write-Host "==> PR #$($existingPr.number) esta en estado '$($existingPr.state)'. Se creara una PR nueva."
    $existingPr = $null
}

if ($null -ne $existingPr) {
    if ($existingPr.baseRefName -ne $baseBranch) {
        throw "La PR existente #$($existingPr.number) apunta a '$($existingPr.baseRefName)', no a '$baseBranch'."
    }
    Write-Host "==> PR existente: #$($existingPr.number) $($existingPr.url)"
    & $powerShellPath -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-local-reconciler.ps1") -Slug $Slug -Branch $currentBranch -WorktreeDir (Get-Location).Path
    exit 0
}

$bodyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("pr-body-{0}.md" -f ([guid]::NewGuid()))
$body = @"
## Resumen

- Feature: $Slug
- Rama: $currentBranch
- Estado de roadmap: READY_FOR_PR, sin marcar [x]

## Evidencias

- Spec: $($info.RunDir)/spec.md
- Decision: $($info.Decision)
- Auditoria: $($info.RunDir)/audit-N.md
- QA: $($info.RunDir)/test-report-N.md
- Documentacion tecnica: $($info.TechnicalDoc)
- Documentacion de usuario: $($info.UserDoc)
- Indices: $($info.TechnicalIndex), $($info.UserIndex)

## Checklist

- [ ] CI verde en GitHub Actions
- [ ] Tests reportados en $($info.RunDir)/test-report-N.md
- [ ] Criterios de aceptacion cubiertos
- [ ] Decisiones documentadas en $($info.Decision)
- [ ] Indices de documentacion enlazan el servicio una sola vez
- [ ] Roadmap en READY_FOR_PR, no [x]

## Post-merge

El cierre remoto de ROADMAP.md lo ejecuta GitHub Actions con `scripts/close-feature.ps1`.
El reconciliador local iniciado por `ready-for-pr.ps1` solo limpia worktree/rama cuando
`origin/develop` ya contiene `[x] $Slug`.
"@

try {
    Set-Content -LiteralPath $bodyPath -Value $body -Encoding UTF8
    Write-Host "==> Creando PR hacia $baseBranch..."
    # 'gh pr create' no soporta --json/--jq en todas las versiones de gh
    # (a diferencia de 'gh pr view'/'gh pr list'). En su forma normal
    # (sin --json), 'gh pr create' imprime unicamente la URL de la PR
    # creada en stdout; se parsea el numero desde ahi. No hace falta una
    # consulta aparte: si 'gh pr create' no lanzo error, el --base que le
    # pasamos ya fue aceptado por GitHub.
    $createResult = Invoke-GhJson -GitHubCliPath $ghPath -Arguments @(
        "pr", "create",
        "--base", $baseBranch,
        "--head", $currentBranch,
        "--title", $prTitle,
        "--body-file", $bodyPath
    )
    $prUrl = $createResult.StdOut.Trim()
    if ($prUrl -notmatch "/pull/(\d+)\s*$") {
        throw "No se pudo interpretar la URL de la PR creada por 'gh pr create': '$prUrl'"
    }
    Write-Host "==> PR creada: #$($Matches[1]) $prUrl"
}
finally {
    if (Test-Path -LiteralPath $bodyPath) {
        Remove-Item -LiteralPath $bodyPath -Force
    }
}

& $powerShellPath -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-local-reconciler.ps1") -Slug $Slug -Branch $currentBranch -WorktreeDir (Get-Location).Path
