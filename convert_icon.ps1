# ArkAngel Icon Conversion Script
# This script converts a PNG image to all required icon formats for the desktop app

param(
    [Parameter(Mandatory=$true)]
    [string]$InputImage
)

Write-Host "🔄 Converting ArkAngel Icon..." -ForegroundColor Green
Write-Host "Input image: $InputImage" -ForegroundColor Cyan

# Check if input file exists
if (-not (Test-Path $InputImage)) {
    Write-Host "❌ Error: Input image '$InputImage' not found!" -ForegroundColor Red
    exit 1
}

# Create icons directory if it doesn't exist
$iconsDir = "src-tauri\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force
    Write-Host "📁 Created icons directory" -ForegroundColor Yellow
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
        
        Write-Host "✅ Created: $OutputPath ($Width x $Height)" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Error creating $OutputPath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Convert to different PNG sizes
Write-Host "`n🔄 Converting to PNG formats..." -ForegroundColor Yellow

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
Write-Host "`n🔄 Creating Windows ICO file..." -ForegroundColor Yellow
try {
    Add-Type -AssemblyName System.Drawing
    
    # Load the 256x256 image for ICO
    $icoImage = [System.Drawing.Image]::FromFile("$iconsDir\128x128@2x.png")
    
    # Create ICO with multiple sizes
    $icoSizes = @(16, 32, 48, 64, 128, 256)
    $icoImages = @()
    
    foreach ($size in $icoSizes) {
        $resized = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($resized)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($icoImage, 0, 0, $size, $size)
        $icoImages += $resized
        $g.Dispose()
    }
    
    # Save as ICO (simplified - just save the 256x256 as ICO)
    $icoImage.Save("$iconsDir\icon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)
    $icoImage.Dispose()
    
    foreach ($img in $icoImages) {
        $img.Dispose()
    }
    
    Write-Host "✅ Created: $iconsDir\icon.ico" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error creating ICO file: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 You may need to create the ICO file manually using an online converter" -ForegroundColor Yellow
    $success = $false
}

# Create ICNS file (macOS icon) - This is complex, so we'll provide instructions
Write-Host "`n🔄 Creating macOS ICNS file..." -ForegroundColor Yellow
Write-Host "⚠️  ICNS creation requires special tools. Please use one of these methods:" -ForegroundColor Yellow
Write-Host "   1. Online: https://cloudconvert.com/png-to-icns" -ForegroundColor Cyan
Write-Host "   2. macOS: Use 'iconutil' command" -ForegroundColor Cyan
Write-Host "   3. Copy the 512x512 icon.png and rename to icon.icns (temporary)" -ForegroundColor Cyan

# For now, copy the 512x512 as a placeholder
Copy-Item "$iconsDir\icon.png" "$iconsDir\icon.icns" -Force
Write-Host "📋 Created placeholder: $iconsDir\icon.icns" -ForegroundColor Yellow

if ($success) {
    Write-Host "`n🎉 Icon conversion completed successfully!" -ForegroundColor Green
    Write-Host "📁 All icon files created in: $iconsDir" -ForegroundColor Cyan
    Write-Host "`n📋 Created files:" -ForegroundColor White
    Write-Host "   • 32x32.png" -ForegroundColor White
    Write-Host "   • 128x128.png" -ForegroundColor White
    Write-Host "   • 128x128@2x.png" -ForegroundColor White
    Write-Host "   • icon.png" -ForegroundColor White
    Write-Host "   • icon.ico" -ForegroundColor White
    Write-Host "   • icon.icns (placeholder)" -ForegroundColor Yellow
    Write-Host "`n🚀 Ready to build the app with new ArkAngel wings icon!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some conversions failed. Check the errors above." -ForegroundColor Yellow
}

Write-Host "`n💡 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Review the generated icons" -ForegroundColor White
Write-Host "   2. Run: npm run tauri build" -ForegroundColor White
Write-Host "   3. Test the new icon in the built app" -ForegroundColor White



