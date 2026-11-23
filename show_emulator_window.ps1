param([int]$TargetPid)
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinEnum {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
$windows = New-Object System.Collections.ArrayList
$callback = [WinEnum+EnumProc]{
  param($h, $p)
  $ownerPid = 0
  [void][WinEnum]::GetWindowThreadProcessId($h, [ref]$ownerPid)
  if ($ownerPid -eq $TargetPid) {
    $sb = New-Object System.Text.StringBuilder 512
    [void][WinEnum]::GetWindowText($h, $sb, 512)
    $vis = [WinEnum]::IsWindowVisible($h)
    [void]$windows.Add([pscustomobject]@{ Handle = $h; Visible = $vis; Title = $sb.ToString() })
  }
  return $true
}
[void][WinEnum]::EnumWindows($callback, [IntPtr]::Zero)
$windows | Format-Table -AutoSize
foreach ($w in $windows) {
  if ($w.Visible) {
    [void][WinEnum]::ShowWindow($w.Handle, 9)
    [void][WinEnum]::SetForegroundWindow($w.Handle)
    "Restored and focused $($w.Handle)"
  }
}
