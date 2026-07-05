-- Teacher Toolkit — Supabase schema (retroactively documented, then version-controlled from here on)
-- Safe to re-run: every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Run new statements in the Supabase SQL Editor whenever this file changes.

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
  plan_quota integer,
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

-- ═══════════════ tt_books — Book Bank (curated STB textbooks in Supabase Storage) ═══════════════
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
