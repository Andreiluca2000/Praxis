# Praxis-Claude: instaleaza puntea Claude <-> Praxis-Assistent pe serverul cabinetului.
# Pornire: dublu-clic pe installieren.cmd (in sesiunea RDP a lui Andree). Fara date de pacienti, fara cheie in fisiere.
# Pasi: 1) Claude Code (pentru utilizatorul tau)  2) cheia API ca variabila de utilizator (o lipesti tu)
#       3) ca administrator: Node.js, C:\Praxis-Claude, setarile care il inchid pe Claude  4) porneste Claude.
param(
  [switch]$AdminTeil,
  [switch]$OhneInstallation,   # doar pentru test: nu instaleaza programe, nu cere administrator
  [string]$Ziel = 'C:\Praxis-Claude',
  [string]$Verwaltet = 'C:\Program Files\ClaudeCode'
)
$ErrorActionPreference = 'Stop'
$quelle = $PSScriptRoot

function Schritt($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "   OK: $t" -ForegroundColor Green }
function Fehler($t) { Write-Host "   PROBLEMA: $t" -ForegroundColor Red; Read-Host 'Enter pentru a inchide'; exit 1 }

function Node-Pfad {
  $c = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe")) { if (Test-Path $p) { return $p } }
  return $null
}

# ---------- Partea de administrator (pornita automat, cu fereastra UAC) ----------
if ($AdminTeil) {
  Schritt 'Node.js'
  $node = Node-Pfad
  if (-not $node -and -not $OhneInstallation) {
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $node = Node-Pfad
  }
  if (-not $node) { Fehler 'Node.js nu e instalat (winget a esuat?). Instaleaza Node.js 22 LTS de pe nodejs.org si porneste din nou.' }
  $ver = & $node --version
  if ([int]($ver.TrimStart('v').Split('.')[0]) -lt 22) { Fehler "Node $ver e prea vechi; trebuie 22 sau mai nou." }
  Ok "Node $ver ($node)"

  Schritt "Dosarul $Ziel"
  New-Item -ItemType Directory -Force -Path $Ziel | Out-Null
  Copy-Item -Force (Join-Path $quelle 'praxis-bruecke.mjs') $Ziel
  Copy-Item -Force (Join-Path $quelle 'CLAUDE.md') $Ziel
  Ok 'puntea si CLAUDE.md copiate'

  Schritt "Setarile administrate ($Verwaltet)"
  New-Item -ItemType Directory -Force -Path $Verwaltet | Out-Null
  Copy-Item -Force (Join-Path $quelle 'managed-settings.json') $Verwaltet
  $mcp = @{ mcpServers = @{ praxis = @{ type = 'stdio'; command = $node; args = @((Join-Path $Ziel 'praxis-bruecke.mjs')); env = @{} } } }
  $mcp | ConvertTo-Json -Depth 6 | Set-Content -Encoding ASCII (Join-Path $Verwaltet 'managed-mcp.json')
  Ok 'Claude poate folosi doar puntea (fara linie de comanda, fisiere, internet)'

  Schritt 'Proba puntii'
  $probe = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
  # Proces separat cu intrare proprie; puntea se inchide singura cand se termina intrarea.
  $psi = New-Object System.Diagnostics.ProcessStartInfo $node
  $psi.Arguments = '"' + (Join-Path $Ziel 'praxis-bruecke.mjs') + '"'
  $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  # Octeti ASCII direct (WriteLine poate pune un BOM UTF-8 in fata, pe care puntea nu-l citeste ca JSON).
  $octeti = [System.Text.Encoding]::ASCII.GetBytes($probe + "`n")
  $proc.StandardInput.BaseStream.Write($octeti, 0, $octeti.Length); $proc.StandardInput.Close()
  $antwort = $proc.StandardOutput.ReadToEnd()
  $eroare = $proc.StandardError.ReadToEnd()
  if (-not $proc.WaitForExit(15000)) { $proc.Kill() }
  if ("$antwort" -notmatch 'praxis-bruecke') { $antwort = "$antwort $eroare" }
  if ("$antwort" -match 'praxis-bruecke') { Ok 'puntea raspunde' }
  else {
    & $node --check (Join-Path $Ziel 'praxis-bruecke.mjs')
    if ($LASTEXITCODE -ne 0) { Fehler "Puntea nu porneste cu Node $ver. $antwort" }
    Write-Host '   ATENTIE: proba nu a primit raspuns. In Claude verifica cu /mcp ca "praxis" e "connected".' -ForegroundColor Yellow
  }
  exit 0
}

# ---------- Partea utilizatorului ----------
Write-Host 'Praxis-Claude: instalare' -ForegroundColor Cyan

Schritt 'Claude Code'
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude -and -not $OhneInstallation) {
  # Instalatorul oficial, intr-un proces separat (un "exit" al lui nu opreste acest script).
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command 'Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression'
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ";$env:USERPROFILE\.local\bin"
  $claude = Get-Command claude -ErrorAction SilentlyContinue
}
if (-not $claude -and -not $OhneInstallation) { Fehler 'Claude Code nu s-a instalat. Incearca din nou sau instaleaza de pe claude.com/download.' }
Ok 'Claude Code gata'

Schritt 'Cheia API'
# Cheia poate sta intr-un fisier text langa script (prima linie). Se pune ca variabila de utilizator, apoi fisierul se sterge.
foreach ($nume in @('cheie.txt', 'New Text Document.txt')) {
  $f = Join-Path $quelle $nume
  if (-not (Test-Path -LiteralPath $f)) { continue }
  $v = "$(Get-Content -LiteralPath $f -TotalCount 1)".Trim()
  if (-not $v.StartsWith('sk-ant-')) { Write-Host "   $nume nu incepe cu sk-ant- - il las neatins." -ForegroundColor Yellow; Remove-Variable v; continue }
  if ($OhneInstallation) { $env:ANTHROPIC_API_KEY = $v } else { [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $v, 'User') }
  Remove-Variable v
  Remove-Item -LiteralPath $f -Force
  Ok "cheia preluata din $nume (fisierul a fost sters)"
  break
}
$cheie = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User')
if (-not $cheie) {
  Write-Host '   Se deschide fereastra "Umgebungsvariablen". Sus, la Benutzervariablen: Neu...'
  Write-Host '   Name: ANTHROPIC_API_KEY    Wert: cheia sk-ant-... (lipita)    apoi OK, OK.'
  if (-not $OhneInstallation) { Start-Process rundll32.exe 'sysdm.cpl,EditEnvironmentVariables' -Wait }
  $cheie = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User')
}
if (-not $cheie -and $OhneInstallation) { $cheie = $env:ANTHROPIC_API_KEY }  # test: cheie inventata doar in proces
if (-not $cheie) { Fehler 'Nu gasesc cheia ANTHROPIC_API_KEY. Porneste din nou si pune-o in fereastra.' }
if (-not $cheie.StartsWith('sk-ant-')) { Fehler 'Cheia nu incepe cu sk-ant- (lipita gresit?).' }
$env:ANTHROPIC_API_KEY = $cheie
Remove-Variable cheie
Ok 'cheia exista (nu o afisez)'

Schritt 'Partea de administrator (confirma fereastra Windows)'
$argumente = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-AdminTeil', '-Ziel', "`"$Ziel`"", '-Verwaltet', "`"$Verwaltet`"")
if ($OhneInstallation) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -AdminTeil -OhneInstallation -Ziel $Ziel -Verwaltet $Verwaltet
  $cod = $LASTEXITCODE
} else {
  $p = Start-Process powershell.exe -ArgumentList $argumente -Verb RunAs -Wait -PassThru
  $cod = $p.ExitCode
}
if ($cod -ne 0) { Fehler 'Partea de administrator nu a reusit (vezi fereastra ei).' }
Ok 'gata'

Schritt 'Mai ai de facut in Praxis-Assistent'
Write-Host '   Einstellungen -> KI-Assistent -> Ein (altfel puntea nu da nimic).'
Write-Host '   In DURIA: exportul KVDT intr-un dosar; spune-i lui Claude calea fisierului.'

if ($OhneInstallation) { exit 0 }
Schritt 'Pornesc Claude'
Write-Host '   Daca intreaba de cheia gasita: Yes. Primul mesaj: status'
Set-Location $Ziel
& claude
