import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve(import.meta.dirname);
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.json':'application/json; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let file;
  try { file = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; } catch { response.writeHead(400).end(); return; }
  const path = resolve(root, file);
  if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Linkbook running at http://localhost:${port}`));
