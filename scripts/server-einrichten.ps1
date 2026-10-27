<#
  Praxis-Assistent – einmalige Einrichtung auf dem Terminalserver.
  Ausführen als Administrator:  Rechtsklick → "Mit PowerShell ausführen" (als Admin)
  oder: powershell -ExecutionPolicy Bypass -File server-einrichten.ps1
  Nur prüfen (ändert nichts):  ... -File server-einrichten.ps1 -NurPruefen

  Rechte-Modell (nichts wird gelöscht):
   - Wurzel C:\ProgramData\Praxis-Assistent: Administratoren/SYSTEM Vollzugriff; Benutzer dürfen nur hineinsehen
     und Dateien direkt in der Wurzel lesen (konten.json). Konten ändern/anlegen nur noch als Administrator.
   - gdt\: Benutzer dürfen hier nur einen eigenen Unterordner anlegen (je Arbeitsplatz). Wer ihn anlegt,
     wird Besitzer (ERSTELLER-BESITZER) und hat als einziger Benutzer Zugriff – andere Benutzer sehen ihn nicht.
   - Bestehende Arbeitsplatz-Ordner: Rechte des Besitzers werden ausdrücklich gesetzt; gehört ein Ordner
     einem Administrator, wird nur gewarnt (Besitzer bitte von Hand festlegen).
#>
param(
  [string]$Root = "$env:ProgramData\Praxis-Assistent",
  # Wer das Programm nutzen darf. Standard: alle angemeldeten Benutzer des Servers.
  # Besser: eigene AD-/lokale Gruppe, z. B. "PRAXIS\Praxis-Assistent-Benutzer".
  [string]$UserGroup = '*S-1-5-32-545',   # VORDEFINIERT\Benutzer (sprachunabhängig per SID)
  [switch]$NurPruefen
)

$SidAdmins = 'S-1-5-32-544'
$SidSystem = 'S-1-5-18'
$SidCreatorOwner = 'S-1-3-0'
# Gruppen, die nie Schreib- oder Leserechte auf fremde Arbeitsplatz-Ordner haben dürfen.
$BroadSids = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545')
# Rechte, die über Lesen/Durchsuchen hinausgehen (ohne AppendData, das gesondert geprüft wird).
$WriteMask = [int](
  [Security.AccessControl.FileSystemRights]::WriteData -bor
  [Security.AccessControl.FileSystemRights]::WriteExtendedAttributes -bor
  [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
  [Security.AccessControl.FileSystemRights]::WriteAttributes -bor
  [Security.AccessControl.FileSystemRights]::Delete -bor
  [Security.AccessControl.FileSystemRights]::ChangePermissions -bor
  [Security.AccessControl.FileSystemRights]::TakeOwnership)
$AppendMask = [int][Security.AccessControl.FileSystemRights]::AppendData
$ReadDataMask = [int][Security.AccessControl.FileSystemRights]::ReadData

function Resolve-PraxisSid([string]$Principal) {
  if ($Principal.StartsWith('*')) { return $Principal.Substring(1) }
  return (New-Object Security.Principal.NTAccount $Principal).Translate([Security.Principal.SecurityIdentifier]).Value
}

function Get-PraxisAces([string]$Path) {
  foreach ($ace in (Get-Acl -LiteralPath $Path).Access) {
    if ($ace.AccessControlType -ne 'Allow') { continue }
    try { $sid = $ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { $sid = $ace.IdentityReference.Value }
    [pscustomobject]@{ Sid = $sid; Rights = [int]$ace.FileSystemRights; Inherit = [string]$ace.InheritanceFlags; Propagate = [string]$ace.PropagationFlags }
  }
}

function Invoke-Icacls {
  & icacls @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls $($args -join ' ') fehlgeschlagen." }
}

# $AdminSid nur für Tests ohne Administratorrechte anders als die Gruppe Administratoren.
function Set-PraxisRechte([string]$Root, [string]$UserGroup, [string]$AdminSid = $SidAdmins) {
  $gdt = Join-Path $Root 'gdt'
  $konten = Join-Path $Root 'konten.json'
  New-Item -ItemType Directory -Force -Path $Root, $gdt | Out-Null
  if (-not (Test-Path -LiteralPath $konten)) { Set-Content -LiteralPath $konten -Value '[]' -Encoding UTF8 }

  # /grant:r ersetzt nur Einträge mit gleicher Vererbung – alte Benutzerrechte (z. B. "Ändern") daher zuerst entfernen.
  $remove = @($UserGroup) + ($BroadSids | ForEach-Object { "*$_" }) | Select-Object -Unique
  Invoke-Icacls $Root /inheritance:r
  foreach ($p in $remove) { Invoke-Icacls $Root /remove:g $p }
  # Wurzel: Benutzer nur Lesen/Durchsuchen dieses Ordners + Lesen der Dateien direkt darin (NP = nicht weiter vererbt).
  Invoke-Icacls $Root /grant:r "*${AdminSid}:(OI)(CI)F" "*${SidSystem}:(OI)(CI)F" "${UserGroup}:(RX)"
  Invoke-Icacls $Root /grant "${UserGroup}:(OI)(NP)(IO)(R)"
  # Kontendatei: alte ausdrückliche Rechte (früher Benutzer R/W/D) entfernen, Rechte nur aus der Wurzel.
  Invoke-Icacls $konten /reset

  # gdt: Benutzer dürfen nur Unterordner anlegen (nicht vererbt); der Ersteller wird alleiniger Benutzer-Besitzer.
  Invoke-Icacls $gdt /reset
  Invoke-Icacls $gdt /grant "${UserGroup}:(RA,X,S,AD)" "*${SidCreatorOwner}:(OI)(CI)(IO)F"

  $warnings = @()
  foreach ($dir in Get-ChildItem -LiteralPath $gdt -Directory) {
    $owner = (Get-Acl -LiteralPath $dir.FullName).Owner
    $ownerSid = try { (New-Object Security.Principal.NTAccount $owner).Translate([Security.Principal.SecurityIdentifier]).Value } catch { $owner }
    if ($ownerSid -in @($SidAdmins, $SidSystem, $AdminSid) -or $BroadSids -contains $ownerSid) {
      $warnings += "Ordner $($dir.FullName) gehört '$owner'. Bitte Benutzer festlegen: icacls `"$($dir.FullName)`" /setowner <Benutzer> /T  und  icacls `"$($dir.FullName)`" /grant <Benutzer>:(OI)(CI)F"
      continue
    }
    foreach ($p in $remove) { Invoke-Icacls $dir.FullName /remove:g $p }
    Invoke-Icacls $dir.FullName /grant "*${ownerSid}:(OI)(CI)F"
  }
  return $warnings
}

# Liefert Befunde (leer = in Ordnung). Prüft die tatsächlich wirksamen Einträge, nicht nur das Skript.
function Test-PraxisRechte([string]$Root, [string]$UserGroup) {
  $groupSid = Resolve-PraxisSid $UserGroup
  $broad = @($BroadSids) + $groupSid | Select-Object -Unique
  if (-not (Test-Path -LiteralPath $Root)) { return @("Ordner $Root fehlt – Einrichtung noch nicht ausgeführt.") }
  $problems = @()
  $gdt = Join-Path $Root 'gdt'
  $konten = Join-Path $Root 'konten.json'
  foreach ($a in Get-PraxisAces $Root) {
    if ($broad -contains $a.Sid -and (($a.Rights -band ($WriteMask -bor $AppendMask)) -ne 0)) { $problems += "Wurzel: $($a.Sid) darf schreiben." }
  }
  if (Test-Path -LiteralPath $konten) {
    foreach ($a in Get-PraxisAces $konten) {
      if ($broad -contains $a.Sid -and (($a.Rights -band ($WriteMask -bor $AppendMask)) -ne 0)) { $problems += "konten.json: $($a.Sid) darf ändern." }
    }
  }
  if (Test-Path -LiteralPath $gdt) {
    foreach ($a in Get-PraxisAces $gdt) {
      if ($broad -notcontains $a.Sid) { continue }
      if (($a.Rights -band $WriteMask) -ne 0) { $problems += "gdt: $($a.Sid) darf mehr als Ordner anlegen." }
      if (($a.Rights -band $ReadDataMask) -ne 0) { $problems += "gdt: $($a.Sid) darf die Ordnerliste lesen." }
      if ($a.Inherit -ne 'None') { $problems += "gdt: Rechte von $($a.Sid) werden an Arbeitsplatz-Ordner vererbt." }
    }
    foreach ($dir in Get-ChildItem -LiteralPath $gdt -Directory) {
      foreach ($a in Get-PraxisAces $dir.FullName) {
        if ($broad -contains $a.Sid) { $problems += "$($dir.Name): Gruppe $($a.Sid) hat Zugriff auf fremde Übergaben." }
      }
    }
  }
  return $problems
}

# Per Punkt geladen (Tests): nur die Funktionen bereitstellen.
if ($MyInvocation.InvocationName -eq '.') { return }
$ErrorActionPreference = 'Stop'

if ($NurPruefen) {
  $found = Test-PraxisRechte $Root $UserGroup
  if ($found.Count -eq 0) { Write-Host 'Rechte in Ordnung.'; exit 0 }
  $found | ForEach-Object { Write-Warning $_ }
  exit 2
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Error 'Bitte als Administrator ausführen.'; exit 1 }

Write-Host "1/3 Ordner und Rechte: $Root"
$warnings = Set-PraxisRechte $Root $UserGroup
$warnings | ForEach-Object { Write-Warning $_ }

Write-Host '2/3 Rechte prüfen'
$found = Test-PraxisRechte $Root $UserGroup
if ($found.Count -gt 0) { $found | ForEach-Object { Write-Warning $_ }; Write-Error 'Rechte nicht wie vorgesehen – bitte prüfen.'; exit 2 }
Write-Host '   in Ordnung'

Write-Host '3/3 Weitere Prüfungen'
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ff) { Write-Host "   ffmpeg gefunden: $($ff.Source)" } else { Write-Warning '   ffmpeg fehlt – für das Diktat installieren (z. B. winget install Gyan.FFmpeg) und in PATH aufnehmen.' }
Write-Host ''
Write-Host 'Fertig. Hinweise:'
Write-Host ' - Konten anlegen/sperren nur noch als Administrator: Praxis-Assistent per Rechtsklick "Als Administrator ausführen".'
Write-Host ' - Jede RDP-Sitzung bekommt automatisch einen eigenen GDT-Ordner: gdt\<Arbeitsplatzname>\eingang|ausgang;'
Write-Host '   nur der Windows-Benutzer, der ihn zuerst anlegt, hat Zugriff. Ein zweiter Benutzer am gleichen Arbeitsplatz erhält "Zugriff verweigert".'
Write-Host ' - In DURIA je Arbeitsplatz das GDT-Verzeichnis auf diesen Ordner einstellen (mit DURIA-Hotline abstimmen).'
Write-Host ' - Mikrofon im RDP-Client: Lokale Ressourcen → Remoteaudio → "Von diesem Computer aufzeichnen".'
Write-Host '   Auf dem Server ggf. per Gruppenrichtlinie erlauben: "Audio- und Videowiedergabeumleitung" / "Audioaufzeichnungsumleitung zulassen".'
