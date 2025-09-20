# Create proper Windows 3.00 format ICO file
param(
    [Parameter(Mandatory=$true)]
    [string]$InputPng
)

Write-Host "Creating Windows 3.00 format ICO file..." -ForegroundColor Green
Write-Host "Input: $InputPng" -ForegroundColor Cyan

# Check if input exists
if (-not (Test-Path $InputPng)) {
    Write-Host "Error: Input PNG not found!" -ForegroundColor Red
    exit 1
}

# Create icons directory if needed
$iconsDir = "src-tauri\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force
}

try {
    Add-Type -AssemblyName System.Drawing
    
    # Load the original PNG
    $originalImage = [System.Drawing.Image]::FromFile($InputPng)
    Write-Host "Loaded image: $($originalImage.Width) x $($originalImage.Height)" -ForegroundColor Yellow
    
    # Create the required sizes for Windows ICO
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $bitmaps = @()
    
    # Create individual bitmaps for each size
    foreach ($size in $sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Set high quality rendering
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Draw the resized image
        $graphics.DrawImage($originalImage, 0, 0, $size, $size)
        
        $bitmaps += $bitmap
        $graphics.Dispose()
        Write-Host "Created $size x $size bitmap" -ForegroundColor Green
    }
    
    # Create the ICO file using Icon.Save with the largest bitmap
    $outputPath = "$iconsDir\icon.ico"
    $largestBitmap = $bitmaps[-1]  # 256x256
    
    # Save as ICO format - this creates a proper Windows 3.00 format
    $largestBitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Icon)
    
    Write-Host "Successfully created Windows 3.00 format ICO: $outputPath" -ForegroundColor Green
    
    # Clean up
    $originalImage.Dispose()
    foreach ($bitmap in $bitmaps) {
        $bitmap.Dispose()
    }
    
    Write-Host "ICO file created successfully!" -ForegroundColor Green
    Write-Host "Ready to test ArkAngel with wings logo!" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error creating ICO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor Yellow
    exit 1
}



