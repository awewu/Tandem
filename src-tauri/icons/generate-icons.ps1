# 生成 Tauri 所需的各种尺寸图标
# 需要 ImageMagick 或手动创建

$source = "icon.svg"
$sizes = @(32, 128, 256)

# PNG icons
foreach ($size in $sizes) {
    $name = if ($size -eq 256) { "128x128@2x.png" } else { "${size}x${size}.png" }
    Write-Host "Generating $name..."
    # 这里使用 PowerShell 绘图创建占位图标
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(79, 70, 229))
    
    # 绘制文字
    $fontSize = if ($size -eq 32) { 14 } elseif ($size -eq 128) { 60 } else { 120 }
    $font = New-Object System.Drawing.Font("Microsoft YaHei", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::White
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("铁", $font, $brush, $size/2, $size/2, $format)
    
    $bmp.Save("$PSScriptRoot\$name", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $font.Dispose()
    Write-Host "Created $name"
}

# ICO file (Windows)
Write-Host "Generating icon.ico..."
Add-Type -AssemblyName System.Drawing
$icon = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($icon)
$g.Clear([System.Drawing.Color]::FromArgb(79, 70, 229))
$font = New-Object System.Drawing.Font("Microsoft YaHei", 120, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::White
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("铁", $font, $brush, 128, 128, $format)
$icon.Save("$PSScriptRoot\icon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)
$g.Dispose()
$icon.Dispose()
$font.Dispose()
Write-Host "Created icon.ico"

Write-Host "Done!"
