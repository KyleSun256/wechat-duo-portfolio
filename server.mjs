import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.exr': 'application/octet-stream', '.json': 'application/json', '.lsd': 'application/json', '.avif': 'image/avif', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.webp': 'image/webp' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root) || !mime[path.extname(filename)]) {
      res.writeHead(404).end('Not found');
      return;
    }
    const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://localhost:${port}`));
