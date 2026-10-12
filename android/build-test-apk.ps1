$ErrorActionPreference = "Stop"

$androidStudioJava = "C:\Program Files\Android\Android Studio\jbr"
if (-not $env:JAVA_HOME -and (Test-Path $androidStudioJava)) {
    $env:JAVA_HOME = $androidStudioJava
}

if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

if (-not $env:JAVA_HOME) {
    throw "JAVA_HOME is not configured and Android Studio Java was not found."
}
if (-not (Test-Path $env:ANDROID_HOME)) {
    throw "Android SDK was not found at $env:ANDROID_HOME."
}

& "$PSScriptRoot\gradlew.bat" --project-dir $PSScriptRoot clean assembleDebug lintDebug
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$source = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\app-debug.apk"
$releaseDirectory = Join-Path $PSScriptRoot "releases"
$destination = Join-Path $releaseDirectory "Artisan-Android-1.0.0-test.apk"

New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
Copy-Item -LiteralPath $source -Destination $destination -Force

$hash = Get-FileHash -LiteralPath $destination -Algorithm SHA256
Write-Host "APK: $destination"
Write-Host "SHA256: $($hash.Hash)"
