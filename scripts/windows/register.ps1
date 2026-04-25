# 간편변환기 - Windows 우클릭 컨텍스트 메뉴 등록 (배포 빌드용)
# 실행: powershell -ExecutionPolicy Bypass -File register.ps1
# 앱 빌드 후 생성된 .exe 경로를 -AppPath 로 지정하세요.

param(
    [string]$AppPath = "$PSScriptRoot\..\..\app\release\win-unpacked\간편변환기.exe",
    [string]$MenuName = "간편변환기"
)

if (-not (Test-Path $AppPath)) {
    Write-Error "앱 실행파일을 찾을 수 없습니다: $AppPath`n먼저 'npm run build' 로 빌드하거나 -AppPath 로 경로를 직접 지정하세요."
    exit 1
}

$AppPath = (Resolve-Path $AppPath).Path

$formatMap = @{
    image    = @{ exts = @('.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif'); targets = @('jpg','png','gif','webp','pdf') }
    document = @{ exts = @('.pdf','.docx','.pptx','.xlsx'); targets = @('pdf') }
    data     = @{ exts = @('.csv','.json','.xml','.xlsx'); targets = @('csv','json','xml','xlsx') }
}

$formatLabel = @{ jpg='JPG'; png='PNG'; gif='GIF'; webp='WEBP'; pdf='PDF'; csv='CSV'; json='JSON'; xml='XML'; xlsx='Excel' }

function Register-ContextMenu {
    param([string]$Extension, [string[]]$Targets)

    $srcExt = $Extension.TrimStart('.')
    $filtered = $Targets | Where-Object { $_ -ne $srcExt }
    if ($filtered.Count -eq 0) { return }

    $baseKey = "HKCU:\Software\Classes\SystemFileAssociations\$Extension\shell\$MenuName"
    New-Item -Path $baseKey -Force | Out-Null
    Set-ItemProperty -Path $baseKey -Name "MUIVerb"     -Value $MenuName
    Set-ItemProperty -Path $baseKey -Name "SubCommands" -Value ""
    New-Item -Path "$baseKey\shell" -Force | Out-Null

    foreach ($target in $filtered) {
        $label  = $formatLabel[$target]
        $subKey = "$baseKey\shell\to_$target"
        New-Item -Path $subKey -Force | Out-Null
        Set-ItemProperty -Path $subKey -Name "(Default)" -Value "${label}로 변환"

        New-Item -Path "$subKey\command" -Force | Out-Null
        Set-ItemProperty -Path "$subKey\command" -Name "(Default)" `
            -Value "`"$AppPath`" --convert `"%1`" --to $target"
    }
    Write-Host "  등록됨: $Extension"
}

Write-Host "컨텍스트 메뉴를 등록합니다..."
foreach ($cat in $formatMap.Keys) {
    foreach ($ext in $formatMap[$cat].exts) {
        Register-ContextMenu -Extension $ext -Targets $formatMap[$cat].targets
    }
}
Write-Host "`n완료. 탐색기를 재시작하면 적용됩니다."
