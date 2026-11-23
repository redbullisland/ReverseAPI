$ErrorActionPreference = 'Stop'
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Out-Null
$p = Start-Process -FilePath 'C:\laragon\bin\python\python-3.13\Scripts\frida.EXE' -ArgumentList '-D','emulator-5554','-n','Eyecon','-l','D:\ReverseAPI\eyecon_hook.js','-o','D:\ReverseAPI\frida_out.txt','--runtime=v8' -WindowStyle Hidden -PassThru -RedirectStandardOutput 'D:\ReverseAPI\frida_runner.out' -RedirectStandardError 'D:\ReverseAPI\frida_runner.err'
"PID=$($p.Id)"
