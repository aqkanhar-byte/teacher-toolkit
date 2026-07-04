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
