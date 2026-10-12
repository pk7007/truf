$ErrorActionPreference = 'Stop'
$trufRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$trufRecord = Join-Path $trufRoot '.data\local-processes.json'
if (-not (Test-Path -LiteralPath $trufRecord)) { Write-Host 'No TRUF launcher record.'; exit }
$trufState = Get-Content -LiteralPath $trufRecord -Raw | ConvertFrom-Json
if ([IO.Path]::GetFullPath($trufState.root) -ne $trufRoot) { throw 'Launcher record does not belong to this directory.' }
$trufProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($trufState.supervisor)" -ErrorAction SilentlyContinue
if ($trufProcess -and $trufProcess.CommandLine.Contains((Join-Path $trufRoot 'scripts\local-app.mjs'))) {
  $trufPgControl = Join-Path $trufRoot 'node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
  $trufPgData = Join-Path $trufRoot '.data\postgres'
  if ((Test-Path -LiteralPath $trufPgControl) -and (Test-Path -LiteralPath (Join-Path $trufPgData 'postmaster.pid'))) {
    & $trufPgControl stop -D $trufPgData -m fast -w -t 20
    if ($LASTEXITCODE -ne 0) { throw 'Database shutdown needs attention. TRUF was not force-stopped.' }
  }
  Set-Content -LiteralPath (Join-Path $trufRoot '.data\stop-request') -Value 'stop'
  Wait-Process -Id $trufState.supervisor -Timeout 15 -ErrorAction SilentlyContinue
  if (Get-Process -Id $trufState.supervisor -ErrorAction SilentlyContinue) { & taskkill.exe /PID $trufState.supervisor /T /F | Out-Null }
  Write-Host 'Stopped the TRUF launcher and its local child services.'
} else { Write-Host 'The recorded TRUF launcher is no longer running. No unrelated process was stopped.' }
