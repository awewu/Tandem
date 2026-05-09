@echo off
echo Creating Tauri icons...

:: Use PowerShell to create a real ICO file with multiple sizes
cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -Command "
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO

# Create multiple size bitmaps
$sizes = @(32, 128, 256)
$bitmaps = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Fill with gradient background
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Rectangle]::FromLTRB(0, 0, $size, $size),
        [System.Drawing.Color]::FromArgb(79, 70, 229),
        [System.Drawing.Color]::FromArgb(67, 56, 202),
        45
    )
    $g.FillRectangle($brush, 0, 0, $size, $size)
    
    # Add text
    $fontSize = [int]($size * 0.4)
    $font = New-Object System.Drawing.Font('Microsoft YaHei', $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.DrawString('铁', $font, $textBrush, $size/2, $size/2, $format)
    
    # Save PNG
    $pngPath = \"$size.png\"
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host \"Created $pngPath\"
    
    $bitmaps += $bmp
    $g.Dispose()
    $font.Dispose()
}

# Create ICO file manually with proper format
$fs = [System.IO.File]::OpenWrite('icon.ico')
$writer = [System.IO.BinaryWriter]::new($fs)

# ICONDIR
$writer.Write([Int16]0)  # Reserved
$writer.Write([Int16]1)  # Type: ICO
$writer.Write([Int16]$bitmaps.Count)  # Count

# Calculate offsets
$headerSize = 6 + ($bitmaps.Count * 16)
$offset = $headerSize

# Write ICONDIRENTRY for each
$entries = @()
for ($i = 0; $i -lt $bitmaps.Count; $i++) {
    $size = $sizes[$i]
    $bmp = $bitmaps[$i]
    
    # Convert to bytes
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $data = $ms.ToArray()
    $ms.Close()
    
    $entry = @{
        Width = $size
        Height = $size
        Colors = 0
        Reserved = 0
        Planes = 1
        BitCount = 32
        SizeInBytes = $data.Length
        FileOffset = $offset
        Data = $data
    }
    $entries += $entry
    
    $offset += $data.Length
}

# Write entries
foreach ($entry in $entries) {
    $writer.Write([byte](if ($entry.Width -eq 256) { 0 } else { $entry.Width }))
    $writer.Write([byte](if ($entry.Height -eq 256) { 0 } else { $entry.Height }))
    $writer.Write([byte]$entry.Colors)
    $writer.Write([byte]$entry.Reserved)
    $writer.Write([Int16]$entry.Planes)
    $writer.Write([Int16]$entry.BitCount)
    $writer.Write([Int32]$entry.SizeInBytes)
    $writer.Write([Int32]$entry.FileOffset)
}

# Write image data
foreach ($entry in $entries) {
    $writer.Write($entry.Data)
}

$writer.Close()
$fs.Close()

# Cleanup bitmaps
foreach ($bmp in $bitmaps) {
    $bmp.Dispose()
}

Write-Host 'Created icon.ico with 3 sizes'
"

echo.
echo Done! Press any key to exit.
pause > nul
