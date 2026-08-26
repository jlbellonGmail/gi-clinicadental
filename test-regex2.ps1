$content = Get-Content "D:\proyectos\gi-clinicadental\ROADMAP.md" -Encoding UTF8
# Find lines with 09-redisenio
$lines = $content | Where-Object { $_ -match '09-redisenio' }
Write-Host "Lines containing 09-redisenio: $($lines.Count)"
$i = 0
foreach ($line in $lines) {
    $i++
    Write-Host "Line $i: [$($line.Substring(0, [math]::Min(100, $line.Length)))]"
    # Show hex of first 100 chars
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($line.Substring(0, [math]::Min(100, $line.Length)))
    Write-Host "Hex: " ($bytes -join ' ')
}