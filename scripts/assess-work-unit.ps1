[CmdletBinding()]
param([Parameter(Mandatory=$true)][string[]]$ChangedPath,[switch]$NoEvidence,[string]$EvidencePath='')
$ErrorActionPreference='Stop'
$paths=@($ChangedPath | ForEach-Object {$_ -split ','} | ForEach-Object {$_.Trim()} | Where-Object {$_} | Sort-Object -Unique)
if(!$paths){throw 'ChangedPath no puede estar vacio.'}
$high=$false;$score=0;$signals=@()
foreach($p in $paths){$n=$p.Replace('\','/').ToLowerInvariant();if($n -match '(^|/)(scripts|\.github/workflows)(/|\.)'){ $high=$true;$score+=4;$level='high';$reason='automatizacion o gobernanza'}elseif($n -match '(^|/)(\.agentic|\.codex|\.claude|\.opencode)(/|\.)'){ $score+=2;$level='medium';$reason='configuracion agentic'}else{$level='low';$reason='documentacion o test'};$signals+= [ordered]@{path=$p;level=$level;reason=$reason}}
if($paths.Count -ge 10){$high=$true;$score+=3}
$risk=if($high -or $score -ge 5){'HIGH'}elseif($score -ge 2){'MEDIUM'}else{'LOW'}
$depth=if($risk -eq 'HIGH'){'FULL'}elseif($risk -eq 'MEDIUM'){'STANDARD'}else{'LIGHT'}
$out=[ordered]@{schemaVersion=1;assessment='ASSESS';deterministic=$true;changedFiles=$paths;fileCount=$paths.Count;score=$score;risk=$risk;depth=$depth;signals=$signals;rationale='Clasificacion por rutas y amplitud; no ejecuta roles ni modifica producto.'}
$json=$out|ConvertTo-Json -Depth 8
if(!$NoEvidence){if(!$EvidencePath){$EvidencePath='runs/assess.jsonl'};$parent=Split-Path $EvidencePath -Parent;if($parent -and !(Test-Path $parent)){New-Item -ItemType Directory -Path $parent|Out-Null};Add-Content -LiteralPath $EvidencePath -Value ($json -replace "`r?`n",'') -Encoding UTF8}
$json
