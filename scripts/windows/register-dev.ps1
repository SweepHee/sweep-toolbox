# converter - dev context menu registration (no build required)
# Run: powershell -ExecutionPolicy Bypass -File register-dev.ps1

$AppDir   = (Resolve-Path "$PSScriptRoot\..\..\app").Path
$Electron = "$AppDir\node_modules\electron\dist\electron.exe"
$MenuKey  = "manneung_converter"

# Unicode [char] 방식으로 한글 정의 (CP949 인코딩 문제 우회)
# 만=47564 능=45733 변=48320 환=54872 기=44592 로=47196
$MenuLabel = "$([char]47564)$([char]45733)$([char]48320)$([char]54872)$([char]44592)"
$suffix    = "$([char]47196) $([char]48320)$([char]54872)"

if (-not (Test-Path $Electron)) {
    Write-Error "electron not found. Run 'cd app && npm install' first."
    exit 1
}

$CmdTemplate = "`"$Electron`" `"$AppDir`" --convert `"%1`" --to {0}"

$labels = @{
    jpg  = "JPG$suffix"
    png  = "PNG$suffix"
    gif  = "GIF$suffix"
    webp = "WEBP$suffix"
    bmp  = "BMP$suffix"
    tiff = "TIFF$suffix"
    pdf  = "PDF$suffix"
    mp4  = "MP4$suffix"
    avi  = "AVI$suffix"
    mkv  = "MKV$suffix"
    mov  = "MOV$suffix"
    wmv  = "WMV$suffix"
    webm = "WEBM$suffix"
    mp3  = "MP3$suffix"
    wav  = "WAV$suffix"
    aac  = "AAC$suffix"
    flac = "FLAC$suffix"
    m4a  = "M4A$suffix"
    ogg  = "OGG$suffix"
    opus = "OPUS$suffix"
    xlsx = "XLSX$suffix"
    ods  = "ODS$suffix"
    csv  = "CSV$suffix"
    tsv  = "TSV$suffix"
    json = "JSON$suffix"
    xml  = "XML$suffix"
}

# 배열을 해시테이블 밖에서 미리 정의 (PS5.1 해시테이블 내 파이프 버그 우회)
$vAll  = @('mp4','avi','mkv','mov','wmv','webm','mp3','wav','aac','flac','m4a','ogg','opus')
$aAll  = @('mp3','wav','aac','flac','m4a','ogg','opus','mp4')
$eAll  = @('xlsx','ods','csv','tsv','json','xml')

$v_mp4  = @($vAll | Where-Object { $_ -ne 'mp4'  })
$v_avi  = @($vAll | Where-Object { $_ -ne 'avi'  })
$v_mkv  = @($vAll | Where-Object { $_ -ne 'mkv'  })
$v_mov  = @($vAll | Where-Object { $_ -ne 'mov'  })
$v_wmv  = @($vAll | Where-Object { $_ -ne 'wmv'  })
$v_webm = @($vAll | Where-Object { $_ -ne 'webm' })
$a_mp3  = @($aAll | Where-Object { $_ -ne 'mp3'  })
$a_wav  = @($aAll | Where-Object { $_ -ne 'wav'  })
$a_aac  = @($aAll | Where-Object { $_ -ne 'aac'  })
$a_flac = @($aAll | Where-Object { $_ -ne 'flac' })
$a_m4a  = @($aAll | Where-Object { $_ -ne 'm4a'  })
$a_ogg  = @($aAll | Where-Object { $_ -ne 'ogg'  })
$a_opus = @($aAll | Where-Object { $_ -ne 'opus' })
$e_xlsx = @($eAll | Where-Object { $_ -ne 'xlsx' })
$e_ods  = @($eAll | Where-Object { $_ -ne 'ods'  })
$e_tsv  = @($eAll | Where-Object { $_ -ne 'tsv'  })

$extTargets = @{
    '.jpg'  = @('png','gif','webp','bmp','tiff','pdf')
    '.jpeg' = @('jpg','png','gif','webp','bmp','tiff','pdf')
    '.png'  = @('jpg','gif','webp','bmp','tiff','pdf')
    '.gif'  = @('jpg','png','webp','bmp','tiff','pdf')
    '.webp' = @('jpg','png','gif','bmp','tiff','pdf')
    '.bmp'  = @('jpg','png','gif','webp','tiff','pdf')
    '.tiff' = @('jpg','png','gif','webp','bmp','pdf')
    '.tif'  = @('jpg','png','gif','webp','bmp','pdf')
    '.pdf'  = @('jpg','png','gif','webp','bmp','tiff')
    '.mp4'  = $v_mp4
    '.avi'  = $v_avi
    '.mkv'  = $v_mkv
    '.mov'  = $v_mov
    '.wmv'  = $v_wmv
    '.webm' = $v_webm
    '.flv'  = $vAll
    '.mpeg' = $vAll
    '.mpg'  = $vAll
    '.m4v'  = $vAll
    '.mp3'  = $a_mp3
    '.wav'  = $a_wav
    '.aac'  = $a_aac
    '.flac' = $a_flac
    '.m4a'  = $a_m4a
    '.ogg'  = $a_ogg
    '.wma'  = $aAll
    '.opus' = $a_opus
    '.aiff' = $aAll
    '.xlsx' = $e_xlsx
    '.xls'  = $eAll
    '.xlsm' = $e_xlsx
    '.ods'  = $e_ods
    '.tsv'  = $e_tsv
    '.csv'  = @('xlsx','json','xml')
}

function Register-Ext {
    param([string]$Extension, [string[]]$Targets)

    $baseKey = "HKCU:\Software\Classes\SystemFileAssociations\$Extension\shell\$MenuKey"

    New-Item -Path $baseKey -Force | Out-Null
    Set-ItemProperty -Path $baseKey -Name "MUIVerb"     -Value $MenuLabel
    Set-ItemProperty -Path $baseKey -Name "SubCommands" -Value ""
    Set-ItemProperty -Path $baseKey -Name "Icon"        -Value "shell32.dll,71"

    New-Item -Path "$baseKey\shell" -Force | Out-Null
    foreach ($target in $Targets) {
        $subKey = "$baseKey\shell\to_$target"
        New-Item -Path $subKey -Force | Out-Null
        Set-ItemProperty -Path $subKey -Name "(Default)" -Value $labels[$target]

        New-Item -Path "$subKey\command" -Force | Out-Null
        Set-ItemProperty -Path "$subKey\command" -Name "(Default)" `
            -Value ($CmdTemplate -f $target)
    }
    Write-Host "  registered: $Extension"
}

Write-Host "Registering context menu..."
foreach ($ext in $extTargets.Keys) {
    Register-Ext -Extension $ext -Targets $extTargets[$ext]
}

Write-Host ""
Write-Host "Done. Restart Explorer:"
Write-Host "  taskkill /f /im explorer.exe ; Start-Sleep 1 ; explorer.exe"
