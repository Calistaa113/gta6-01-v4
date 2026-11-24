// Local play server for VISTAMAR (Node 22, standard library only).
//   node serve.ts            -> http://localhost:8080
//   node serve.ts --port 9000
// It serves game/ only, because browsers will not load ES module scripts from file:// URLs.
// The game itself never touches the network. Requests that escape game/ are refused.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const at = args.indexOf('--port');
const asked = at >= 0 ? Number(args[at + 1]) : 8080;
const port = Number.isInteger(asked) && asked > 0 && asked < 65536 ? asked : 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

/** Map a URL path onto a file inside game/, or null if it would leave game/. */
function resolveFile(pathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = resolve(join(root, normalize(p)));
  return file === root || file.startsWith(root + sep) ? file : null;
}

createServer((req, res) => {
  const file = resolveFile(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (!file) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`VISTAMAR is running on http://localhost:${port}`));
