# ArkAngel Icon Conversion Script - Simple Version
param(
    [Parameter(Mandatory=$true)]
    [string]$InputImage
)

Write-Host "Converting ArkAngel Icon..." -ForegroundColor Green
Write-Host "Input image: $InputImage" -ForegroundColor Cyan

# Check if input file exists
if (-not (Test-Path $InputImage)) {
    Write-Host "Error: Input image not found!" -ForegroundColor Red
    exit 1
}

# Create icons directory if it doesn't exist
$iconsDir = "src-tauri\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force
    Write-Host "Created icons directory" -ForegroundColor Yellow
}

# Function to resize image using .NET
function Resize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )
    
    try {
        Add-Type -AssemblyName System.Drawing
        
        # Load the original image
        $originalImage = [System.Drawing.Image]::FromFile($InputPath)
        
        # Create a new bitmap with the desired size
        $newImage = New-Object System.Drawing.Bitmap($Width, $Height)
        $graphics = [System.Drawing.Graphics]::FromImage($newImage)
        
        # Set high quality settings
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Draw the resized image
        $graphics.DrawImage($originalImage, 0, 0, $Width, $Height)
        
        # Save the resized image
        $newImage.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # Clean up
        $graphics.Dispose()
        $newImage.Dispose()
        $originalImage.Dispose()
        
        Write-Host "Created: $OutputPath ($Width x $Height)" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "Error creating $OutputPath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Convert to different PNG sizes
Write-Host "Converting to PNG formats..." -ForegroundColor Yellow

$success = $true

# 32x32.png
$success = $success -and (Resize-Image -InputPath $InputImage -OutputPath "$iconsDir\32x32.png" -Width 32 -Height 32)

# 128x128.png
$success = $success -and (Resize-Image -InputPath $InputImage -OutputPath "$iconsDir\128x128.png" -Width 128 -Height 128)

# 128x128@2x.png (256x256)
$success = $success -and (Resize-Image -InputPath $InputImage -OutputPath "$iconsDir\128x128@2x.png" -Width 256 -Height 256)

# icon.png (512x512)
$success = $success -and (Resize-Image -InputPath $InputImage -OutputPath "$iconsDir\icon.png" -Width 512 -Height 512)

# Create ICO file (Windows icon)
Write-Host "Creating Windows ICO file..." -ForegroundColor Yellow
try {
    Add-Type -AssemblyName System.Drawing
    
    # Load the 256x256 image for ICO
    $icoImage = [System.Drawing.Image]::FromFile("$iconsDir\128x128@2x.png")
    
    # Save as ICO (simplified approach)
    $icoImage.Save("$iconsDir\icon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)
    $icoImage.Dispose()
    
    Write-Host "Created: $iconsDir\icon.ico" -ForegroundColor Green
}
catch {
    Write-Host "Error creating ICO file: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to create the ICO file manually using an online converter" -ForegroundColor Yellow
    $success = $false
}

# Create ICNS placeholder (copy the 512x512 as placeholder)
Copy-Item "$iconsDir\icon.png" "$iconsDir\icon.icns" -Force
Write-Host "Created placeholder: $iconsDir\icon.icns" -ForegroundColor Yellow

if ($success) {
    Write-Host "Icon conversion completed successfully!" -ForegroundColor Green
    Write-Host "All icon files created in: $iconsDir" -ForegroundColor Cyan
    Write-Host "Created files:" -ForegroundColor White
    Write-Host "  - 32x32.png" -ForegroundColor White
    Write-Host "  - 128x128.png" -ForegroundColor White
    Write-Host "  - 128x128@2x.png" -ForegroundColor White
    Write-Host "  - icon.png" -ForegroundColor White
    Write-Host "  - icon.ico" -ForegroundColor White
    Write-Host "  - icon.icns (placeholder)" -ForegroundColor Yellow
    Write-Host "Ready to build the app with new ArkAngel wings icon!" -ForegroundColor Green
} else {
    Write-Host "Some conversions failed. Check the errors above." -ForegroundColor Yellow
}

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the generated icons" -ForegroundColor White
Write-Host "  2. Run: npm run tauri build" -ForegroundColor White
Write-Host "  3. Test the new icon in the built app" -ForegroundColor White



