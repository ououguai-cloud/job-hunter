/* ============================================================
   Terranova — dependency-free local static server

   ES modules require HTTP; file:// will not work.
   Run: node serve.mjs  →  http://127.0.0.1:8123
   ============================================================ */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the root with fileURLToPath(new URL('.', import.meta.url)),
// NOT .pathname — .pathname leaves spaces percent-encoded and every
// request 404s if the folder name contains a space.
const root = fileURLToPath(new URL('.', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = urlPath === '/' ? '/index.html' : urlPath;

    // Directory-traversal guard: normalize and require root prefix.
    const full = normalize(join(root, file));
    if (!full.startsWith(root)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }

    const data = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});

const port = Number(process.env.PORT) || 8123;
server.listen(port, '127.0.0.1', () => {
  console.log(`Terranova running at http://127.0.0.1:${port}`);
});
