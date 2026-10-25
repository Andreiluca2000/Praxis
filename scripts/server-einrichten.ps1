<#
  Praxis-Assistent – einmalige Einrichtung auf dem Terminalserver.
  Ausführen als Administrator:  Rechtsklick → "Mit PowerShell ausführen" (als Admin)
  oder: powershell -ExecutionPolicy Bypass -File server-einrichten.ps1

  Was passiert (nichts wird gelöscht):
   1. Ordner C:\ProgramData\Praxis-Assistent anlegen (Konten + GDT-Austausch je Arbeitsplatz).
   2. Rechte: Administratoren/SYSTEM Vollzugriff; Gruppe "Benutzer" darf lesen/schreiben/ändern,
      aber NICHT die Rechte selbst ändern oder den Ordner übernehmen.
   3. Konten-Datei: nur Administratoren, SYSTEM und Benutzer (Lesen/Schreiben) – keine Vererbung von außen.
   4. Prüft, ob ffmpeg vorhanden ist und zeigt den Mikrofon-Hinweis für Remote Desktop.
#>
param(
  [string]$Root = "$env:ProgramData\Praxis-Assistent",
  # Wer das Programm nutzen darf. Standard: alle angemeldeten Benutzer des Servers.
  # Besser: eigene AD-/lokale Gruppe, z. B. "PRAXIS\Praxis-Assistent-Benutzer".
  [string]$UserGroup = '*S-1-5-32-545'   # BUILTIN\Benutzer (sprachunabhängig per SID)
)
$ErrorActionPreference = 'Stop'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Error 'Bitte als Administrator ausführen.'; exit 1 }

Write-Host "1/4 Ordner anlegen: $Root"
New-Item -ItemType Directory -Force -Path $Root, (Join-Path $Root 'gdt') | Out-Null

Write-Host '2/4 Rechte setzen'
# (OI)(CI) = gilt für Unterordner und Dateien; M = Ändern (ohne Rechte-/Besitzänderung).
& icacls $Root /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "${UserGroup}:(OI)(CI)M" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'icacls fehlgeschlagen.'; exit 1 }

Write-Host '3/4 Konten-Datei absichern'
$konten = Join-Path $Root 'konten.json'
if (-not (Test-Path $konten)) { Set-Content -Path $konten -Value '[]' -Encoding UTF8 }
& icacls $konten /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' "${UserGroup}:(R,W,D)" | Out-Null

Write-Host '4/4 Prüfungen'
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ff) { Write-Host "   ffmpeg gefunden: $($ff.Source)" } else { Write-Warning '   ffmpeg fehlt – für das Diktat installieren (z. B. winget install Gyan.FFmpeg) und in PATH aufnehmen.' }
Write-Host ''
Write-Host 'Aktuelle Rechte:'
& icacls $Root
Write-Host ''
Write-Host 'Fertig. Hinweise:'
Write-Host ' - Jede RDP-Sitzung bekommt automatisch einen eigenen GDT-Ordner: gdt\<Arbeitsplatzname>\eingang|ausgang'
Write-Host ' - In DURIA je Arbeitsplatz das GDT-Verzeichnis auf diesen Ordner einstellen (mit DURIA-Hotline abstimmen).'
Write-Host ' - Mikrofon im RDP-Client: Lokale Ressourcen → Remoteaudio → "Von diesem Computer aufzeichnen".'
Write-Host '   Auf dem Server ggf. per Gruppenrichtlinie erlauben: "Audio- und Videowiedergabeumleitung" / "Audioaufzeichnungsumleitung zulassen".'
