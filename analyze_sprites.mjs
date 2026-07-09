import { Jimp } from 'jimp';

async function analyzeSprites() {
  const image = await Jimp.read('public/road-rash/images/sprites.png');
  const width = image.bitmap.width;
  
  let regions = [];
  let currentRegion = null;

  // Scan row y=0 to y=50 (where player sprites are)
  for (let x = 0; x < width; x++) {
    let hasPixel = false;
    for (let y = 0; y < 50; y++) {
      const color = image.getPixelColor(x, y);
      const a = (color >> 24) & 255;
      // In jimp v1, getPixelColor returns a hex. If alpha > 0, the color > 0.
      if (a > 0) {
        hasPixel = true;
        break;
      }
    }
    
    if (hasPixel) {
      if (!currentRegion) {
        currentRegion = { startX: x, endX: x };
      } else {
        currentRegion.endX = x;
      }
    } else {
      if (currentRegion) {
        regions.push(currentRegion);
        currentRegion = null;
      }
    }
  }
  if (currentRegion) regions.push(currentRegion);

  console.log("Sprite regions found:");
  regions.forEach((r, i) => {
    console.log(`Sprite ${i}: x=${r.startX}, w=${r.endX - r.startX + 1}`);
  });
}

analyzeSprites().catch(console.error);
