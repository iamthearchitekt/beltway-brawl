import { imageSize } from 'image-size';
import fs from 'fs';

fs.readdirSync('player-sprite').forEach(f => {
  if (f.endsWith('.png')) {
    const d = imageSize('player-sprite/' + f);
    console.log(f + ': ' + d.width + 'x' + d.height);
  }
});
