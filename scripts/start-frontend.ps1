. "$PSScriptRoot/common.ps1"
$pnpmCommand=Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($pnpmCommand) { $pnpmExe=$pnpmCommand.Source }
else {
    $pnpmExe=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd'
    if (!(Test-Path $pnpmExe)) { throw 'Install Node 24 and pnpm 11 first (npm install --global pnpm@11).' }
}
Push-Location (Join-Path $projectRoot 'frontend')
try {
    & $pnpmExe install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
    & $pnpmExe start
} finally { Pop-Location }
