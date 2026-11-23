$emulatorDir = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator'
$files = @(
  'C:\Windows\WinSxS\amd64_microsoft-windows-mfplat_31bf3856ad364e35_10.0.26100.1_none_f39e410dbc01eba7\mfplat.dll',
  'C:\Windows\WinSxS\amd64_microsoft-windows-m..ndation-mftranscode_31bf3856ad364e35_10.0.26100.1_none_bc2bf546fb779b29\mftranscode.dll',
  'C:\Windows\WinSxS\amd64_microsoft-windows-mfcore_31bf3856ad364e35_10.0.26100.1_none_edcc4e95bfbe32f7\mfcore.dll',
  'C:\Windows\WinSxS\amd64_microsoft-windows-mfreadwrite_31bf3856ad364e35_10.0.26100.1_none_b6499064809108a3\mfreadwrite.dll',
  'C:\Windows\WinSxS\amd64_microsoft-windows-m..ation-mfmediaengine_31bf3856ad364e35_10.0.26100.1_none_fd48c22cd534cc44\MFMediaEngine.dll',
  'C:\Windows\WinSxS\amd64_microsoft-windows-mfh264enc_31bf3856ad364e35_10.0.26100.1_none_875554089cd4601e\mfh264enc.dll'
)
foreach ($f in $files) {
  if (Test-Path -LiteralPath $f) {
    Copy-Item -LiteralPath $f -Destination $emulatorDir -Force
    Write-Output ('COPIED ' + (Split-Path -Leaf $f))
  } else {
    Write-Output ('MISSING ' + $f)
  }
}
