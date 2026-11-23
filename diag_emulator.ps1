Write-Output '=== EMULATOR VERSION ==='
$exe = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'
if (Test-Path -LiteralPath $exe) {
  Get-Item -LiteralPath $exe | Select-Object FullName,Length,@{n='FileVersion';e={$_.VersionInfo.FileVersion}},@{n='ProductVersion';e={$_.VersionInfo.ProductVersion}} | Format-List
} else {
  Write-Output "MISSING: $exe"
}

Write-Output '=== WINDOWS ERROR EVENTS (emulator) ==='
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddHours(-8)} -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -match 'emulator\.exe' } |
  Select-Object -First 10 TimeCreated,ProviderName,Id,Message |
  Format-List

Write-Output '=== SDK ROOT ==='
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
Get-ChildItem -LiteralPath $sdk -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName

Write-Output '=== EMULATOR PACKAGE PROPERTIES ==='
Get-Content -LiteralPath (Join-Path $sdk 'emulator\source.properties') -ErrorAction SilentlyContinue
