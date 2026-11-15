import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), 'dist');
const prefix = '/photo-calendar';
const port = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === prefix || pathname === `${prefix}/`) pathname = `${prefix}/index.html`;
  if (!pathname.startsWith(`${prefix}/`)) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  const relative = normalize(pathname.slice(prefix.length + 1));
  if (relative.startsWith('..') || relative.includes(`..${sep}`)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }
  const file = join(root, relative);
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  response.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`serving ${root} at http://127.0.0.1:${port}${prefix}/\n`);
});
