# Android Log Capture Script
# This script captures both Expo/Metro logs and Android logcat logs

Write-Host "Starting Android log capture..." -ForegroundColor Green
Write-Host ""

# Check if logcat is available (requires Android SDK)
$logcatAvailable = $false
try {
    $null = Get-Command adb -ErrorAction Stop
    $logcatAvailable = $true
    Write-Host "✓ ADB found - will capture logcat logs" -ForegroundColor Green
} catch {
    Write-Host "⚠ ADB not found - will only capture Expo/Metro logs" -ForegroundColor Yellow
    Write-Host "  Install Android SDK Platform Tools to capture native Android logs" -ForegroundColor Yellow
}

# Start logcat capture in background if available
if ($logcatAvailable) {
    Write-Host "Starting logcat capture..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "adb" -ArgumentList "logcat", "-c" -ErrorAction SilentlyContinue
    $logcatJob = Start-Job -ScriptBlock {
        adb logcat *:E ReactNativeJS:V ReactNative:V *:S 2>&1 | Out-File -FilePath "android-logcat.txt" -Encoding utf8
    }
    Write-Host "✓ Logcat capture started (saving to android-logcat.txt)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Expo with Android..." -ForegroundColor Cyan
Write-Host "Logs will be saved to android-logs.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop logging" -ForegroundColor Yellow
Write-Host ""

# Start Expo and capture output
try {
    npx expo start --android --clear 2>&1 | Tee-Object -FilePath "android-logs.txt"
} finally {
    # Clean up logcat job
    if ($logcatAvailable -and $logcatJob) {
        Write-Host ""
        Write-Host "Stopping logcat capture..." -ForegroundColor Cyan
        Stop-Job $logcatJob
        Remove-Job $logcatJob
        Write-Host "✓ Log capture complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Log files created:" -ForegroundColor Yellow
        Write-Host "  - android-logs.txt (Expo/Metro logs)" -ForegroundColor White
        if ($logcatAvailable) {
            Write-Host "  - android-logcat.txt (Android native logs)" -ForegroundColor White
        }
    }
}

