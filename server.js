/*
 * DishDash — minimal dependency-free static dev server.
 * Serves the app folder over HTTP so multi-page navigation, relative
 * assets and fetch() behave exactly like a deployed site.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// Some environments export PORT=0; fall back to a sane default.
const envPort = Number(process.env.PORT);
const PORT = Number.isInteger(envPort) && envPort > 0 ? envPort : 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    // NUBAN name-enquiry seam: real provider resolution when a secret key is
    // exported (PAYSTACK_SECRET_KEY), otherwise 501 -> client uses its demo
    // resolver. The key NEVER reaches the browser.
    if (urlPath === '/api/resolve-account' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 10000) req.destroy(); });
      req.on('end', () => {
        const KEY = process.env.PAYSTACK_SECRET_KEY || '';
        if (!KEY) {
          res.writeHead(501, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'No provider key configured' }));
          return;
        }
        let acc = '', bk = '';
        try { const q = JSON.parse(raw || '{}'); acc = String(q.account_number || ''); bk = String(q.bank_code || ''); }
        catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Bad JSON' })); return; }
        const preq = require('https').request({
          hostname: 'api.paystack.co',
          path: '/bank/resolve?account_number=' + encodeURIComponent(acc) + '&bank_code=' + encodeURIComponent(bk),
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + KEY }
        }, (pr) => {
          let pd = '';
          pr.on('data', (c) => { pd += c; });
          pr.on('end', () => { res.writeHead(pr.statusCode || 502, { 'Content-Type': 'application/json' }); res.end(pd); });
        });
        preq.on('error', () => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Provider unreachable' }));
        });
        preq.end();
      });
      return;
    }

    // Prevent path traversal outside ROOT
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(ROOT, safePath);

    // Directory request -> look for index.html
    let stat;
    try { stat = fs.statSync(filePath); } catch { stat = null; }

    if (!stat) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 — Not found');
      return;
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      try { stat = fs.statSync(filePath); } catch { stat = null; }
      if (!stat) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 — No index in directory');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    stream.pipe(res);
    stream.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 — Read error');
    });
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 — Bad request');
  }
});

server.listen(PORT, () => {
  console.log(`🍔 DishDash dev server running at http://localhost:${PORT}/`);
});
