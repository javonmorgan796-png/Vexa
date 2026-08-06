-- ============================================================
-- Vexa Banking App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- IMPORTANT BEFORE RUNNING:
--   1. Go to Authentication → Settings
--   2. Turn OFF "Enable email confirmations"
--   3. This lets users sign up and log in immediately without
--      needing to confirm an email address.
-- ============================================================

-- ── User profiles ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL,
  account_number TEXT NOT NULL,
  pin            TEXT NOT NULL DEFAULT '0000',
  level          INTEGER NOT NULL DEFAULT 1,
  verified       BOOLEAN NOT NULL DEFAULT false,
  balance        NUMERIC(15, 2) NOT NULL DEFAULT 0,
  profile_photo  TEXT,
  referral_code  TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── Auto-create profile on signup (bypasses RLS) ──────────
-- This trigger runs with SECURITY DEFINER (elevated privileges),
-- so it works even when email confirmation is ON (no session yet).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  acc TEXT;
BEGIN
  -- Generate a 10-digit account number starting with 9
  acc := '9' || lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
  INSERT INTO public.profiles (
    id, name, email, phone, account_number, pin, level, verified, balance, referral_code
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Vexa User'),
    '',
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'account_number', acc),
    '0000',
    1,
    false,
    0,
    COALESCE(NEW.raw_user_meta_data->>'referral_code', 'VEXA-' || right(acc, 4))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Cashback history ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cashback_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  date        TEXT NOT NULL,
  rate        TEXT NOT NULL DEFAULT '0%',
  earned      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'cleared',  -- 'pending' | 'cleared' | 'redeemed'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cashback_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cashback"
  ON public.cashback_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cashback"
  ON public.cashback_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cashback"
  ON public.cashback_history FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Referrals ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_name  TEXT NOT NULL,
  referred_phone TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid'
  earned         NUMERIC(12, 2) NOT NULL DEFAULT 10000,
  date           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- ── User notifications ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info',  -- 'credit' | 'debit' | 'security' | 'promo' | 'info'
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ── User transactions ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'out',  -- 'in' | 'out'
  name       TEXT NOT NULL,
  amount     NUMERIC(15, 2) NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Business accounts ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name         TEXT NOT NULL,
  business_type         TEXT NOT NULL,
  industry              TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  account_number        TEXT NOT NULL,
  balance               NUMERIC(15, 2) NOT NULL DEFAULT 0,
  owner_name            TEXT NOT NULL,
  owner_phone           TEXT NOT NULL,
  email                 TEXT NOT NULL DEFAULT '',
  address               TEXT NOT NULL DEFAULT '',
  two_fa_enabled        BOOLEAN NOT NULL DEFAULT false,
  transaction_limit     NUMERIC(15, 2) NOT NULL DEFAULT 5000000,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage their business"
  ON public.business_accounts FOR ALL
  USING (auth.uid() = owner_id);

-- ── Employees ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT '',
  department     TEXT NOT NULL DEFAULT '',
  salary         NUMERIC(15, 2) NOT NULL DEFAULT 0,
  account_number TEXT NOT NULL DEFAULT '',
  bank_name      TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  start_date     TEXT NOT NULL DEFAULT '',
  app_role       TEXT NOT NULL DEFAULT 'employee',
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage employees"
  ON public.employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- ── Payroll schedules ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  frequency      TEXT NOT NULL,
  next_run_date  TEXT NOT NULL DEFAULT '',
  employee_ids   TEXT[] NOT NULL DEFAULT '{}',
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payroll_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage payroll schedules"
  ON public.payroll_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- ── Business transactions ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  amount      NUMERIC(15, 2) NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  reference   TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage business transactions"
  ON public.business_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- ── Business security (PIN + lockout) ─────────────────────

CREATE TABLE IF NOT EXISTS public.business_security (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin          TEXT NOT NULL DEFAULT '123456',
  attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business security"
  ON public.business_security FOR ALL
  USING (auth.uid() = user_id);
