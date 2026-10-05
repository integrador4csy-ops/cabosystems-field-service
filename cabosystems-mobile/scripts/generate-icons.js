const sharp = require('../node_modules/sharp');
const path = require('path');
const fs = require('fs');

async function run() {
  const imagesDir = path.join(__dirname, '../assets/images');
  const sourceImage = 'C:/Users/integ/.gemini/antigravity/brain/9ee391d8-a92c-486d-ae9c-b126f82cfa52/.user_uploaded/media_1791221284015.png';

  console.log('Reading source image from:', sourceImage);
  const img = sharp(sourceImage);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  // 1. Generate notification-icon.png (96x96 px, pure monochrome white mask on transparent background)
  // Distance from white determines alpha:
  // - Background (#ffffff) -> alpha = 0 (transparent)
  // - Dark circle ring (#343e48) and orange sector (#f78c26) -> alpha = 255 (white)
  // - Edge anti-aliasing -> smooth alpha transition
  const maskData = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const srcIdx = i * 4;
    const r = data[srcIdx];
    const g = data[srcIdx + 1];
    const b = data[srcIdx + 2];

    const diff = Math.max(255 - r, 255 - g, 255 - b);
    let alpha = 0;
    if (diff > 12) {
      alpha = Math.min(255, Math.round((diff / 150) * 255));
    }

    maskData[srcIdx] = 255;
    maskData[srcIdx + 1] = 255;
    maskData[srcIdx + 2] = 255;
    maskData[srcIdx + 3] = alpha;
  }

  // Bounding box of the symbol in 1024x1024 is x: 234..789, y: 232..791 (width 556, height 560)
  // Extract with a small margin (x: 212, y: 210, 600x600) so the icon has ideal padding in 96x96
  const resizedBuffer = await sharp(maskData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: 212, top: 210, width: 600, height: 600 })
    .resize(96, 96, { fit: 'contain' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Enforce pure white on all RGB channels so no color fringing occurs
  for (let i = 0; i < 96 * 96; i++) {
    resizedBuffer.data[i * 4] = 255;
    resizedBuffer.data[i * 4 + 1] = 255;
    resizedBuffer.data[i * 4 + 2] = 255;
  }

  await sharp(resizedBuffer.data, { raw: { width: 96, height: 96, channels: 4 } })
    .png()
    .toFile(path.join(imagesDir, 'notification-icon.png'));
  console.log('✅ Created notification-icon.png (96x96, pure white on transparent)');

  // 2. Also update adaptive-icon.png (1024x1024) and icon.png (1024x1024) from the official source image
  await sharp(sourceImage)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(imagesDir, 'adaptive-icon.png'));
  console.log('✅ Updated adaptive-icon.png (1024x1024)');

  await sharp(sourceImage)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(imagesDir, 'icon.png'));
  console.log('✅ Updated icon.png (1024x1024)');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
