$ErrorActionPreference = 'Stop'
$trufRoot = $PSScriptRoot
$trufNode = $null
$trufBundled = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Test-Path -LiteralPath $trufBundled) { $trufNode = $trufBundled }
if (-not $trufNode) { $trufNode = (Get-Command node -ErrorAction Stop).Source }
$trufMajor = [int](& $trufNode -p 'process.versions.node.split(".")[0]')
if ($trufMajor -lt 24) { throw 'Install Node.js 24 LTS, then run Start-TRUF.ps1 again.' }
if (-not (Test-Path -LiteralPath (Join-Path $trufRoot 'node_modules'))) { throw 'Run npm ci with Node.js 24 before starting TRUF.' }
$trufData = Join-Path $trufRoot '.data'
New-Item -ItemType Directory -Force -Path $trufData | Out-Null
$trufEntry = Join-Path $trufRoot 'scripts\local-app.mjs'
Start-Process -FilePath $trufNode -ArgumentList @('"' + $trufEntry + '"') -WorkingDirectory $trufRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $trufData 'startup.log') -RedirectStandardError (Join-Path $trufData 'startup-error.log') | Out-Null
Write-Host 'TRUF is starting. The first build may take a minute. Open http://localhost:3000 when .data/startup.log says TRUF READY.'
