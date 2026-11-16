// Operation Vortex local static development server (Node 22 standard library only)
// Serves game/ as static ES modules on http://localhost:8080 with strict security boundaries.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const portArg = process.argv.indexOf('--port');
const serverPort = portArg !== -1 && Number.parseInt(process.argv[portArg + 1], 10) ? Number.parseInt(process.argv[portArg + 1], 10) : 8080;

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

const server = createServer((req, res) => {
  const reqUrl = new URL(req.url ?? '/', 'http://localhost');
  let targetPath: string;
  try {
    targetPath = decodeURIComponent(reqUrl.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('Bad Request');
    return;
  }
  if (targetPath.endsWith('/')) targetPath += 'index.html';
  const resolvedFile = resolve(join(rootDir, normalize(targetPath)));

  if (!resolvedFile.startsWith(rootDir + sep) && resolvedFile !== rootDir) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('Access Denied');
    return;
  }

  try {
    const fileStats = statSync(resolvedFile);
    if (!fileStats.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not Found');
      return;
    }
    const contentType = MIME_MAP[extname(resolvedFile).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': contentType,
      'content-length': fileStats.size,
      'cache-control': 'no-cache, no-store, must-revalidate',
      'x-content-type-options': 'nosniff',
    });
    createReadStream(resolvedFile).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not Found');
  }
});

server.listen(serverPort, '127.0.0.1', () => {
  console.log(`[Operation Vortex] Tactical FPS running at http://localhost:${serverPort}`);
});
