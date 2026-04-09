import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = 'assets/album';
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const files = readdirSync(dir)
  .filter(f => exts.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const manifest = files.map(f => `${dir}/${f}`);
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`manifest.json written with ${manifest.length} images:`, manifest);
