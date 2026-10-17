import http from 'node:http';
const allowedOrigin = 'https://app.example.test';
const methods = new Set(['GET', 'POST']);
const headers = new Set(['content-type', 'x-csrf-token']);
export function handler(req, res) {
  // This standalone example owns Vary; a framework middleware must merge prior Vary values.
  res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== allowedOrigin) {
    res.writeHead(403); res.end('origin denied'); return;
  }
  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS' && origin && req.headers['access-control-request-method']) {
    const method = req.headers['access-control-request-method'];
    const requested = (req.headers['access-control-request-headers'] || '')
      .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!methods.has(method) || requested.some(x => !headers.has(x))) {
      res.writeHead(403); res.end('preflight denied'); return;
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Max-Age', '300');
    res.writeHead(204); res.end(); return;
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS'); res.writeHead(204); res.end(); return;
  }
  if (!methods.has(req.method)) { res.writeHead(405, {Allow: 'GET, POST, OPTIONS'}); res.end(); return; }
  // Insert real authentication, per-resource authorization, CSRF and body-size controls here.
  // Fixed public demo response only; there is no user session or state mutation in this example.
  req.resume();
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({demo: true}));
}
export const createDemoServer = () => http.createServer(handler);
