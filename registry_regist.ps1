# 1. 기존 제거
powershell -ExecutionPolicy Bypass -File scripts/windows/unregister.ps1

# 2. 새로 등록
powershell -ExecutionPolicy Bypass -File scripts/windows/register-dev.ps1

# 3. 탐색기 재시작
taskkill /f /im explorer.exe ; Start-Sleep 1 ; explorer.exe

