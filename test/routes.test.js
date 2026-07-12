/* Route/integration tests — boots the real Express app (server.js) in-process on a random
   free port and hits it with real HTTP requests. No new test dependency: uses Node's built-in
   test runner + global fetch (Node 18+).

   Scope decision: AI-generation routes (/generate*, /detect-book, /assistant-chat, /upload-generate)
   are NOT exercised here — they call the real Anthropic API and would burn real credits on every
   test run/CI push. Those are validated through live/manual testing during feature work instead
   (see project history). Everything here is either DB-independent (routing, headers, static
   files, document export) or explicitly skipped when Supabase credentials aren't configured
   (CI has none) rather than faking a pass. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

/* server.js loads dotenv as a side effect of being required — must happen before we read
   process.env below, otherwise hasDb always evaluates false even when a real .env exists. */
const app = require('../server');
const hasDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

let server, base;

test.before(() => new Promise((resolve, reject) => {
  server = http.createServer(app);
  server.on('error', reject);
  server.listen(0, () => { base = `http://localhost:${server.address().port}`; resolve(); });
}));

test.after(() => new Promise((resolve) => server.close(resolve)));

/* ─── Static pages / direct URL opening / refresh ───────────────────────────
   This app has no client-side router — every "page" is a real static file served
   by Express, so hitting it directly over HTTP *is* the "open directly" / "refresh"
   test; there's no separate SPA-fallback class of bug to reproduce here. */
test('homepage: GET / returns 200 html', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
});

test('admin panel: GET /admin.html returns 200 html and is not indexable', async () => {
  const r = await fetch(base + '/admin.html');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /noindex/);
});

test('invalid URL: unknown route returns real 404 status with the custom 404 page', async () => {
  const r = await fetch(base + '/this-route-does-not-exist-xyz');
  assert.equal(r.status, 404);
  assert.match(r.headers.get('content-type'), /text\/html/);
});

test('static assets: manifest, favicon, sitemap, robots all resolve', async () => {
  const manifest = await fetch(base + '/manifest.json');
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get('content-type'), /json/);

  const favicon = await fetch(base + '/favicon.ico');
  assert.equal(favicon.status, 200);
  assert.match(favicon.headers.get('content-type'), /image/);

  const sitemap = await fetch(base + '/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type'), /xml/);

  const robots = await fetch(base + '/robots.txt');
  assert.equal(robots.status, 200);
});

/* Regression test for a real bug: canonical/OG/structured-data/sitemap URLs must all agree with
   the actual final-serving host (www) — apex 301s to www, so a canonical pointing at apex is a
   self-contradicting signal to search engines and can suppress indexing. */
test('SEO: sitemap URLs use the canonical www host, not the redirecting apex host', async () => {
  const r = await fetch(base + '/sitemap.xml');
  const xml = await r.text();
  assert.match(xml, /https:\/\/www\.teachertoolkitsindh\.com\//);
  assert.doesNotMatch(xml, /<loc>https:\/\/teachertoolkitsindh\.com\//);
});

test('SEO: homepage canonical/OG tags use the www host consistently', async () => {
  const r = await fetch(base + '/');
  const html = await r.text();
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.teachertoolkitsindh\.com\/">/);
  assert.match(html, /og:url" content="https:\/\/www\.teachertoolkitsindh\.com\/"/);
});

/* Regression test for a real bug: the service worker's fetch handler used to cache ANY network
   response including error pages, so a transient 404/500 could get stuck and resurface on every
   later network hiccup, indefinitely, even after the live server was fixed. Also guards that the
   sw.js file itself is never HTTP-cached, so browsers pick up the fixed version promptly. */
test('PWA: sw.js is served with no-store so browsers never get stuck on an old copy', async () => {
  const r = await fetch(base + '/sw.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('PWA: service worker never caches error responses (only res.ok is cached)', async () => {
  const r = await fetch(base + '/sw.js');
  const js = await r.text();
  assert.match(js, /if\s*\(res\.ok\)\s*\{\s*const copy/, 'app-shell fetch handler must guard cache writes with res.ok');
});

/* ─── Security headers ─────────────────────────────────────────────────── */
test('security headers are present on every response', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.ok(r.headers.get('referrer-policy'));
  assert.equal(r.headers.get('x-powered-by'), null);
});

/* ─── API health ──────────────────────────────────────────────────────── */
test('API health: /config and /version respond 200', async () => {
  const cfg = await fetch(base + '/config');
  assert.equal(cfg.status, 200);
  const ver = await fetch(base + '/version');
  assert.equal(ver.status, 200);
});

/* ─── Admin access is protected ──────────────────────────────────────── */
test('admin API rejects requests with no admin key', async () => {
  const r = await fetch(base + '/admin/users');
  assert.equal(r.status, 403);
});

test('admin API rejects a wrong admin key', async () => {
  const r = await fetch(base + '/admin/users', { headers: { 'x-admin-key': 'definitely-wrong' } });
  assert.equal(r.status, 403);
});

/* ─── Book Bank auth gate (regression test for the scraping hole that was fixed) ── */
test('Book Bank: /books requires login — anonymous request is rejected', async () => {
  const r = await fetch(base + '/books');
  assert.equal(r.status, 401);
});

test('Book Bank: /books rejects a bogus session token', async () => {
  const r = await fetch(base + '/books', { headers: { 'X-Auth-Token': 'not-a-real-token' } });
  assert.equal(r.status, 401);
});

/* ─── File export (docx/pdf/excel) — no AI, no DB, safe to run every time ── */
test('file export: download-docx generates a real file with a sanitized filename', async () => {
  const r = await fetch(base + '/download-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '# Test\nHello world', fileName: 'test"quote' })
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /filename="testquote\.docx"/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 0);
});

test('file export: download-pdf generates printable HTML', async () => {
  const r = await fetch(base + '/download-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '# Test\nHello world', fileName: 'test' })
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
});

test('file export: download-excel neutralizes CSV formula injection', async () => {
  const r = await fetch(base + '/download-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      students: [{ grNumber: '1', name: '=cmd|calc', fatherName: '@SUM(1+1)', className: 'Class 1' }],
      fileName: 'test'
    })
  });
  assert.equal(r.status, 200);
  const csv = await r.text();
  assert.ok(!/[^'"]=cmd\|calc/.test(csv), 'a raw formula must not appear unescaped in the export');
  assert.match(csv, /'=cmd\|calc/);
  assert.match(csv, /'@SUM\(1\+1\)/);
});

/* ─── Auth round trip — only runs where real Supabase credentials are configured.
   CI has none, so this is skipped there rather than faking a pass; it runs locally
   against the real dev database and cleans up the test account afterward. ── */
test('auth: register then use the session token on a protected route', { skip: !hasDb }, async () => {
  const phone = '0300' + Math.floor(1000000 + Math.random() * 8999999);
  const reg = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name: 'Route Test', school: 'Test School', pin: '1234' })
  });
  const regBody = await reg.json();
  try {
    assert.equal(regBody.success, true);
    assert.ok(regBody.token);

    const wallet = await fetch(base + '/wallet', { headers: { 'X-Auth-Token': regBody.token } });
    assert.equal(wallet.status, 200);

    const books = await fetch(base + '/books', { headers: { 'X-Auth-Token': regBody.token } });
    assert.equal(books.status, 200);
  } finally {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    await sb.from('tt_users').delete().eq('phone', regBody.user ? regBody.user.phone : '');
  }
});
