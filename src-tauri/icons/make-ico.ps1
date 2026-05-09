Add-Type -AssemblyName System.Drawing

# Create a simple 128x128 bitmap with color
$bmp = New-Object System.Drawing.Bitmap(128, 128)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(79, 70, 229))

# Add text
$font = New-Object System.Drawing.Font('Arial', 40, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::White
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString('铁', $font, $brush, 64, 64, $format)

# Save as PNG first
$bmp.Save('128x128.png', [System.Drawing.Imaging.ImageFormat]::Png)

# Convert to ICO
$ico = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$fs = [System.IO.File]::OpenWrite('icon.ico')
$ico.Save($fs)
$fs.Close()

$g.Dispose()
$bmp.Dispose()
$ico.Dispose()
$font.Dispose()

Write-Host 'Created icon.ico'
