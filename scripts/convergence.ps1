[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('LIGHT','STANDARD','FULL')][string]$Depth,[Parameter(Mandatory=$true)][int]$Iteration,[Parameter(Mandatory=$true)][ValidateSet('CHANGES_REQUIRED','APPROVED','BLOCKED')][string]$ReviewerVerdict,[string]$OutputPath='')
$budget=@{LIGHT=2;STANDARD=4;FULL=6}[$Depth]
$terminal=($ReviewerVerdict -eq 'APPROVED' -or $ReviewerVerdict -eq 'BLOCKED' -or $Iteration -ge $budget)
$state=if($ReviewerVerdict -eq 'APPROVED'){'APPROVED'}elseif($ReviewerVerdict -eq 'BLOCKED' -or $Iteration -ge $budget){'FAILED_SAFELY'}else{'CONTINUE'}
$out=[ordered]@{schemaVersion=1;convergence='CONVERGENCE';depth=$Depth;iteration=$Iteration;maxIterations=$budget;reviewerVerdict=$ReviewerVerdict;state=$state;terminal=$terminal}
if($OutputPath){$parent=Split-Path $OutputPath -Parent;if($parent -and !(Test-Path $parent)){New-Item -ItemType Directory -Path $parent|Out-Null};$out|ConvertTo-Json|Set-Content -LiteralPath $OutputPath -Encoding UTF8};$out|ConvertTo-Json
