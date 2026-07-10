const fs = require('fs');

fs.readdirSync('player-sprite').forEach(f => {
  if (f.endsWith('.png')) {
    const buffer = Buffer.alloc(24);
    const fd = fs.openSync('player-sprite/' + f, 'r');
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    console.log(f + ': ' + width + 'x' + height);
  }
});
