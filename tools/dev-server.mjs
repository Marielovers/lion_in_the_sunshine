/** Small dependency-free dev server. node >=18; no Python or global Vite. */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wav': 'audio/wav',
  '.moc3': 'application/octet-stream', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end('Method not allowed');return; }
  try {
    const u = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(u.pathname);
    // Do not expose project setup sources, node_modules or dot-files via HTTP.
    if (p === '/') p = '/index.html';
    if (p.split('/').some(seg=>seg.startsWith('.') || seg === 'node_modules' || seg === 'tools' || seg === 'tests') || p.includes('\\')) {
      res.writeHead(403);res.end('Forbidden');return;
    }
    const full = path.resolve(ROOT, '.' + p);
    if (!full.startsWith(ROOT + path.sep)) { res.writeHead(403);res.end('Forbidden');return; }
    await access(full);
    const meta = await stat(full);
    if (!meta.isFile()) { res.writeHead(404);res.end('Not found');return; }
    const physical = await realpath(full);
    if (!physical.startsWith(ROOT + path.sep)) { res.writeHead(403);res.end('Forbidden');return; }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200,{
      'Content-Type':mime[ext] || 'application/octet-stream',
      'Content-Length':meta.size,
      'Cache-Control':'no-cache',
      'X-Content-Type-Options':'nosniff',
    });
    if (req.method==='HEAD') {res.end();return;}
    createReadStream(full).pipe(res);
  } catch(error) {res.writeHead(error.code==='ENOENT'?404:500);res.end(error.code==='ENOENT'?'Not found':'Server error');}
});
server.listen(PORT, HOST, () => {
  console.log(`\n 햇리온 Live2D 게임 실행 중: http://${HOST}:${PORT}`);
  console.log(' 종료하려면 Ctrl+C 를 누르세요.\n');
});
