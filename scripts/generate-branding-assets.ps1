param(
  [string]$FaviconSource = "icons/Favicon.PNG",
  [string]$LogoSource = "icons/logo_Recalc.PNG"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Ensure-Dir([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

function Save-PngContain([System.Drawing.Image]$img, [int]$size, [string]$destPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  try {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)

      $scale = [Math]::Min($size / $img.Width, $size / $img.Height)
      $w = [int][Math]::Round($img.Width * $scale)
      $h = [int][Math]::Round($img.Height * $scale)
      $x = [int][Math]::Floor(($size - $w) / 2)
      $y = [int][Math]::Floor(($size - $h) / 2)
      $g.DrawImage($img, $x, $y, $w, $h)
    } finally {
      $g.Dispose()
    }

    $dir = Split-Path -Parent $destPath
    Ensure-Dir $dir
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bmp.Dispose()
  }
}

function Write-IcoFromPngBytes($images, [string]$destPath) {
  # $images: array of @{ Size = <int>; Bytes = <byte[]> }
  $count = $images.Count
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  try {
    # ICONDIR
    $bw.Write([UInt16]0) # reserved
    $bw.Write([UInt16]1) # type 1=icon
    $bw.Write([UInt16]$count)

    $offset = 6 + (16 * $count)

    foreach ($img in $images) {
      $sz = [int]$img.Size
      $w = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
      $h = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
      $bytes = [byte[]]$img.Bytes

      # ICONDIRENTRY
      $bw.Write($w)
      $bw.Write($h)
      $bw.Write([byte]0)   # color count
      $bw.Write([byte]0)   # reserved
      $bw.Write([UInt16]1) # planes
      $bw.Write([UInt16]32) # bitcount
      $bw.Write([UInt32]$bytes.Length) # bytes in res
      $bw.Write([UInt32]$offset) # image offset

      $offset += $bytes.Length
    }

    foreach ($img in $images) {
      $bw.Write([byte[]]$img.Bytes)
    }

    $dir = Split-Path -Parent $destPath
    Ensure-Dir $dir
    [System.IO.File]::WriteAllBytes($destPath, $ms.ToArray())
  } finally {
    $bw.Dispose()
    $ms.Dispose()
  }
}

if (-not (Test-Path $FaviconSource)) {
  throw "Missing favicon source: $FaviconSource"
}
if (-not (Test-Path $LogoSource)) {
  throw "Missing logo source: $LogoSource"
}

$faviconOutDir = "public/icons"
Ensure-Dir $faviconOutDir

$img = [System.Drawing.Image]::FromFile((Resolve-Path $FaviconSource))
try {
  Save-PngContain $img 16  (Join-Path $faviconOutDir "icon16.png")
  Save-PngContain $img 32  (Join-Path $faviconOutDir "icon32.png")
  Save-PngContain $img 48  (Join-Path $faviconOutDir "icon48.png")
  Save-PngContain $img 128 (Join-Path $faviconOutDir "icon128.png")
  Save-PngContain $img 180 (Join-Path $faviconOutDir "apple-touch-icon.png")
} finally {
  $img.Dispose()
}

$icoImages = @(
  @{ Size = 16; Bytes = [System.IO.File]::ReadAllBytes((Join-Path $faviconOutDir "icon16.png")) },
  @{ Size = 32; Bytes = [System.IO.File]::ReadAllBytes((Join-Path $faviconOutDir "icon32.png")) },
  @{ Size = 48; Bytes = [System.IO.File]::ReadAllBytes((Join-Path $faviconOutDir "icon48.png")) }
)
Write-IcoFromPngBytes $icoImages "src/app/favicon.ico"

# Replace public branding logo (single source of truth)
Ensure-Dir "public/branding"
Copy-Item -Force $LogoSource "public/branding/logo-recalc.png"

Write-Host "Branding assets generated:"
Write-Host " - public/icons/icon16.png"
Write-Host " - public/icons/icon32.png"
Write-Host " - public/icons/icon48.png"
Write-Host " - public/icons/icon128.png"
Write-Host " - public/icons/apple-touch-icon.png"
Write-Host " - src/app/favicon.ico"
Write-Host " - public/branding/logo-recalc.png"

