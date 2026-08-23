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

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_phone TEXT;

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
    COALESCE(NEW.email, ''),
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

-- ── Repair existing profile rows ─────────────────────────
-- Auth owns the login identity; profiles owns the banking data. This fills
-- only missing values and does not overwrite any profile edits.
UPDATE public.profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE u.id = p.id
  AND COALESCE(p.email, '') = ''
  AND COALESCE(u.email, '') <> '';

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

DROP POLICY IF EXISTS "Users can view own cashback" ON public.cashback_history;
CREATE POLICY "Users can view own cashback"
  ON public.cashback_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cashback" ON public.cashback_history;
CREATE POLICY "Users can insert own cashback"
  ON public.cashback_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cashback" ON public.cashback_history;
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

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "own notifications" ON public.notifications;
CREATE POLICY "own notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── User transactions ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'out',  -- 'in' | 'out'
  name       TEXT NOT NULL,
  amount     NUMERIC(15, 2) NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  recipient_bank TEXT,
  recipient_account TEXT,
  sender_name TEXT,
  sender_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_bank TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_account TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sender_account TEXT;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "own transactions" ON public.transactions;
CREATE POLICY "own transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Vexa-to-Vexa transfers ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.peer_transfers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'completed',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.peer_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view peer transfers they sent or received" ON public.peer_transfers;
CREATE POLICY "Users can view peer transfers they sent or received"
  ON public.peer_transfers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP FUNCTION IF EXISTS public.transfer_vexa_money(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.transfer_vexa_money(
  p_recipient_account TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_pin TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender public.profiles;
  recipient public.profiles;
  peer_id UUID;
  debit_id UUID;
  credit_id UUID;
  clean_account TEXT := trim(p_recipient_account);
  clean_note TEXT := left(coalesce(p_note, ''), 120);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a valid transfer amount';
  END IF;

  SELECT * INTO sender
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  SELECT * INTO recipient
  FROM public.profiles
  WHERE account_number = clean_account
  FOR UPDATE;

  IF sender.id IS NULL THEN
    RAISE EXCEPTION 'Sender profile was not found';
  END IF;
  IF sender.pin = '0000' THEN
    RAISE EXCEPTION 'Set your transaction PIN before sending money';
  END IF;
  IF sender.pin <> p_pin THEN
    RAISE EXCEPTION 'Incorrect transaction PIN';
  END IF;
  IF recipient.id IS NULL THEN
    RAISE EXCEPTION 'No Vexa user was found for that account number';
  END IF;
  IF sender.id = recipient.id THEN
    RAISE EXCEPTION 'You cannot transfer money to your own account';
  END IF;
  IF sender.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Vexa balance';
  END IF;

  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = sender.id;

  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = recipient.id;

  INSERT INTO public.peer_transfers (sender_id, recipient_id, amount, note)
  VALUES (sender.id, recipient.id, p_amount, clean_note)
  RETURNING id INTO peer_id;

  INSERT INTO public.transactions (
    user_id, type, name, amount, note, recipient_bank, recipient_account,
    sender_name, sender_account
  )
  VALUES (
    sender.id, 'out', recipient.name, p_amount,
    CASE WHEN clean_note = '' THEN 'Vexa-to-Vexa transfer' ELSE clean_note END,
    'Vexa', recipient.account_number, sender.name, sender.account_number
  )
  RETURNING id INTO debit_id;

  INSERT INTO public.transactions (
    user_id, type, name, amount, note, recipient_bank, recipient_account,
    sender_name, sender_account
  )
  VALUES (
    recipient.id, 'in', sender.name, p_amount,
    CASE WHEN clean_note = '' THEN 'Received from Vexa user' ELSE clean_note END,
    'Vexa', recipient.account_number, sender.name, sender.account_number
  )
  RETURNING id INTO credit_id;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES
    (sender.id, 'debit', 'Vexa transfer sent',
      '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' sent to ' || recipient.name),
    (recipient.id, 'credit', 'Money received',
      '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' received from ' || sender.name);

  RETURN jsonb_build_object(
    'peer_transfer_id', peer_id,
    'transaction_id', debit_id,
    'recipient_name', recipient.name,
    'recipient_account', recipient.account_number,
    'amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_vexa_money(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

-- ── Vexa Exchange ledger ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crypto_accounts (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  naira_balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (naira_balance >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crypto_balances (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset   TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
  amount  NUMERIC(30, 12) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, asset)
);

CREATE TABLE IF NOT EXISTS public.crypto_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL CHECK (kind IN ('deposit', 'buy', 'sell', 'transfer_in', 'transfer_out')),
  asset                TEXT NOT NULL CHECK (asset IN ('NGN', 'BTC', 'ETH', 'USDT')),
  amount               NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  naira_amount         NUMERIC(18, 2) NOT NULL DEFAULT 0,
  rate                 NUMERIC(30, 8) NOT NULL DEFAULT 0,
  counterparty_account TEXT,
  note                 TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crypto_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own crypto account" ON public.crypto_accounts;
CREATE POLICY "Users can manage own crypto account"
  ON public.crypto_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own crypto balances" ON public.crypto_balances;
CREATE POLICY "Users can manage own crypto balances"
  ON public.crypto_balances FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own crypto transactions" ON public.crypto_transactions;
CREATE POLICY "Users can view own crypto transactions"
  ON public.crypto_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.deposit_to_crypto(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  wallet public.crypto_accounts;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid deposit amount'; END IF;

  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = current_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient Vexa balance'; END IF;

  INSERT INTO public.crypto_accounts (user_id, naira_balance)
  VALUES (current_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET naira_balance = public.crypto_accounts.naira_balance + EXCLUDED.naira_balance
  RETURNING * INTO wallet;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, naira_amount, note)
  VALUES (current_user_id, 'deposit', 'NGN', p_amount, p_amount, 'Funded from Vexa balance');

  RETURN jsonb_build_object('naira_balance', wallet.naira_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.exchange_crypto(
  p_asset TEXT,
  p_side TEXT,
  p_naira_amount NUMERIC,
  p_rate NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  wallet public.crypto_accounts;
  current_asset NUMERIC;
  crypto_amount NUMERIC;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') THEN RAISE EXCEPTION 'Unsupported asset'; END IF;
  IF p_side NOT IN ('buy', 'sell') THEN RAISE EXCEPTION 'Unsupported exchange side'; END IF;
  IF p_naira_amount IS NULL OR p_naira_amount <= 0 OR p_rate IS NULL OR p_rate <= 0 THEN
    RAISE EXCEPTION 'Enter a valid exchange amount';
  END IF;

  INSERT INTO public.crypto_accounts (user_id)
  VALUES (current_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = current_user_id FOR UPDATE;

  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (current_user_id, p_asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;
  SELECT amount INTO current_asset
  FROM public.crypto_balances
  WHERE user_id = current_user_id AND asset = p_asset
  FOR UPDATE;

  crypto_amount := p_naira_amount / p_rate;
  IF p_side = 'buy' THEN
    IF wallet.naira_balance < p_naira_amount THEN RAISE EXCEPTION 'Insufficient exchange Naira balance'; END IF;
    UPDATE public.crypto_accounts SET naira_balance = naira_balance - p_naira_amount WHERE user_id = current_user_id;
    UPDATE public.crypto_balances SET amount = amount + crypto_amount, updated_at = now()
    WHERE user_id = current_user_id AND asset = p_asset;
  ELSE
    IF current_asset < crypto_amount THEN RAISE EXCEPTION 'Insufficient crypto balance'; END IF;
    UPDATE public.crypto_accounts SET naira_balance = naira_balance + p_naira_amount WHERE user_id = current_user_id;
    UPDATE public.crypto_balances SET amount = amount - crypto_amount, updated_at = now()
    WHERE user_id = current_user_id AND asset = p_asset;
  END IF;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, naira_amount, rate, note)
  VALUES (current_user_id, p_side, p_asset, crypto_amount, p_naira_amount, p_rate,
    CASE WHEN p_side = 'buy' THEN 'Bought with exchange balance' ELSE 'Sold to exchange balance' END);

  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = current_user_id;
  RETURN jsonb_build_object('asset_amount', crypto_amount, 'naira_balance', wallet.naira_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_crypto(
  p_recipient_account TEXT,
  p_asset TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  recipient public.profiles;
  current_asset NUMERIC;
  clean_account TEXT := trim(p_recipient_account);
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') THEN RAISE EXCEPTION 'Unsupported asset'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid crypto amount'; END IF;

  SELECT * INTO recipient FROM public.profiles WHERE account_number = clean_account FOR UPDATE;
  IF recipient.id IS NULL THEN RAISE EXCEPTION 'No Vexa user was found for that account number'; END IF;
  IF recipient.id = current_user_id THEN RAISE EXCEPTION 'You cannot transfer to your own account'; END IF;

  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (current_user_id, p_asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;
  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (recipient.id, p_asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;

  SELECT amount INTO current_asset FROM public.crypto_balances
  WHERE user_id = current_user_id AND asset = p_asset FOR UPDATE;
  IF current_asset < p_amount THEN RAISE EXCEPTION 'Insufficient crypto balance'; END IF;

  UPDATE public.crypto_balances SET amount = amount - p_amount, updated_at = now()
  WHERE user_id = current_user_id AND asset = p_asset;
  UPDATE public.crypto_balances SET amount = amount + p_amount, updated_at = now()
  WHERE user_id = recipient.id AND asset = p_asset;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, counterparty_account, note)
  VALUES
    (current_user_id, 'transfer_out', p_asset, p_amount, recipient.account_number, 'Crypto sent to Vexa user'),
    (recipient.id, 'transfer_in', p_asset, p_amount,
      (SELECT account_number FROM public.profiles WHERE id = current_user_id), 'Crypto received from Vexa user');

  RETURN jsonb_build_object('recipient_name', recipient.name, 'recipient_account', recipient.account_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_to_crypto(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_crypto(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_crypto(TEXT, TEXT, NUMERIC) TO authenticated;

-- ── External crypto deposit addresses ──────────────────────
CREATE TABLE IF NOT EXISTS public.crypto_deposit_addresses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset      TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
  address    TEXT NOT NULL,
  network    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, asset),
  UNIQUE (asset, address)
);

ALTER TABLE public.crypto_deposit_addresses ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.crypto_deposit_addresses TO authenticated;
GRANT ALL ON public.crypto_deposit_addresses TO service_role;
DROP POLICY IF EXISTS "Users can view own crypto deposit addresses" ON public.crypto_deposit_addresses;
CREATE POLICY "Users can view own crypto deposit addresses"
  ON public.crypto_deposit_addresses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

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

DROP POLICY IF EXISTS "Business owners can manage their business" ON public.business_accounts;
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

DROP POLICY IF EXISTS "Business owners can manage employees" ON public.employees;
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

DROP POLICY IF EXISTS "Business owners can manage payroll schedules" ON public.payroll_schedules;
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

DROP POLICY IF EXISTS "Business owners can manage business transactions" ON public.business_transactions;
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

DROP POLICY IF EXISTS "Users can manage own business security" ON public.business_security;
CREATE POLICY "Users can manage own business security"
  ON public.business_security FOR ALL
  USING (auth.uid() = user_id);
