[CmdletBinding()]
param([string]$RepositoryRoot=(git rev-parse --show-toplevel))
$ErrorActionPreference='Stop';Push-Location $RepositoryRoot;try{$errors=@();if(!(Test-Path CONSTITUTION.md)){ $errors+='CONSTITUTION.md ausente' };if(!(Test-Path STATUS.md)){$errors+='STATUS.md ausente'};if(!(Test-Path .agentic/agents.json)){$errors+='fuente .agentic ausente'};if(!(Test-Path .agentic/mcp.json)){ $errors+='mcp.json ausente' };if($errors){$errors|ForEach-Object{Write-Error $_};exit 1};'Integrity OK'}finally{Pop-Location}
