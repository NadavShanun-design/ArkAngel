# Create a simple ICO file that Windows will accept
Write-Host "Creating simple ICO file..." -ForegroundColor Green

$iconsDir = "src-tauri\icons"
$outputPath = "$iconsDir\icon.ico"

# Use the 32x32 PNG as the source
$sourcePng = "$iconsDir\32x32.png"

if (Test-Path $sourcePng) {
    # Copy the PNG as ICO (this is a simple approach)
    Copy-Item $sourcePng $outputPath -Force
    Write-Host "Created ICO file: $outputPath" -ForegroundColor Green
    Write-Host "Note: This is a simple PNG-as-ICO approach" -ForegroundColor Yellow
} else {
    Write-Host "Source PNG not found: $sourcePng" -ForegroundColor Red
    exit 1
}



