const fs = require('fs');
const path = require('path');

// 读取 PNG 文件
const pngBuffer = fs.readFileSync(path.join(__dirname, '128x128.png'));

// ICO 文件结构：
// 1. ICONDIR (6 bytes)
// 2. ICONDIRENTRY (16 bytes per image)
// 3. Image data

const width = 128;
const height = 128;
const colorPlanes = 1;
const bitsPerPixel = 32;
const imageSize = pngBuffer.length;
const imageOffset = 22; // 6 + 16

// 创建 ICONDIR
const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0); // Reserved
iconDir.writeUInt16LE(1, 2); // Type: ICO
iconDir.writeUInt16LE(1, 4); // Count: 1 image

// 创建 ICONDIRENTRY
const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(width === 256 ? 0 : width, 0); // Width
dirEntry.writeUInt8(height === 256 ? 0 : height, 1); // Height
dirEntry.writeUInt8(0, 2); // Colors (0 = >256)
dirEntry.writeUInt8(0, 3); // Reserved
dirEntry.writeUInt16LE(colorPlanes, 4); // Color planes
dirEntry.writeUInt16LE(bitsPerPixel, 6); // Bits per pixel
dirEntry.writeUInt32LE(imageSize, 8); // Image size
dirEntry.writeUInt32LE(imageOffset, 12); // Image offset

// 合并文件
const icoBuffer = Buffer.concat([iconDir, dirEntry, pngBuffer]);

fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoBuffer);
console.log('✓ Generated icon.ico (128x128)');
