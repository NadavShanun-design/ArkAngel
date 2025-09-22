# Create Windows-compatible ICO file using proper method
Write-Host "Creating Windows-compatible ICO file..." -ForegroundColor Green

$iconsDir = "src-tauri\icons"
$outputPath = "$iconsDir\icon.ico"
$sourcePng = "$iconsDir\32x32.png"

if (Test-Path $sourcePng) {
    try {
        Add-Type -AssemblyName System.Drawing
        
        # Load the PNG
        $pngImage = [System.Drawing.Image]::FromFile($sourcePng)
        
        # Create 32x32 bitmap
        $bitmap = New-Object System.Drawing.Bitmap(32, 32)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($pngImage, 0, 0, 32, 32)
        
        # Get icon handle and create Icon object
        $iconHandle = $bitmap.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
        
        # Create file stream and save
        $fileStream = [System.IO.File]::Create($outputPath)
        $icon.Save($fileStream)
        $fileStream.Close()
        
        # Clean up
        $graphics.Dispose()
        $bitmap.Dispose()
        $icon.Dispose()
        $pngImage.Dispose()
        
        Write-Host "Created Windows-compatible ICO: $outputPath" -ForegroundColor Green
        
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Source PNG not found: $sourcePng" -ForegroundColor Red
    exit 1
}



