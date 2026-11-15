import { createReadStream, existsSync, statSync, cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const dataRoot = resolve(repoRoot, 'data');
const distRoot = resolve(here, 'dist');

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

function readDataVersion(): string {
  try {
    const raw = readFileSync(join(dataRoot, 'calendar.json'), 'utf8');
    const parsed = JSON.parse(raw) as { updatedAt?: unknown };
    return typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';
  } catch {
    return '';
  }
}

function dataPlugin(): Plugin {
  return {
    name: 'photo-calendar-data',
    config() {
      return {
        define: {
          __CALENDAR_VERSION__: JSON.stringify(readDataVersion()),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const rawUrl = req.url ?? '';
        const pathname = decodeURIComponent(rawUrl.split('?')[0] ?? '');
        if (!pathname.startsWith('/data/')) {
          next();
          return;
        }
        const relative = pathname.slice('/data/'.length);
        const target = resolve(dataRoot, relative);
        if (target !== dataRoot && !target.startsWith(dataRoot + sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!existsSync(target) || !statSync(target).isFile()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
        res.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(target).pipe(res);
      });
    },
    closeBundle() {
      if (!existsSync(dataRoot)) return;
      mkdirSync(distRoot, { recursive: true });
      cpSync(dataRoot, resolve(distRoot, 'data'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [dataPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        month: resolve(here, 'index.html'),
        day: resolve(here, 'day.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
