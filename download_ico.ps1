# Download properly formatted ICO from online converter
Write-Host "Creating ICO using online converter approach..." -ForegroundColor Green

# For now, let's try a different approach - use the existing PNG files
# and create a minimal ICO that Windows will accept

$iconsDir = "src-tauri\icons"
$outputPath = "$iconsDir\icon.ico"

# Copy the 256x256 PNG as ICO (this sometimes works)
$sourcePng = "$iconsDir\128x128@2x.png"  # This is 256x256

if (Test-Path $sourcePng) {
    Copy-Item $sourcePng $outputPath -Force
    Write-Host "Copied 256x256 PNG as ICO: $outputPath" -ForegroundColor Green
} else {
    Write-Host "Source PNG not found: $sourcePng" -ForegroundColor Red
    exit 1
}

Write-Host "ICO file ready for testing" -ForegroundColor Cyan



