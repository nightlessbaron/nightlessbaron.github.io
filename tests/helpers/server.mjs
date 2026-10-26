// Minimal static server that resolves paths the way GitHub Pages does:
// /x/ -> /x/index.html, /x -> /x.html (when it exists), otherwise 404.html with status 404.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.zip': 'application/zip', '.m': 'text/plain',
};

function resolve(root, urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const abs = path.join(root, rel);
  if (!abs.startsWith(root)) return null;
  const isFile = p => fs.existsSync(p) && fs.statSync(p).isFile();
  if (rel.endsWith('/')) return isFile(path.join(abs, 'index.html')) ? path.join(abs, 'index.html') : null;
  if (isFile(abs)) return abs;
  if (isFile(abs + '.html')) return abs + '.html';
  return null;
}

export function startServer(root) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    const file = resolve(root, req.url);
    if (!file) {
      const nf = path.join(root, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
    }
    const data = fs.readFileSync(file);
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    // Byte ranges so <video> can stream and seek.
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : data.length - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return res.end(data.subarray(start, end + 1));
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length, 'Accept-Ranges': 'bytes' });
    res.end(data);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(done => { server.closeAllConnections?.(); server.close(() => done()); }),
  })));
}
