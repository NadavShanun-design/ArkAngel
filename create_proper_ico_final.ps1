# Create proper Windows 3.00 format ICO file - Final attempt
Write-Host "Creating proper Windows 3.00 format ICO file..." -ForegroundColor Green

$iconsDir = "src-tauri\icons"
$outputPath = "$iconsDir\icon.ico"

# Use the 32x32 PNG as the source
$sourcePng = "$iconsDir\32x32.png"

if (Test-Path $sourcePng) {
    try {
        Add-Type -AssemblyName System.Drawing
        
        # Load the PNG
        $pngImage = [System.Drawing.Image]::FromFile($sourcePng)
        
        # Create a new bitmap for ICO
        $icoBitmap = New-Object System.Drawing.Bitmap(32, 32)
        $graphics = [System.Drawing.Graphics]::FromImage($icoBitmap)
        
        # Set high quality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        
        # Draw the image
        $graphics.DrawImage($pngImage, 0, 0, 32, 32)
        
        # Save as ICO using a different method
        $icoBitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Icon)
        
        # Clean up
        $graphics.Dispose()
        $icoBitmap.Dispose()
        $pngImage.Dispose()
        
        Write-Host "Created ICO file: $outputPath" -ForegroundColor Green
        
    } catch {
        Write-Host "Error creating ICO: $($_.Exception.Message)" -ForegroundColor Red
        # Fallback: copy PNG as ICO
        Copy-Item $sourcePng $outputPath -Force
        Write-Host "Used fallback method" -ForegroundColor Yellow
    }
} else {
    Write-Host "Source PNG not found: $sourcePng" -ForegroundColor Red
    exit 1
}