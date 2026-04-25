# converter - remove context menu (both dev and release)
# Run: powershell -ExecutionPolicy Bypass -File unregister.ps1

$allExts = @('.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif','.pdf','.docx','.pptx','.xlsx','.csv','.json','.xml')
$pattern = "^(manneung_converter|converter_dev|converter)"

foreach ($ext in $allExts) {
    $shellKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell"
    if (-not (Test-Path $shellKey)) { continue }
    Get-ChildItem $shellKey | Where-Object { $_.PSChildName -match $pattern } | ForEach-Object {
        Remove-Item -Path $_.PSPath -Recurse -Force
        Write-Host "  removed: $ext [$($_.PSChildName)]"
    }
}

Write-Host ""
Write-Host "Done. Context menu removed."
