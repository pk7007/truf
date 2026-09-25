const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
}).listen(4173, '127.0.0.1', () => console.log('TRUF prototype: http://127.0.0.1:4173'));
