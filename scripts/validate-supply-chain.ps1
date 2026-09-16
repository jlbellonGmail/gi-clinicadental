[CmdletBinding()]
param([string]$Root=(Get-Location).Path)
$fail=@();foreach($f in Get-ChildItem (Join-Path $Root '.github/workflows') -File -ErrorAction SilentlyContinue){$c=Get-Content $f.FullName -Raw;if($c -notmatch '(?m)^permissions:'){$fail+="$($f.Name): permissions ausente"};foreach($m in [regex]::Matches($c,'(?m)^\s*-?\s*uses:\s*([^\s#]+)')){if($m.Groups[1].Value -notmatch '@[0-9a-fA-F]{40}$'){$fail+="$($f.Name): accion no fijada por SHA: $($m.Groups[1].Value)"}}};if($fail){$fail|ForEach-Object{Write-Error $_};exit 1};'Supply chain OK'
