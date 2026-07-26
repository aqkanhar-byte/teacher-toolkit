-- Teacher Toolkit — Supabase schema (retroactively documented, then version-controlled from here on)
-- Safe to re-run: every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Run new statements in the Supabase SQL Editor whenever this file changes.
--
-- AUTHORIZATION MODEL — READ BEFORE ADDING A NEW TABLE OR ROUTE.
-- server.js talks to Supabase exclusively with the SERVICE-ROLE key (see `createClient` in
-- server.js), which bypasses Postgres Row Level Security entirely. RLS policies on these tables
-- are therefore NOT the enforcement boundary, even if some exist in the Supabase dashboard —
-- authorization happens entirely in application code: every route resolves the caller via
-- userFromReq() (token -> tt_users row) and every query on user-owned data filters explicitly
-- with .eq('user_id', user.id) (see /documents, /documents/:id, /documents/delete, /wallet,
-- /students-sync in server.js for the pattern). Verified consistent across those routes as of
-- 2026-07-19. If you add a new table holding per-teacher data, the .eq('user_id', ...) filter on
-- every read/write is what actually protects it — an RLS policy alone would do nothing here
-- since the server never authenticates to Postgres as the end user.

-- ═══════════════ tt_users — teacher accounts ═══════════════
CREATE TABLE IF NOT EXISTS tt_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text NOT NULL,
  school text DEFAULT '',
  pin_hash text NOT NULL,
  token text,
  credits integer NOT NULL DEFAULT 1,
  plan text,
  plan_quota integer NOT NULL DEFAULT 0, -- live DB has NOT NULL here; use 0 (not null) to mean "no quota"
  plan_used integer DEFAULT 0,
  plan_expires timestamptz,
  referred_by text,
  referral_rewarded boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Session expiry (added for the security audit — sessions now expire 30 days after last use)
ALTER TABLE tt_users ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Every authenticated request looks up by token; login/referral lookups use phone —
-- both need an index or every request becomes a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_tt_users_token ON tt_users(token);
CREATE INDEX IF NOT EXISTS idx_tt_users_phone ON tt_users(phone);

-- ═══════════════ tt_transactions — permanent payment/credit ledger ═══════════════
CREATE TABLE IF NOT EXISTS tt_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES tt_users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 0,
  amount_rs integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_transactions_user ON tt_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tt_transactions_created ON tt_transactions(created_at);

-- ═══════════════ tt_documents — saved AI-generated documents ("My Documents") ═══════════════
CREATE TABLE IF NOT EXISTS tt_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES tt_users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_documents_user ON tt_documents(user_id);

-- ═══════════════ tt_students — per-teacher student database (JSON blob, synced from localStorage) ═══════════════
CREATE TABLE IF NOT EXISTS tt_students (
  user_id uuid PRIMARY KEY REFERENCES tt_users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════ tt_books — Book Bank (curated STB textbooks) ═══════════════
CREATE TABLE IF NOT EXISTS tt_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  subject text NOT NULL,
  title text NOT NULL,
  unit_label text,
  storage_path text NOT NULL,
  size_mb numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_books_class_subject ON tt_books(class_name, subject);
-- Supabase Storage's free-tier quota (1GB) fills up fast with real textbook PDFs — this lets an
-- admin import books from a Google Drive folder instead. storage_path holds either the Supabase
-- storage path (provider='supabase', default) or the Drive file ID (provider='drive').
ALTER TABLE tt_books ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase';
-- Public SEO library (/library/:slug) — every book gets a stable, human-readable URL slug so it
-- can be individually indexed by Google, separate from the login-gated in-app Book Bank selector.
ALTER TABLE tt_books ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tt_books_slug ON tt_books(slug) WHERE slug IS NOT NULL;

-- ═══════════════ tt_slos — official curriculum Student Learning Outcomes ═══════════════
CREATE TABLE IF NOT EXISTS tt_slos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  subject text NOT NULL,
  unit_no integer,
  unit_name text,
  slo_code text,
  slo_text text NOT NULL,
  bloom_level text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_slos_class_subject ON tt_slos(class_name, subject);

-- ═══════════════ tt_settings — small generic key/value store (dashboard reset baseline, etc.) ═══════════════
CREATE TABLE IF NOT EXISTS tt_settings (
  key text PRIMARY KEY,
  value text
);

-- ═══════════════ PAYMENT SYSTEM (gateway-agnostic — no real gateway wired in yet) ═══════════════
-- tt_transactions becomes the single source of truth for both manual (current) and future
-- gateway-driven payments. New columns are all nullable/defaulted so existing manual entries
-- and existing code paths are completely unaffected.
ALTER TABLE tt_transactions ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'manual';
ALTER TABLE tt_transactions ADD COLUMN IF NOT EXISTS gateway_transaction_id text;
ALTER TABLE tt_transactions ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE tt_transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE tt_transactions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PKR';
ALTER TABLE tt_transactions ADD COLUMN IF NOT EXISTS metadata jsonb;
-- Idempotency: the same gateway can never be double-processed for the same transaction id.
-- Manual entries have a null gateway_transaction_id by default, so this only enforces uniqueness
-- once a real gateway (or an admin-supplied order reference) starts populating the column.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tt_transactions_gateway_txn ON tt_transactions(gateway, gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

-- Subscription lifecycle fields on tt_users (extends the existing plan/plan_quota/plan_used/plan_expires,
-- doesn't replace them) — ready for renew/cancel/upgrade/downgrade/grace-period logic once a gateway
-- can actually notify this app of recurring billing events.
ALTER TABLE tt_users ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none'; -- none|active|cancelled|expired|past_due
ALTER TABLE tt_users ADD COLUMN IF NOT EXISTS billing_cycle text; -- monthly|yearly
ALTER TABLE tt_users ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;
ALTER TABLE tt_users ADD COLUMN IF NOT EXISTS gateway_subscription_id text;

-- Permanent, tamper-evident audit log of every webhook this app ever receives from any payment
-- gateway — logged BEFORE signature verification/processing, so even rejected/forged webhook
-- attempts are visible for security review, not just successfully-processed ones.
CREATE TABLE IF NOT EXISTS tt_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  signature_valid boolean,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_webhook_events_gateway ON tt_webhook_events(gateway, created_at);

-- ═══════════════ tt_admin_actions — audit trail for every sensitive admin action ═══════════════
-- The admin panel currently authenticates with a single shared password (no per-admin accounts
-- yet), so this can't attribute an action to a specific person — but it still answers "what
-- happened, to which teacher, when, from where" after the fact, which is the part that matters
-- most for catching a mistake or an abuse of the panel. Extending this to named admins later is
-- just adding an admin_name value at the call site — the table shape doesn't need to change.
CREATE TABLE IF NOT EXISTS tt_admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, -- e.g. 'add-credits', 'remove-credits', 'add-subscription', 'cancel-subscription', 'reset-pin', 'delete-book'
  target_phone text, -- the affected teacher, when applicable
  detail jsonb, -- action-specific context (amounts, book id, etc.)
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_admin_actions_created ON tt_admin_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_tt_admin_actions_phone ON tt_admin_actions(target_phone);
