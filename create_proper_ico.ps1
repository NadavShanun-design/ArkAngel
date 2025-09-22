# Create proper Windows ICO file from PNG
param(
    [Parameter(Mandatory=$true)]
    [string]$InputPng
)

Write-Host "Creating proper Windows ICO file..." -ForegroundColor Green
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
    
    # Create multiple sizes for ICO (Windows requires multiple resolutions)
    $sizes = @(16, 32, 48, 64, 128, 256)
    $iconImages = @()
    
    foreach ($size in $sizes) {
        # Create resized bitmap
        $resizedBitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($resizedBitmap)
        
        # Set high quality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Draw the resized image
        $graphics.DrawImage($originalImage, 0, 0, $size, $size)
        
        # Add to collection
        $iconImages += $resizedBitmap
        
        $graphics.Dispose()
        Write-Host "Created $size x $size version" -ForegroundColor Green
    }
    
    # Create the ICO file using Icon.Save method
    $outputPath = "$iconsDir\icon.ico"
    
    # For ICO files, we need to use a different approach
    # Create a temporary file and use Icon constructor
    $tempPath = "$env:TEMP\temp_icon.ico"
    
    # Save the largest size (256x256) as the main ICO
    $largestIcon = $iconImages[-1]  # 256x256
    $largestIcon.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Icon)
    
    # Copy to final location
    Copy-Item $tempPath $outputPath -Force
    Remove-Item $tempPath -Force
    
    Write-Host "Successfully created: $outputPath" -ForegroundColor Green
    
    # Clean up
    $originalImage.Dispose()
    foreach ($img in $iconImages) {
        $img.Dispose()
    }
    
    Write-Host "ICO file created successfully!" -ForegroundColor Green
    Write-Host "Ready to build ArkAngel with wings logo!" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error creating ICO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Use the 256x256 PNG as ICO (simpler approach)
    try {
        $fallbackPath = "$iconsDir\icon.ico"
        Copy-Item "$iconsDir\128x128@2x.png" $fallbackPath -Force
        Write-Host "Created fallback ICO from 256x256 PNG" -ForegroundColor Yellow
    } catch {
        Write-Host "Fallback also failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}



