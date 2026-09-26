import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swPath = path.join(__dirname, '../dist/sw.js');

if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  const timestamp = Date.now();
  // Replace the static cache name with a unique one per build
  swContent = swContent.replace(
    /const CACHE_NAME = 'hisab-khata-cache-[^']+';/,
    `const CACHE_NAME = 'hisab-khata-cache-v8-${timestamp}';`
  );
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`Successfully updated Service Worker cache name with timestamp: ${timestamp}`);
} else {
  console.error('Error: sw.js not found in dist folder!');
  process.exit(1);
}
