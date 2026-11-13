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
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL,
  account_number      TEXT NOT NULL,
  pin                 TEXT NOT NULL DEFAULT '',
  pin_hash            TEXT,
  pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until    TIMESTAMPTZ,
  level               INTEGER NOT NULL DEFAULT 1,
  verified            BOOLEAN NOT NULL DEFAULT false,
  balance             NUMERIC(15, 2) NOT NULL DEFAULT 0,
  profile_photo       TEXT,
  referral_code       TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT (
  id, name, email, phone, account_number, level, verified, balance,
  profile_photo, referral_code, created_at
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access to profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Service role full access to profiles"
  ON public.profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_phone TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- ── Auto-create profile on signup (bypasses RLS) ──────────
-- This trigger runs with SECURITY DEFINER (elevated privileges),
-- so it works even when email confirmation is ON (no session yet).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    '',
    1,
    false,
    0,
    COALESCE(NEW.raw_user_meta_data->>'referral_code', 'VEXA-' || right(acc, 4))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

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
REVOKE ALL ON public.cashback_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cashback_history TO authenticated;
GRANT ALL ON public.cashback_history TO service_role;

DROP POLICY IF EXISTS "Users can view own cashback" ON public.cashback_history;
DROP POLICY IF EXISTS "Users can insert own cashback" ON public.cashback_history;
DROP POLICY IF EXISTS "Users can update own cashback" ON public.cashback_history;
DROP POLICY IF EXISTS "Service role full access to cashback" ON public.cashback_history;
CREATE POLICY "Users can view own cashback"
  ON public.cashback_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to cashback"
  ON public.cashback_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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
REVOKE ALL ON public.referrals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service role full access to referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);
CREATE POLICY "Service role full access to referrals"
  ON public.referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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

REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (read) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
DROP POLICY IF EXISTS "own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role full access to notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access to notifications"
  ON public.notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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

REVOKE ALL ON public.transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Service role full access to transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to transactions"
  ON public.transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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

REVOKE ALL ON FUNCTION public.transfer_vexa_money(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_vexa_money(TEXT, NUMERIC, TEXT, TEXT) TO service_role;

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

REVOKE ALL ON public.crypto_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crypto_accounts TO authenticated;
GRANT ALL ON public.crypto_accounts TO service_role;
DROP POLICY IF EXISTS "Users can manage own crypto account" ON public.crypto_accounts;
DROP POLICY IF EXISTS "Users can view own crypto account" ON public.crypto_accounts;
DROP POLICY IF EXISTS "Service role full access to crypto_accounts" ON public.crypto_accounts;
CREATE POLICY "Users can view own crypto account"
  ON public.crypto_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to crypto_accounts"
  ON public.crypto_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.crypto_balances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crypto_balances TO authenticated;
GRANT ALL ON public.crypto_balances TO service_role;
DROP POLICY IF EXISTS "Users can manage own crypto balances" ON public.crypto_balances;
DROP POLICY IF EXISTS "Users can view own crypto balances" ON public.crypto_balances;
DROP POLICY IF EXISTS "Service role full access to crypto_balances" ON public.crypto_balances;
CREATE POLICY "Users can view own crypto balances"
  ON public.crypto_balances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to crypto_balances"
  ON public.crypto_balances FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.crypto_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crypto_transactions TO authenticated;
GRANT ALL ON public.crypto_transactions TO service_role;
DROP POLICY IF EXISTS "Users can view own crypto transactions" ON public.crypto_transactions;
DROP POLICY IF EXISTS "Service role full access to crypto_transactions" ON public.crypto_transactions;
CREATE POLICY "Users can view own crypto transactions"
  ON public.crypto_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to crypto_transactions"
  ON public.crypto_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    current_user_id,
    'crypto',
    'Exchange wallet funded',
    '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' moved from your Vexa balance to your Exchange wallet.'
  );

  RETURN jsonb_build_object('naira_balance', wallet.naira_balance, 'notified', true);
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
  formatted_crypto TEXT;
  formatted_naira TEXT;
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

  formatted_crypto := regexp_replace(to_char(ROUND(crypto_amount, 8), 'FM999G999G990.00000000'), '\.?0+$', '');
  formatted_naira := to_char(p_naira_amount, 'FM999G999G999G990D00');

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    current_user_id,
    'crypto',
    CASE WHEN p_side = 'buy' THEN p_asset || ' purchase successful' ELSE p_asset || ' sale successful' END,
    CASE
      WHEN p_side = 'buy' THEN 'Bought ' || formatted_crypto || ' ' || p_asset || ' for ₦' || formatted_naira || '.'
      ELSE 'Sold ' || formatted_crypto || ' ' || p_asset || ' for ₦' || formatted_naira || ' to your Exchange balance.'
    END
  );

  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = current_user_id;
  RETURN jsonb_build_object('asset_amount', crypto_amount, 'naira_balance', wallet.naira_balance, 'notified', true);
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
  sender public.profiles;
  recipient public.profiles;
  current_asset NUMERIC;
  clean_account TEXT := trim(p_recipient_account);
  formatted_crypto TEXT;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') THEN RAISE EXCEPTION 'Unsupported asset'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid crypto amount'; END IF;

  SELECT * INTO sender FROM public.profiles WHERE id = current_user_id;
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
    (recipient.id, 'transfer_in', p_asset, p_amount, sender.account_number, 'Crypto received from Vexa user');

  formatted_crypto := regexp_replace(to_char(ROUND(p_amount, 8), 'FM999G999G990.00000000'), '\.?0+$', '');
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES
    (current_user_id, 'crypto', p_asset || ' transfer sent',
      formatted_crypto || ' ' || p_asset || ' sent to ' || recipient.name || ' (' || recipient.account_number || ').'),
    (recipient.id, 'crypto', p_asset || ' received',
      formatted_crypto || ' ' || p_asset || ' received from ' || COALESCE(sender.name, 'Vexa user') || '.');

  RETURN jsonb_build_object('recipient_name', recipient.name, 'recipient_account', recipient.account_number, 'notified', true);
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_to_crypto(NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exchange_crypto(TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transfer_crypto(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_to_crypto(NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.exchange_crypto(TEXT, TEXT, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_crypto(TEXT, TEXT, NUMERIC) TO service_role;

-- ── External crypto deposit addresses ──────────────────────
CREATE TABLE IF NOT EXISTS public.crypto_deposit_addresses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset      TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
  address    TEXT NOT NULL,
  network    TEXT NOT NULL,
  tatum_subscription_id     TEXT UNIQUE,
  tatum_subscription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (tatum_subscription_status IN ('pending', 'creating', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, asset),
  UNIQUE (asset, address)
);

ALTER TABLE public.crypto_deposit_addresses
  ADD COLUMN IF NOT EXISTS tatum_subscription_id TEXT UNIQUE;
ALTER TABLE public.crypto_deposit_addresses
  ADD COLUMN IF NOT EXISTS tatum_subscription_status TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.crypto_deposit_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_reference     TEXT NOT NULL UNIQUE,
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset                 TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
  network               TEXT NOT NULL,
  address               TEXT NOT NULL,
  transaction_hash      TEXT NOT NULL,
  amount                NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  confirmations         INTEGER NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  required_confirmations INTEGER NOT NULL CHECK (required_confirmations > 0),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credited_at           TIMESTAMPTZ
);

ALTER TABLE public.crypto_deposit_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crypto_deposit_events TO service_role;

CREATE OR REPLACE FUNCTION public.process_tatum_crypto_deposit(
  p_deposit_reference TEXT,
  p_user_id UUID,
  p_asset TEXT,
  p_network TEXT,
  p_address TEXT,
  p_transaction_hash TEXT,
  p_amount NUMERIC,
  p_confirmations INTEGER,
  p_required_confirmations INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deposit_event public.crypto_deposit_events;
  formatted_crypto TEXT;
BEGIN
  IF p_user_id IS NULL
     OR COALESCE(trim(p_deposit_reference), '') = ''
     OR COALESCE(trim(p_transaction_hash), '') = ''
     OR p_asset NOT IN ('BTC', 'ETH', 'USDT')
     OR p_amount IS NULL
     OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid crypto deposit';
  END IF;
  IF p_confirmations IS NULL OR p_required_confirmations IS NULL OR p_required_confirmations <= 0 THEN
    RAISE EXCEPTION 'Invalid confirmation data';
  END IF;

  INSERT INTO public.crypto_deposit_events (
    deposit_reference, user_id, asset, network, address, transaction_hash,
    amount, confirmations, required_confirmations
  )
  VALUES (
    p_deposit_reference, p_user_id, p_asset, p_network, p_address, p_transaction_hash,
    p_amount, p_confirmations, p_required_confirmations
  )
  ON CONFLICT (deposit_reference) DO UPDATE
    SET confirmations = GREATEST(public.crypto_deposit_events.confirmations, EXCLUDED.confirmations)
  RETURNING * INTO deposit_event;

  IF deposit_event.status = 'credited' THEN
    RETURN jsonb_build_object('status', 'already_processed', 'notified', true);
  END IF;

  formatted_crypto := regexp_replace(to_char(ROUND(deposit_event.amount, 8), 'FM999G999G990.00000000'), '\.?0+$', '');

  IF deposit_event.confirmations < deposit_event.required_confirmations THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = deposit_event.user_id
        AND type = 'crypto'
        AND title = deposit_event.asset || ' deposit incoming'
        AND body LIKE '%' || LEFT(deposit_event.transaction_hash, 10) || '%'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (
        deposit_event.user_id,
        'crypto',
        deposit_event.asset || ' deposit incoming',
        formatted_crypto || ' ' || deposit_event.asset || ' detected on ' || deposit_event.network ||
          ' (' || deposit_event.confirmations || '/' || deposit_event.required_confirmations ||
          ' confirmations · Tx ' || LEFT(deposit_event.transaction_hash, 10) || '…).'
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'pending',
      'confirmations', deposit_event.confirmations,
      'required_confirmations', deposit_event.required_confirmations,
      'notified', true
    );
  END IF;

  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (deposit_event.user_id, deposit_event.asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;

  UPDATE public.crypto_balances
  SET amount = amount + deposit_event.amount, updated_at = NOW()
  WHERE user_id = deposit_event.user_id AND asset = deposit_event.asset;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, note)
  VALUES (
    deposit_event.user_id,
    'deposit',
    deposit_event.asset,
    deposit_event.amount,
    'Confirmed blockchain deposit ' || deposit_event.transaction_hash
  );

  UPDATE public.crypto_deposit_events
  SET status = 'credited', credited_at = NOW()
  WHERE id = deposit_event.id;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    deposit_event.user_id,
    'crypto',
    deposit_event.asset || ' deposit received',
    formatted_crypto || ' ' || deposit_event.asset || ' received on ' || deposit_event.network ||
      ' and credited to your Exchange wallet (Tx ' || LEFT(deposit_event.transaction_hash, 10) || '…).'
  );

  RETURN jsonb_build_object('status', 'credited', 'notified', true);
END;
$$;

REVOKE ALL ON FUNCTION public.process_tatum_crypto_deposit(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_tatum_crypto_deposit(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER
) TO service_role;

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
REVOKE ALL ON public.business_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_accounts TO authenticated;
GRANT ALL ON public.business_accounts TO service_role;

DROP POLICY IF EXISTS "Business owners can manage their business" ON public.business_accounts;
DROP POLICY IF EXISTS "Business owners can view their business" ON public.business_accounts;
DROP POLICY IF EXISTS "Service role full access to business_accounts" ON public.business_accounts;
CREATE POLICY "Business owners can view their business"
  ON public.business_accounts FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Service role full access to business_accounts"
  ON public.business_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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
REVOKE ALL ON public.employees FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

DROP POLICY IF EXISTS "Business owners can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Business owners can view employees" ON public.employees;
DROP POLICY IF EXISTS "Service role full access to employees" ON public.employees;
CREATE POLICY "Business owners can view employees"
  ON public.employees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "Service role full access to employees"
  ON public.employees FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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
REVOKE ALL ON public.payroll_schedules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payroll_schedules TO authenticated;
GRANT ALL ON public.payroll_schedules TO service_role;

DROP POLICY IF EXISTS "Business owners can manage payroll schedules" ON public.payroll_schedules;
DROP POLICY IF EXISTS "Business owners can view payroll schedules" ON public.payroll_schedules;
DROP POLICY IF EXISTS "Service role full access to payroll_schedules" ON public.payroll_schedules;
CREATE POLICY "Business owners can view payroll schedules"
  ON public.payroll_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "Service role full access to payroll_schedules"
  ON public.payroll_schedules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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
REVOKE ALL ON public.business_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_transactions TO authenticated;
GRANT ALL ON public.business_transactions TO service_role;

DROP POLICY IF EXISTS "Business owners can manage business transactions" ON public.business_transactions;
DROP POLICY IF EXISTS "Business owners can view business transactions" ON public.business_transactions;
DROP POLICY IF EXISTS "Service role full access to business_transactions" ON public.business_transactions;
CREATE POLICY "Business owners can view business transactions"
  ON public.business_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY "Service role full access to business_transactions"
  ON public.business_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Business security (PIN + lockout) ─────────────────────

CREATE TABLE IF NOT EXISTS public.business_security (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin          TEXT NOT NULL DEFAULT '',
  pin_hash     TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_security ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_security FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_security TO service_role;

DROP POLICY IF EXISTS "Users can manage own business security" ON public.business_security;
DROP POLICY IF EXISTS "Service role full access to business_security" ON public.business_security;
CREATE POLICY "Service role full access to business_security"
  ON public.business_security FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Login lockouts and active devices ──────────────────────
-- Login failures are keyed by a SHA-256 identifier hash so the public
-- login RPCs never expose phone numbers from the security table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.login_security (
  identifier_hash TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.login_security FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.login_identifier_hash(p_identifier TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(lower(trim(coalesce(p_identifier, ''))), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.check_login_lockout(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  security_row public.login_security;
BEGIN
  SELECT * INTO security_row
  FROM public.login_security
  WHERE identifier_hash = public.login_identifier_hash(p_identifier);

  IF security_row.locked_until IS NOT NULL AND security_row.locked_until <= NOW() THEN
    UPDATE public.login_security
    SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE identifier_hash = security_row.identifier_hash;
    RETURN jsonb_build_object('failed_attempts', 0, 'locked_until', NULL);
  END IF;

  RETURN jsonb_build_object(
    'failed_attempts', COALESCE(security_row.failed_attempts, 0),
    'locked_until', security_row.locked_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_failure(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  identifier_key TEXT := public.login_identifier_hash(p_identifier);
  security_row public.login_security;
  row_exists BOOLEAN;
  next_attempts INTEGER;
  next_lock TIMESTAMPTZ;
BEGIN
  SELECT * INTO security_row
  FROM public.login_security
  WHERE identifier_hash = identifier_key
  FOR UPDATE;
  row_exists := FOUND;

  IF row_exists AND security_row.locked_until IS NOT NULL AND security_row.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'failed_attempts', security_row.failed_attempts,
      'locked_until', security_row.locked_until
    );
  END IF;

  next_attempts := CASE
    WHEN NOT row_exists OR security_row.locked_until IS NOT NULL THEN 1
    ELSE security_row.failed_attempts + 1
  END;
  next_lock := CASE
    WHEN next_attempts >= 3 THEN NOW() + INTERVAL '5 minutes'
    ELSE NULL
  END;

  INSERT INTO public.login_security (identifier_hash, failed_attempts, locked_until, updated_at)
  VALUES (identifier_key, next_attempts, next_lock, NOW())
  ON CONFLICT (identifier_hash) DO UPDATE SET
    failed_attempts = EXCLUDED.failed_attempts,
    locked_until = EXCLUDED.locked_until,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'failed_attempts', next_attempts,
    'locked_until', next_lock
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_login_lockout(p_identifier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected_email TEXT := public.login_identifier_hash(p_identifier);
  current_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR current_email <> lower(trim(p_identifier)) || '@vexa.app' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.login_security
  WHERE identifier_hash = expected_email;
END;
$$;

REVOKE ALL ON FUNCTION public.check_login_lockout(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_failure(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_login_lockout(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_login_lockout(TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  device_name   TEXT NOT NULL DEFAULT 'Unknown device',
  device_type   TEXT NOT NULL DEFAULT 'desktop',
  user_agent    TEXT NOT NULL DEFAULT '',
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
  ON public.user_sessions(user_id, last_active_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can register own sessions" ON public.user_sessions;
CREATE POLICY "Users can register own sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- ── Vexa Premium Admin Dashboard & Governance Schema ────────
-- ============================================================

-- Profile extensions for account restriction & KYC tier
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_tier INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

-- ── 1. Admin Roles & RBAC ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT 'Administrator',
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'finance_manager', 'support_agent', 'auditor')),
  permissions   TEXT[] NOT NULL DEFAULT ARRAY['overview.view'],
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_roles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_roles TO service_role;

DROP POLICY IF EXISTS "Service role has full access to admin_roles" ON public.admin_roles;
CREATE POLICY "Service role has full access to admin_roles"
  ON public.admin_roles FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 2. KYC Verification Requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name        TEXT NOT NULL,
  user_phone       TEXT NOT NULL,
  id_type          TEXT NOT NULL, -- NIN, BVN, Driver License, International Passport, Voter Card
  id_number        TEXT NOT NULL,
  document_url     TEXT,
  selfie_url       TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kyc_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kyc_requests TO service_role;

DROP POLICY IF EXISTS "Service role has full access to kyc_requests" ON public.kyc_requests;
CREATE POLICY "Service role has full access to kyc_requests"
  ON public.kyc_requests FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 3. Cards Management ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number    TEXT NOT NULL,
  card_holder    TEXT NOT NULL,
  expiry_month   TEXT NOT NULL DEFAULT '12',
  expiry_year    TEXT NOT NULL DEFAULT '29',
  cvv            TEXT NOT NULL DEFAULT '789',
  card_type      TEXT NOT NULL DEFAULT 'virtual' CHECK (card_type IN ('virtual', 'physical')),
  card_brand     TEXT NOT NULL DEFAULT 'mastercard' CHECK (card_brand IN ('mastercard', 'visa', 'verve')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'blocked', 'expired')),
  spending_limit NUMERIC(15, 2) NOT NULL DEFAULT 500000,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cards TO service_role;

DROP POLICY IF EXISTS "Service role has full access to cards" ON public.cards;
CREATE POLICY "Service role has full access to cards"
  ON public.cards FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 4. Customer Support Tickets ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL,
  user_phone    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('transfer', 'deposit', 'card', 'account', 'fraud', 'general')),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  messages      JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_to   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.support_tickets TO service_role;

DROP POLICY IF EXISTS "Service role has full access to support_tickets" ON public.support_tickets;
CREATE POLICY "Service role has full access to support_tickets"
  ON public.support_tickets FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 5. Security & Fraud Alerts ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name     TEXT NOT NULL,
  user_phone    TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  alert_type    TEXT NOT NULL,
  description   TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'investigating', 'resolved', 'dismissed')),
  resolved_by   TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fraud_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;

DROP POLICY IF EXISTS "Service role has full access to fraud_alerts" ON public.fraud_alerts;
CREATE POLICY "Service role has full access to fraud_alerts"
  ON public.fraud_alerts FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 6. Immutable Administrative Audit Logs ────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       UUID,
  admin_phone    TEXT NOT NULL,
  admin_name     TEXT NOT NULL DEFAULT 'Admin',
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL, -- user, transaction, kyc, withdrawal, card, system, admin
  target_id      TEXT,
  details        JSONB DEFAULT '{}'::jsonb,
  previous_value JSONB,
  new_value      JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

DROP POLICY IF EXISTS "Service role has full access to admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Service role has full access to admin_audit_logs"
  ON public.admin_audit_logs FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 7. System Settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  id         TEXT PRIMARY KEY DEFAULT 'global',
  settings   JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;

DROP POLICY IF EXISTS "Service role has full access to system_settings" ON public.system_settings;
CREATE POLICY "Service role has full access to system_settings"
  ON public.system_settings FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 8. Default System Settings ─────────────────────────────────
-- NOTE: Provision initial super_admin operators explicitly in admin_roles
-- via SQL Editor (no hardcoded phone/credentials in source).
INSERT INTO public.system_settings (id, settings, updated_by)
VALUES (
  'global',
  jsonb_build_object(
    'maintenance_mode', false,
    'allow_new_signups', true,
    'allow_transfers', true,
    'allow_crypto_exchange', true,
    'allow_bill_payments', true,
    'tier1_daily_limit', 50000,
    'tier2_daily_limit', 500000,
    'tier3_daily_limit', 5000000,
    'transfer_fee_flat', 10.0,
    'instant_withdrawal_fee_pct', 0.5,
    'session_timeout_minutes', 30,
    'enforce_device_binding', true,
    'suspicious_amount_threshold', 1000000,
    'tatum_webhook_url', ''
  ),
  'system'
)
ON CONFLICT (id) DO NOTHING;

-- ── 9. Trigger to link auth.users to pre-provisioned admin_roles ──
CREATE OR REPLACE FUNCTION public.handle_admin_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  IF v_phone = '' AND NEW.email LIKE '%@vexa.app' THEN
    v_phone := split_part(NEW.email, '@', 1);
  END IF;

  IF v_phone LIKE '+234%' THEN
    v_phone := '0' || substring(v_phone FROM 5);
  ELSIF v_phone LIKE '234%' THEN
    v_phone := '0' || substring(v_phone FROM 4);
  END IF;

  IF v_phone <> '' THEN
    UPDATE public.admin_roles
    SET user_id = NEW.id, updated_at = NOW()
    WHERE phone = v_phone;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_user_sync ON auth.users;
CREATE TRIGGER on_admin_user_sync
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_user_sync();

-- ── 10. High-Security Admin Credentials Storage ──────────────
-- Stores salted, hashed master passwords and AES-256-GCM encrypted TOTP secrets.
-- Row Level Security (RLS) is STRICT: only service_role can access.
-- Zero public access via client anon keys.

CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                   TEXT NOT NULL UNIQUE,
  password_hash           TEXT NOT NULL,
  password_salt           TEXT NOT NULL,
  password_algo           TEXT NOT NULL DEFAULT 'pbkdf2_sha512',
  totp_secret_encrypted   TEXT NOT NULL,
  totp_secret_iv          TEXT NOT NULL,
  totp_secret_tag         TEXT NOT NULL,
  rescue_code_hash        TEXT NOT NULL,
  rescue_code_salt        TEXT NOT NULL,
  failed_attempts         INTEGER NOT NULL DEFAULT 0,
  locked_until            TIMESTAMPTZ,
  last_login_at           TIMESTAMPTZ,
  last_login_ip           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_credentials TO service_role;

DROP POLICY IF EXISTS "Service role full access on admin_credentials" ON public.admin_credentials;
CREATE POLICY "Service role full access on admin_credentials"
  ON public.admin_credentials FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Deny public access on admin_credentials" ON public.admin_credentials;
CREATE POLICY "Deny public access on admin_credentials"
  ON public.admin_credentials FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ── 11. Distributed Security Persistence & Atomic Settlement RPCs ───────────

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key  TEXT PRIMARY KEY,
  hit_count   INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
  reset_at    TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_rate_limits_reset_idx
  ON public.api_rate_limits(reset_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;

DROP POLICY IF EXISTS "Service role full access on api_rate_limits" ON public.api_rate_limits;
CREATE POLICY "Service role full access on api_rate_limits"
  ON public.api_rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.consume_rate_limit_srv(
  p_bucket_key TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_sec INTEGER := GREATEST(1, COALESCE(p_window_seconds, 60));
  v_max INTEGER := GREATEST(1, COALESCE(p_max_hits, 10));
  v_row public.api_rate_limits;
  v_retry INTEGER;
BEGIN
  IF p_bucket_key IS NULL OR trim(p_bucket_key) = '' THEN
    RAISE EXCEPTION 'Bucket key required';
  END IF;

  INSERT INTO public.api_rate_limits (bucket_key, hit_count, reset_at, updated_at)
  VALUES (p_bucket_key, 1, v_now + make_interval(secs => v_window_sec), v_now)
  ON CONFLICT (bucket_key) DO UPDATE SET
    hit_count = CASE
      WHEN public.api_rate_limits.reset_at <= v_now THEN 1
      ELSE public.api_rate_limits.hit_count + 1
    END,
    reset_at = CASE
      WHEN public.api_rate_limits.reset_at <= v_now THEN v_now + make_interval(secs => v_window_sec)
      ELSE public.api_rate_limits.reset_at
    END,
    updated_at = v_now
  RETURNING * INTO v_row;

  v_retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.reset_at - v_now)))::INTEGER);
  RETURN jsonb_build_object(
    'allowed', v_row.hit_count <= v_max,
    'count', v_row.hit_count,
    'retry_after_seconds', v_retry
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit_srv(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit_srv(TEXT, INTEGER, INTEGER) TO service_role;

CREATE TABLE IF NOT EXISTS public.auth_security_sessions (
  token_hash  TEXT PRIMARY KEY,
  namespace   TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_security_sessions_expires_idx
  ON public.auth_security_sessions(expires_at);

ALTER TABLE public.auth_security_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_security_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_security_sessions TO service_role;

DROP POLICY IF EXISTS "Service role full access on auth_security_sessions" ON public.auth_security_sessions;
CREATE POLICY "Service role full access on auth_security_sessions"
  ON public.auth_security_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.telecom_purchase_srv(
  p_user_id UUID,
  p_product_type TEXT,
  p_network_name TEXT,
  p_phone TEXT,
  p_data_bundle TEXT,
  p_amount NUMERIC,
  p_use_cashback BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_sec public.account_security_state;
  v_cb RECORD;
  v_total_cleared NUMERIC := 0;
  v_cashback_used NUMERIC := 0;
  v_payable NUMERIC := 0;
  v_remaining NUMERIC := 0;
  v_row_earned NUMERIC := 0;
  v_leftover NUMERIC := 0;
  v_cashback_earned NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_clean_network TEXT := left(trim(coalesce(p_network_name, '')), 40);
  v_clean_phone TEXT := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_clean_bundle TEXT := left(trim(coalesce(p_data_bundle, '')), 80);
  v_amount NUMERIC := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_date_label TEXT := to_char(NOW(), 'DD Mon YYYY');
  v_tx_name TEXT;
  v_note TEXT;
  v_notif_title TEXT;
  v_notif_body TEXT;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID required'; END IF;
  IF p_product_type NOT IN ('airtime', 'data') THEN RAISE EXCEPTION 'Invalid telecom product type'; END IF;
  IF v_clean_network = '' THEN RAISE EXCEPTION 'Please select a network provider'; END IF;
  IF length(v_clean_phone) < 10 OR length(v_clean_phone) > 13 THEN RAISE EXCEPTION 'Enter a valid recipient mobile number'; END IF;
  IF v_amount <= 0 OR v_amount > 500000 THEN RAISE EXCEPTION 'Enter a valid purchase amount'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;
  IF COALESCE(v_profile.is_suspended, false) THEN RAISE EXCEPTION 'Your Vexa account is currently suspended'; END IF;

  SELECT * INTO v_sec FROM public.account_security_state WHERE user_id = p_user_id;
  IF v_sec.user_id IS NOT NULL THEN
    IF COALESCE(v_sec.freeze_active, false) THEN RAISE EXCEPTION 'Freeze Account is active. Money movement is blocked.'; END IF;
    IF COALESCE(v_sec.sleep_mode_active, false) THEN RAISE EXCEPTION 'Sleep Mode is active. Money movement is blocked.'; END IF;
  END IF;

  IF COALESCE(p_use_cashback, false) THEN
    FOR v_cb IN
      SELECT id, earned
      FROM public.cashback_history
      WHERE user_id = p_user_id AND status = 'cleared'
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      v_total_cleared := ROUND((v_total_cleared + GREATEST(0, COALESCE(v_cb.earned, 0)))::NUMERIC, 2);
    END LOOP;
    v_cashback_used := ROUND(LEAST(v_amount, v_total_cleared)::NUMERIC, 2);
  END IF;

  v_payable := ROUND(GREATEST(0, v_amount - v_cashback_used)::NUMERIC, 2);
  IF v_profile.balance < v_payable THEN
    RAISE EXCEPTION 'Insufficient wallet balance for this purchase';
  END IF;

  v_new_balance := ROUND((v_profile.balance - v_payable)::NUMERIC, 2);
  IF v_payable > 0 THEN
    UPDATE public.profiles
    SET balance = v_new_balance
    WHERE id = p_user_id;
  END IF;

  IF v_cashback_used > 0 THEN
    v_remaining := v_cashback_used;
    FOR v_cb IN
      SELECT id, earned
      FROM public.cashback_history
      WHERE user_id = p_user_id AND status = 'cleared'
      ORDER BY created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_row_earned := ROUND(GREATEST(0, COALESCE(v_cb.earned, 0))::NUMERIC, 2);
      CONTINUE WHEN v_row_earned <= 0;

      IF v_row_earned <= v_remaining + 0.001 THEN
        UPDATE public.cashback_history SET status = 'redeemed' WHERE id = v_cb.id;
        v_remaining := ROUND(GREATEST(0, v_remaining - v_row_earned)::NUMERIC, 2);
      ELSE
        v_leftover := ROUND((v_row_earned - v_remaining)::NUMERIC, 2);
        UPDATE public.cashback_history SET earned = v_leftover WHERE id = v_cb.id;
        INSERT INTO public.cashback_history (user_id, description, date, rate, earned, status)
        VALUES (
          p_user_id,
          'Applied to ' || v_clean_network || ' ' || CASE WHEN p_product_type = 'data' THEN 'Data' ELSE 'Airtime' END || ' (' || v_clean_phone || ')',
          v_date_label,
          'Applied',
          v_remaining,
          'redeemed'
        );
        v_remaining := 0;
      END IF;
    END LOOP;
  END IF;

  v_cashback_earned := ROUND((v_amount * 0.05)::NUMERIC, 2);
  IF v_cashback_earned > 0 THEN
    INSERT INTO public.cashback_history (user_id, description, date, rate, earned, status)
    VALUES (
      p_user_id,
      v_clean_network || ' ' || CASE WHEN p_product_type = 'data' THEN 'Data' ELSE 'Airtime' END || ' · ' || v_clean_phone,
      v_date_label,
      '5%',
      v_cashback_earned,
      'cleared'
    );
  END IF;

  v_tx_name := v_clean_network || ' ' || CASE WHEN p_product_type = 'data' THEN 'Mobile Data' ELSE 'Airtime' END;
  v_note := concat_ws(
    ' · ',
    CASE WHEN p_product_type = 'data' AND v_clean_bundle <> '' THEN v_clean_bundle ELSE NULL END,
    v_clean_phone,
    CASE WHEN v_cashback_used > 0 THEN 'Cashback used -₦' || to_char(v_cashback_used, 'FM999G999G990D00') ELSE NULL END
  );

  INSERT INTO public.transactions (user_id, type, name, amount, note)
  VALUES (p_user_id, 'out', v_tx_name, v_payable, v_note);

  v_notif_title := CASE
    WHEN p_product_type = 'data' THEN v_clean_network || ' Data Activated'
    ELSE v_clean_network || ' Airtime Sent'
  END;
  v_notif_body := CASE
    WHEN p_product_type = 'data' THEN COALESCE(NULLIF(v_clean_bundle, ''), '₦' || to_char(v_amount, 'FM999G999G990D00') || ' data') || ' sent to ' || v_clean_phone
    ELSE '₦' || to_char(v_amount, 'FM999G999G990D00') || ' airtime sent to ' || v_clean_phone
  END || '. Paid ₦' || to_char(v_payable, 'FM999G999G990D00')
    || CASE WHEN v_cashback_used > 0 THEN ' (₦' || to_char(v_cashback_used, 'FM999G999G990D00') || ' cashback used)' ELSE '' END
    || CASE WHEN v_cashback_earned > 0 THEN ' · +₦' || to_char(v_cashback_earned, 'FM999G999G990D00') || ' cashback earned' ELSE '' END
    || '.';

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (p_user_id, 'debit', v_notif_title, v_notif_body, false);

  RETURN jsonb_build_object(
    'new_balance', v_new_balance,
    'payable_amount', v_payable,
    'cashback_used', v_cashback_used,
    'cashback_earned', v_cashback_earned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.telecom_purchase_srv(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telecom_purchase_srv(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.debit_business_balance_srv(
  p_owner_id UUID,
  p_business_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_category TEXT,
  p_reference TEXT,
  p_enforce_limit BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_sec public.account_security_state;
  v_biz public.business_accounts;
  v_tx public.business_transactions;
  v_amount NUMERIC := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_new_balance NUMERIC := 0;
BEGIN
  IF p_owner_id IS NULL OR p_business_id IS NULL THEN RAISE EXCEPTION 'Invalid business owner context'; END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF p_category NOT IN ('payroll', 'transfer', 'bills', 'other') THEN RAISE EXCEPTION 'Invalid transaction category'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_owner_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;
  IF COALESCE(v_profile.is_suspended, false) THEN RAISE EXCEPTION 'Your Vexa account is currently suspended'; END IF;

  SELECT * INTO v_sec FROM public.account_security_state WHERE user_id = p_owner_id;
  IF v_sec.user_id IS NOT NULL THEN
    IF COALESCE(v_sec.freeze_active, false) THEN RAISE EXCEPTION 'Freeze Account is active. Money movement is blocked.'; END IF;
    IF COALESCE(v_sec.sleep_mode_active, false) THEN RAISE EXCEPTION 'Sleep Mode is active. Money movement is blocked.'; END IF;
  END IF;

  SELECT * INTO v_biz
  FROM public.business_accounts
  WHERE id = p_business_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_biz.id IS NULL THEN
    RAISE EXCEPTION 'Business account not found';
  END IF;

  IF COALESCE(p_enforce_limit, false) AND v_amount > COALESCE(v_biz.transaction_limit, 5000000) THEN
    RAISE EXCEPTION 'Amount exceeds your business transaction limit';
  END IF;

  IF v_biz.balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient business balance';
  END IF;

  v_new_balance := ROUND((v_biz.balance - v_amount)::NUMERIC, 2);
  UPDATE public.business_accounts
  SET balance = v_new_balance
  WHERE id = v_biz.id;

  INSERT INTO public.business_transactions (business_id, type, description, amount, category, reference)
  VALUES (
    v_biz.id,
    'debit',
    left(coalesce(nullif(trim(p_description), ''), 'Business debit'), 160),
    v_amount,
    p_category,
    left(coalesce(nullif(trim(p_reference), ''), 'VBX'), 64)
  )
  RETURNING * INTO v_tx;

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'transaction', to_jsonb(v_tx)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.debit_business_balance_srv(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_business_balance_srv(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;



