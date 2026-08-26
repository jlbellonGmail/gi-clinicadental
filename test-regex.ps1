$content = Get-Content "D:\proyectos\gi-clinicadental\ROADMAP.md" -Encoding UTF8
$regex = [regex]::Matches($content, '(?m)^- \[-\] 09-redisenio-estetico-y-assets(?=\s|$).*')
Write-Host "Matches found: $($regex.Count)"
if ($regex.Count -gt 0) {
    $regex | % { Write-Host "Match: " $_.Value }
}