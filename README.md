# Teacher Toolkit

AI-powered document generator for Sindh government school teachers — lesson plans, CRQ papers,
certificates, official letters, and more, in English/Urdu/Sindhi/Roman Urdu. Live at
[teachertoolkitsindh.com](https://teachertoolkitsindh.com).

## Architecture

Plain Node.js/Express monolith — **not** a React/Next.js SPA. There is no client-side router:
`public/index.html` (teacher-facing app) and `public/admin.html` (admin panel) are two real,
independently-served static pages, each a self-contained HTML file with inline CSS/JS. Express
serves them via `express.static('public')`; a catch-all handler at the bottom of `server.js`
returns a real HTTP 404 + `public/404.html` for anything else.

- **Backend**: `server.js` (routes, AI calls, PDF/DOCX generation) + `lib/*.js` (pure, tested
  logic extracted out: rate limiting, phone/PIN handling, pricing, payments, logging)
- **Database**: Supabase Postgres — schema documented in `db/schema.sql`
- **File storage**: Supabase Storage (`books` bucket) — Book Bank PDFs upload directly
  browser→Supabase via signed URLs, bypassing the app server entirely for large files
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`), model centralized as `MODEL` in `server.js`
- **PWA**: `public/sw.js` — network-first service worker (app shell only; API routes are never
  cached)

## Run locally

```bash
npm install
cp .env.example .env   # then fill in real values, see below
npm start               # http://localhost:3000
```

`npm run dev` is identical to `npm start` — there's no separate build/watch step since this is
plain JS served directly, no bundler.

## Environment variables

See `.env.example` for the full list with descriptions. Required for the app to do anything
useful:

| Variable | Required for |
|---|---|
| `ANTHROPIC_API_KEY` | All AI generation routes (`/generate*`, `/detect-book`, `/assistant-chat`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Login, credits, Book Bank, saved documents — without these the app still boots but falls back to empty/degraded responses on DB-backed routes |
| `ADMIN_PASSWORD` | Every `/admin/*` route and the admin panel login |
| `EASYPAISA_NUMBER`, `EASYPAISA_NAME`, `WHATSAPP_NUMBER` | Displayed on the pricing screen |

`SUPABASE_SERVICE_KEY` is the **service role** key (Settings → API in the Supabase dashboard),
not the anon/public key — it bypasses row-level security and must never reach the browser.

## Build

There's no bundler/transpiler — "build" is a syntax check:

```bash
npm run build   # node -c server.js
```

## Lint & test

```bash
npm run lint    # eslint . — flags real bugs (undefined vars, dupes, unreachable code), not style
npm test        # node --test — unit tests (lib/) + route/integration tests (test/routes.test.js)
```

`test/routes.test.js` boots the real Express app in-process on a random free port and hits it
with real HTTP requests — homepage, admin panel, 404 handling, security headers, the Book Bank
auth gate, file export (docx/pdf/excel), CSV-injection guard. AI-generation routes are
intentionally **not** exercised here (they'd call the real Anthropic API and cost real money on
every test run) — those are validated through live testing during feature work instead. The one
test that touches the real database (full register→login→wallet round trip) auto-skips when
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` aren't set (e.g. in CI, which has no secrets configured) and
cleans up its own test account when it does run.

CI (`.github/workflows/ci.yml`) runs build, lint, and test on every push/PR to `main`.

## Deploy (Render)

The app is deployed on [Render](https://render.com) as a Web Service, auto-deploying from
pushes to `main` on GitHub.

- **Build command**: `npm install`
- **Start command**: `npm start`
- **Environment variables**: set every variable from `.env.example` in the Render dashboard
  (Environment tab) — `.env` is gitignored and never deployed, so these must be set there
  directly. Missing `SUPABASE_URL`/`ADMIN_PASSWORD`/etc. here (not a code bug) is the single most
  common cause of "it works locally but not in production."
- **Custom domain**: `teachertoolkitsindh.com` → Render, with `www` as the canonical host.
  HTTPS + the `www`↔apex redirect are enforced in `server.js` (see the middleware right after
  `app.set('trust proxy', 1)`) since Render's own redirect and the app's redirect fighting each
  other previously caused a redirect loop — don't add another www/https redirect at the infra
  level without checking this middleware first.

To deploy: push to `main`. Render polls GitHub and redeploys automatically — no manual step.

## Rolling back a faulty deployment

Render keeps prior deploys. Fastest path: Render dashboard → the service → **Deploys** tab →
find the last known-good deploy → **Rollback**. This reverts the *running* deployment
immediately without touching git history.

To roll back the actual code too (so the next push doesn't redeploy the bad version):

```bash
git revert <bad-commit-sha>   # creates a new commit undoing the change — safe, keeps history
git push
```

Avoid `git reset --hard` + force-push on `main` — it rewrites shared history and Render will
just redeploy whatever `main` points to next, so a revert commit is the safer default.

## Accessing the admin panel

`https://teachertoolkitsindh.com/admin.html` → enter `ADMIN_PASSWORD`. The admin panel is
`noindex` (won't appear in search results) but is **not** hidden behind a secret URL — anyone who
finds the URL sees a password prompt, and every `/admin/*` API route independently checks the
`x-admin-key` header server-side (constant-time comparison, with a 10-failed-attempts/10-min
lockout per IP). From there you can:

- Manage teacher credits/subscriptions (add, remove, cancel)
- View payment/usage reports
- Manage the Book Bank (upload, bulk-upload, delete)
- Manage the SLO (Student Learning Outcomes) bank

## Adding content

- **Book Bank**: Admin panel → Book Bank card. Single upload (pick Class/Subject/Title) or
  **Bulk Upload** (select a folder of PDFs — AI detects Class/Subject/Title per file
  automatically; anything it can't confidently match lands in a "Needs manual review" table with
  inline correction dropdowns). Books over the Supabase Storage per-file limit auto-compress, and
  if still too large, auto-split into sequential parts.
- **SLOs**: Admin panel → SLO Bank card — paste curriculum Student Learning Outcomes, one per
  line, tagged with Class/Subject.
- **Curriculum data** (which Subjects exist per Class): `public/shared-data.js` —
  `CLASS_LIST`/`CLASS_SUBJECTS`/`SEC_MAP`. Edit directly and redeploy; there's no admin UI for
  this since it changes rarely and errors here are easy to review in a diff.

## Diagnosing common errors

| Symptom | Likely cause | Check |
|---|---|---|
| Admin login works locally, fails in production | `ADMIN_PASSWORD` not set on Render | Render → Environment tab |
| Login/Book Bank broken only in production | `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` missing on Render | Same as above — the app boots without them but every DB-backed route degrades |
| "Failed to fetch" on a large Book Bank upload | Supabase Storage's per-file size ceiling (project-tier dependent, currently 50MB) | Should auto-compress/split; if it still fails, check the bucket's `file_size_limit` in Supabase Storage settings |
| A generation route returns "File exceeds the AI limit" | The uploaded file is too large for a single Claude request | Expected — use the Resizer tool / a smaller page range, not a bug to "fix" |
| Custom domain requests failing auth that work on `*.onrender.com` | The custom domain's edge proxy strips the standard `Authorization` header | Already handled: the app reads `X-Auth-Token` first, `Authorization` as fallback — if you add a new authenticated route, use `userFromReq()`, don't read `Authorization` directly |
| Redirect loop on the custom domain | An infra-level www/https redirect fighting the app's own redirect middleware | Don't add a second layer of www/https redirect — Render handles www↔apex, `server.js` handles https enforcement only |
| Stale JS/CSS after deploying | Service worker cache | `public/sw.js` is network-first for the app shell (only falls back to cache when genuinely offline) — hard refresh (Ctrl+Shift+R) rules this out if still seeing it |

Server-side errors are logged via `lib/logger.js`'s `logError()` (structured JSON to stdout,
visible in Render's log stream) rather than exposed to the client — API error responses are
deliberately generic (`{success:false, error:"..."}`) so internals never leak to a teacher's
browser.

## Project structure

```
server.js              — all routes, AI calls, PDF/DOCX generation (exports `app`; only
                          auto-listens when run directly, so tests can import it cleanly)
lib/                    — pure, unit-tested logic (rateLimit, phone, pin, pricing, logger,
                          payments, pageRange)
db/schema.sql           — documented Postgres schema, safe to re-run (IF NOT EXISTS everywhere)
public/
  index.html            — teacher-facing app (single page, all tools)
  admin.html            — admin panel (single page)
  shared-data.js         — Class/Subject curriculum data, shared by both pages
  sw.js                 — PWA service worker
  404.html              — custom 404 page
test/
  lib.test.js           — unit tests for lib/
  payments.test.js      — payment idempotency tests (mocked Supabase)
  routes.test.js        — route/integration tests (real HTTP against the real app)
```
