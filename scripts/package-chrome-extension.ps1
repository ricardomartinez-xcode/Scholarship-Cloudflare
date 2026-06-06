$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $repoRoot "apps\chrome-extension\recalc-sidepanel"
$distRoot = Join-Path $repoRoot "dist\chrome-extension"
$storeAssetsRoot = Join-Path $extensionRoot "store-assets\output"

if (-not (Test-Path $extensionRoot)) {
  throw "No se encontró la carpeta de la extensión en $extensionRoot"
}

$manifest = Get-Content (Join-Path $extensionRoot "manifest.json") -Raw | ConvertFrom-Json
$version = [string]$manifest.version
$zipPath = Join-Path $distRoot "recalc-sidepanel-v$version.zip"
$bundleRoot = Join-Path $distRoot "bundle"
$bundleExtensionRoot = Join-Path $bundleRoot "extension"
$bundleAssetsRoot = Join-Path $bundleRoot "store-assets"

New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
if (Test-Path $bundleRoot) { Remove-Item $bundleRoot -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

New-Item -ItemType Directory -Force -Path $bundleExtensionRoot | Out-Null
New-Item -ItemType Directory -Force -Path $bundleAssetsRoot | Out-Null

$extensionItems = @(
  "manifest.json",
  "background.js",
  "content-whatsapp.js",
  "content",
  "campaigns.js",
  "panel.html",
  "panel.css",
  "panel.js",
  "lib",
  "injected",
  "branding",
  "icons"
)

foreach ($item in $extensionItems) {
  Copy-Item (Join-Path $extensionRoot $item) $bundleExtensionRoot -Recurse -Force
}

if (Test-Path $storeAssetsRoot) {
  Copy-Item (Join-Path $storeAssetsRoot "*") $bundleAssetsRoot -Recurse -Force
}

Push-Location $bundleExtensionRoot
try {
  tar -a -cf $zipPath manifest.json background.js content-whatsapp.js content campaigns.js panel.html panel.css panel.js lib injected branding icons
} finally {
  Pop-Location
}

Write-Output "ZIP: $zipPath"
Write-Output "Extension bundle: $bundleExtensionRoot"
Write-Output "Store assets: $bundleAssetsRoot"
