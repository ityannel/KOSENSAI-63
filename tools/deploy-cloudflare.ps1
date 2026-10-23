$ErrorActionPreference = "Stop"
$top = Split-Path -Parent $PSScriptRoot
Set-Location $top
node tools/make-ai-context.mjs
if ($LASTEXITCODE -ne 0) { throw "make-ai-context.mjs が失敗しました" }
$out = Join-Path ([System.IO.Path]::GetTempPath()) ("kosen-deploy-" + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
Get-ChildItem site -Force | Copy-Item -Destination $out -Recurse -Force
if (Test-Path functions) { Copy-Item functions (Join-Path $out "functions") -Recurse }
Get-ChildItem $out -Recurse -File -Force | Where-Object { $_.Name -eq "README.md" -or $_.Extension -eq ".py" } | Remove-Item -Force
Set-Location $out
try {
  npx.cmd --yes wrangler@3 pages deploy . --project-name hakodate-kosensai --branch main --commit-dirty=true
  if ($LASTEXITCODE -ne 0) { throw "wrangler が失敗しました" }
} finally {
  Set-Location $top
}
