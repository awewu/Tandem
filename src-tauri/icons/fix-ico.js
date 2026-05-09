const fs = require('fs');
const path = require('path');

// 创建一个简单的 BMP 格式的 ICO（Windows 原生支持）
// ICO 文件结构：ICONDIR + ICONDIRENTRY + BITMAPINFOHEADER + ColorData + XOR Mask + AND Mask

function createIcon(width, height) {
    const bpp = 32; // 32-bit color
    const xorMaskSize = width * height * 4;
    const andMaskSize = width * height / 8;
    
    // BITMAPINFOHEADER (40 bytes)
    const bmiHeader = Buffer.alloc(40);
    bmiHeader.writeUInt32LE(40, 0);        // biSize
    bmiHeader.writeInt32LE(width, 4);     // biWidth
    bmiHeader.writeInt32LE(height * 2, 8); // biHeight (XOR + AND masks)
    bmiHeader.writeUInt16LE(1, 12);       // biPlanes
    bmiHeader.writeUInt16LE(bpp, 14);     // biBitCount
    bmiHeader.writeUInt32LE(0, 16);       // biCompression (BI_RGB)
    bmiHeader.writeUInt32LE(0, 20);       // biSizeImage
    bmiHeader.writeInt32LE(0, 24);        // biXPelsPerMeter
    bmiHeader.writeInt32LE(0, 28);        // biYPelsPerMeter
    bmiHeader.writeUInt32LE(0, 32);       // biClrUsed
    bmiHeader.writeUInt32LE(0, 36);       // biClrImportant
    
    // Create color data (simple gradient + text placeholder)
    const xorMask = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = ((height - 1 - y) * width + x) * 4;
            // Blue background (BGRA format)
            xorMask[idx] = 202;     // B (blue)
            xorMask[idx + 1] = 70;  // G (green)
            xorMask[idx + 2] = 79;  // R (red)
            xorMask[idx + 3] = 255; // A (alpha)
        }
    }
    
    // AND mask (fully transparent since we use 32bpp)
    const andMask = Buffer.alloc(andMaskSize);
    andMask.fill(0);
    
    return Buffer.concat([bmiHeader, xorMask, andMask]);
}

function createICO() {
    const sizes = [16, 32, 48, 128, 256];
    const images = [];
    let offset = 6 + (sizes.length * 16); // ICONDIR + entries
    
    // Create each image
    for (const size of sizes) {
        const data = createIcon(size, size);
        images.push({
            width: size,
            height: size,
            size: data.length,
            offset: offset,
            data: data
        });
        offset += data.length;
    }
    
    // ICONDIR (6 bytes)
    const icondir = Buffer.alloc(6);
    icondir.writeUInt16LE(0, 0); // Reserved
    icondir.writeUInt16LE(1, 2); // Type (1 = ICO)
    icondir.writeUInt16LE(images.length, 4); // Count
    
    // ICONDIRENTRY for each image (16 bytes each)
    const entries = [];
    for (const img of images) {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(img.width === 256 ? 0 : img.width, 0); // Width
        entry.writeUInt8(img.height === 256 ? 0 : img.height, 1); // Height
        entry.writeUInt8(0, 2); // Colors (0 = >256)
        entry.writeUInt8(0, 3); // Reserved
        entry.writeUInt16LE(1, 4); // Color planes
        entry.writeUInt16LE(32, 6); // Bits per pixel
        entry.writeUInt32LE(img.size, 8); // Size of image data
        entry.writeUInt32LE(img.offset, 12); // Offset to image data
        entries.push(entry);
    }
    
    // Combine all parts
    const parts = [icondir, ...entries, ...images.map(i => i.data)];
    const icoBuffer = Buffer.concat(parts);
    
    fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoBuffer);
    console.log(`✓ Created icon.ico with ${sizes.length} sizes`);
}

createICO();
