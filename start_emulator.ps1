$exe = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'
$args = @('-avd','Eyecon_GAPI_35','-no-snapshot-load','-no-boot-anim','-gpu','swiftshader_indirect','-memory','4096')
$p = Start-Process -FilePath $exe -ArgumentList $args -PassThru
"PID=$($p.Id)"
