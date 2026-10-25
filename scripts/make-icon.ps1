# Erzeugt ein einfaches Programmsymbol (blau, "PA") für Tauri.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'src-tauri\icons'
New-Item -ItemType Directory -Force $dir | Out-Null
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(31, 95, 174))
$font = New-Object System.Drawing.Font('Segoe UI', 230, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$g.DrawString('PA', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 0, 512, 512), $sf)
$png = Join-Path $dir 'source.png'
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output $png
