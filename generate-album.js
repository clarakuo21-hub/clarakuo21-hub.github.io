import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = 'assets/album';
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const files = readdirSync(dir)
  .filter(f => exts.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const manifest = files.map(f => `${dir}/${f}`);
const js = `window.ALBUM_IMAGES = ${JSON.stringify(manifest, null, 2)};\n`;
writeFileSync(join(dir, 'manifest.js'), js);
console.log(`manifest.js written with ${manifest.length} images:`, manifest);
