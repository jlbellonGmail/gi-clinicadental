[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('LIGHT','STANDARD','FULL')][string]$Depth,[Parameter(Mandatory=$true)][string]$OutputPath)
$steps=@{LIGHT=@('objective','mini-spec','build','tests','review');STANDARD=@('objective','light-plan','spec','plan/tasks','build','tests','review');FULL=@('objective','planning','spec','plan','tasks','validations','build','tests','review','gates')}[$Depth]
$out=[ordered]@{schemaVersion=1;sdd='adaptive';depth=$Depth;steps=$steps;requiredEvidence=if($Depth -eq 'LIGHT'){@('SUMMARY.md','review') }elseif($Depth -eq 'STANDARD'){@('SUMMARY.md','spec','plan','test-evidence','review')}else{@('SUMMARY.md','spec','plan','tasks','decision','audit','test-evidence','review','gates')}}
$parent=Split-Path $OutputPath -Parent;if($parent -and !(Test-Path $parent)){New-Item -ItemType Directory -Path $parent|Out-Null};$out|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $OutputPath -Encoding UTF8
