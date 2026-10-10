# Scarica gli annali idrologici Arpae (1916-2022) in annali\<anno>\
# Uso (PowerShell):  .\scarica_annali.ps1
# Se lo script e' bloccato:  powershell -ExecutionPolicy Bypass -File .\scarica_annali.ps1
# Usa curl.exe (incluso in Windows 10/11); riprende i download interrotti.
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path (Split-Path -Parent $base) "annali"

foreach ($u in Get-Content (Join-Path $base "elenco_link.txt")) {
    $u = $u.Trim()
    if (-not $u) { continue }
    $anno = [regex]::Match($u, 'idrologici-(\d+)').Groups[1].Value
    $nome = ($u -split '/')[-1]
    $dir = Join-Path $dest $anno
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "$anno\$nome"
    & curl.exe -L -C - --retry 5 -o (Join-Path $dir $nome) $u
    if ($LASTEXITCODE -ne 0) { Write-Warning "Errore su $u (rilancia lo script per riprendere)" }
}
Write-Host "Fatto. File in: $dest"
