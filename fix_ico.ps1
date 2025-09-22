# Fix ICO file for Windows compatibility
Add-Type -AssemblyName System.Drawing

# Load the 256x256 PNG
$sourceImage = [System.Drawing.Image]::FromFile("src-tauri\icons\128x128@2x.png")

# Create a new bitmap for ICO
$icoBitmap = New-Object System.Drawing.Bitmap(32, 32)
$graphics = [System.Drawing.Graphics]::FromImage($icoBitmap)

# Set high quality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

# Draw the resized image
$graphics.DrawImage($sourceImage, 0, 0, 32, 32)

# Save as PNG first
$icoBitmap.Save("src-tauri\icons\temp_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Clean up
$graphics.Dispose()
$icoBitmap.Dispose()
$sourceImage.Dispose()

Write-Host "Created temporary PNG for ICO conversion"



