const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = Number(process.argv[2] || 5500);
const host = '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon'
};
http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.resolve(root, '.' + urlPath);
  
  if (!file.startsWith(root)) {
    console.log(`[Server] 403 Forbidden: ${req.method} ${req.url}`);
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('forbidden');
    return;
  }
  
  fs.readFile(file, (err, data) => {
    if (err) {
      console.log(`[Server] 404 Not Found: ${req.method} ${req.url}`);
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('not found');
      return;
    }
    const contentType = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
    console.log(`[Server] 200 OK: ${req.method} ${req.url} (${contentType}, ${data.length} bytes)`);
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
}).listen(port, host, () => console.log(`TC2026 web: http://${host}:${port}/`));
