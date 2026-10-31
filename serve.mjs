// Local preview: builds the app into docs/ and serves that folder. Edits under
// src/ rebuild the app and reload any open preview.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('docs');
const PORT = Number(process.env.PORT) || 8000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
// Added to the page as it's served, never written into docs/.
const RELOAD = `<script>new EventSource('/__reload').onmessage = () => location.reload();</script>`;

const listeners = new Set();
const build = () => new Promise((resolve) => {
  const child = spawn(process.execPath, ['build.mjs'], { stdio: 'inherit' });
  child.on('exit', (code) => resolve(code === 0));
});

// One build at a time; changes made during a build trigger one more afterwards.
let building = false, again = false;
const rebuild = async () => {
  if (building) { again = true; return; }
  building = true;
  do {
    again = false;
    if (await build()) for (const res of listeners) res.write('data: reload\n\n');
  } while (again);
  building = false;
};

await build();

let timer;
fs.watch('src', { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 100); });

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    if (type !== 'text/html') { res.end(body); return; }
    const html = body.toString(), at = html.lastIndexOf('</body>');
    res.end(html.slice(0, at) + RELOAD + html.slice(at));
  });
}).listen(PORT, () => console.log(`note to self running at http://localhost:${PORT}/`));
