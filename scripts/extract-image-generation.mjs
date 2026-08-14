import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [sessionPath, outputPath] = process.argv.slice(2);

if (!sessionPath || !outputPath) {
  throw new Error('Usage: node scripts/extract-image-generation.mjs <session.jsonl> <output.png>');
}

const lines = (await readFile(sessionPath, 'utf8')).trim().split(/\r?\n/).reverse();
let encoded;

for (const line of lines) {
  const item = JSON.parse(line);
  if (item.payload?.type !== 'image_generation_call') continue;
  const result = item.payload?.result;
  if (typeof result !== 'string') continue;
  const match = result.match(/^(?:data:image\/png;base64,)?([A-Za-z0-9+/=]+)$/);
  if (match) {
    encoded = match[1];
    break;
  }
}

if (!encoded) throw new Error('No generated PNG data URL found in session record.');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(encoded, 'base64'));
