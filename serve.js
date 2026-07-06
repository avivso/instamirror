// InstaMirror local server: static site + Claude Code bridge.
// Run `node serve.js` (or double-click InstaMirror.command), open http://localhost:8788
// POST /api/claude runs `claude -p` with your own Claude subscription via Claude Code.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = process.env.PORT || 8788;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function handleClaude(req, res) {
  let body = '';
  req.on('data', c => { body += c; if (body.length > 80e6) req.destroy(); });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body); } catch {
      res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
      res.end('{"error":"bad json"}');
      return;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'instamirror-'));
    const imgPaths = [];
    for (const [i, b64] of (payload.images || []).slice(0, 16).entries()) {
      const p = path.join(dir, 'post_' + (i + 1) + '.jpg');
      try { fs.writeFileSync(p, Buffer.from(b64, 'base64')); imgPaths.push(p); } catch {}
    }
    let prompt = (payload.system || '') + '\n\n---\n\n' + (payload.text || '');
    if (imgPaths.length) {
      prompt += '\n\nהתמונות מהפיד שלי שמורות בקבצים האלה. קרא כל אחת מהן ונתח אותן כחלק מהניתוח:\n' + imgPaths.join('\n');
    }
    const args = ['-p', '--output-format', 'text'];
    if (imgPaths.length) args.push('--allowedTools', 'Read');
    const child = spawn('claude', args, { env: process.env });
    const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
    child.stdin.on('error', () => {});
    child.stdin.write(prompt);
    child.stdin.end();
    let errOut = '';
    child.stdout.on('data', d => res.write(d));
    child.stderr.on('data', d => { errOut += d; });
    const killer = setTimeout(() => child.kill('SIGKILL'), 10 * 60 * 1000);
    child.on('error', e => {
      clearTimeout(killer);
      res.write('\n[CLAUDE_BRIDGE_ERROR] ' + (e.code === 'ENOENT'
        ? 'הפקודה claude לא נמצאה. מתקינים את Claude Code מ-https://claude.com/claude-code ומתחברים עם המנוי.'
        : e.message));
      res.end();
      cleanup();
    });
    child.on('close', code => {
      clearTimeout(killer);
      if (code !== 0 && errOut) res.write('\n[CLAUDE_BRIDGE_ERROR] ' + errOut.slice(0, 600));
      res.end();
      cleanup();
    });
  });
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (urlPath === '/api/claude/ping') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/claude') { handleClaude(req, res); return; }

  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403, CORS); res.end(); return; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, CORS); res.end('not found'); return; }
    res.writeHead(200, { ...CORS, 'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`InstaMirror running at http://localhost:${PORT} (Claude bridge ready)`));
