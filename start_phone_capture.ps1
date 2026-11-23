$ErrorActionPreference = 'Stop'
$p = Start-Process -FilePath 'C:\laragon\bin\python\python-3.13\Scripts\frida.EXE' -ArgumentList '-H','127.0.0.1:27042','-n','Gadget','-l','D:\ReverseAPI\eyecon_hook_min.js','-o','D:\ReverseAPI\frida_phone_out.txt','--runtime=v8' -WindowStyle Hidden -PassThru -RedirectStandardOutput 'D:\ReverseAPI\frida_phone_runner.out' -RedirectStandardError 'D:\ReverseAPI\frida_phone_runner.err'
"PID=$($p.Id)"
