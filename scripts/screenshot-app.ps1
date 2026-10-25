# Startet die gebaute App, macht ein Bildschirmfoto des Fensters und beendet sie wieder (nur zur Prüfung).
param([string]$Out = 'local\app-screenshot.png', [int]$Wait = 6)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Win {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
}
'@
$p = Start-Process 'src-tauri\target\release\praxis-assistent.exe' -WorkingDirectory $root -PassThru
try {
  Start-Sleep -Seconds $Wait
  $p.Refresh()
  $h = $p.MainWindowHandle
  if ($h -eq [IntPtr]::Zero) { throw 'Kein Fenster gefunden.' }
  $r = New-Object Win+RECT
  [void][Win]::GetWindowRect($h, [ref]$r)
  $w = $r.R - $r.L; $hh = $r.B - $r.T
  $bmp = New-Object System.Drawing.Bitmap $w, $hh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][Win]::PrintWindow($h, $hdc, 2)  # PW_RENDERFULLCONTENT (auch WebView-Inhalt)
  $g.ReleaseHdc($hdc); $g.Dispose()
  New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
  $bmp.Save((Join-Path $root $Out), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  Write-Output "$Out ($w x $hh)"
} finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
