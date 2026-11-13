-- ============================================================================
-- VEXA Security Remediation Migration (Idempotent & Non-Destructive)
-- Preserves all customer accounts, balances, transaction histories,
-- deposit addresses, business records, and admin roles.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Hash Transaction PINs & Add Server-Side PIN Lockout Tracking ──────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_phone TEXT,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS kyc_tier INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ALTER COLUMN pin SET DEFAULT '';

-- Migrate existing custom 4-digit PINs (not '0000') to pgcrypto bcrypt hashes
-- and existing custom 6-digit Business PINs (not '123456') cleanly with extensions schema in search_path
ALTER TABLE public.business_security
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

ALTER TABLE public.business_security
  ALTER COLUMN pin SET DEFAULT '';

DO $$
BEGIN
  SET LOCAL search_path = public, extensions;

  UPDATE public.profiles
  SET
    pin_hash = crypt(pin, gen_salt('bf', 10)),
    pin = ''
  WHERE pin_hash IS NULL
    AND pin ~ '^\d{4}$'
    AND pin <> '0000';

  UPDATE public.profiles
  SET pin = ''
  WHERE pin = '0000';

  UPDATE public.business_security
  SET
    pin_hash = crypt(pin, gen_salt('bf', 10)),
    pin = ''
  WHERE pin_hash IS NULL
    AND pin ~ '^\d{6}$'
    AND pin <> '123456';

  UPDATE public.business_security
  SET pin = ''
  WHERE pin = '123456';
END
$$;

-- Backend helper to verify migrated pgcrypto bcrypt hashes via service_role
CREATE OR REPLACE FUNCTION public.verify_pgcrypto_hash(p_plain TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(p_plain, '') <> ''
     AND COALESCE(p_hash, '') <> ''
     AND crypt(p_plain, p_hash) = p_hash;
$$;

REVOKE ALL ON FUNCTION public.verify_pgcrypto_hash(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pgcrypto_hash(TEXT, TEXT) TO service_role;

-- ── 2. Update Signup Trigger (No Default Plaintext '0000' PIN) ───────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc TEXT;
BEGIN
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

-- ── 3. Harden public.profiles (Column-Level Privileges + RLS + Trigger) ──────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT (
  id, name, email, phone, account_number, level, verified, balance,
  profile_photo, referral_code, created_at, two_factor_enabled,
  two_factor_phone, is_suspended, suspension_reason, kyc_tier, kyc_status
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
  USING (true)
  WITH CHECK (true);

-- Defense-in-depth trigger protecting privileged profile columns from any non-service_role update
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.pin IS DISTINCT FROM OLD.pin
     OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
     OR NEW.pin_failed_attempts IS DISTINCT FROM OLD.pin_failed_attempts
     OR NEW.pin_locked_until IS DISTINCT FROM OLD.pin_locked_until
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.kyc_tier IS DISTINCT FROM OLD.kyc_tier
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.account_number IS DISTINCT FROM OLD.account_number
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Direct modification of protected profile fields is not permitted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ── 4. Lock Down Ledger, Cashback, Referrals, Notifications, Crypto & Business RLS ──

-- Transactions: read-only for own user; mutations via service_role only
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recipient_bank TEXT,
  ADD COLUMN IF NOT EXISTS recipient_account TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_account TEXT;
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
  USING (true)
  WITH CHECK (true);

-- Cashback history: read-only for own user; mutations via service_role only
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
  USING (true)
  WITH CHECK (true);

-- Referrals: read-only for own referrer; mutations via service_role only
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
  USING (true)
  WITH CHECK (true);

-- Notifications: user can SELECT own rows and UPDATE only (read); INSERT/DELETE strictly service_role
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
  USING (true)
  WITH CHECK (true);

-- Peer transfers: read-only own rows
ALTER TABLE public.peer_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peer_transfers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.peer_transfers TO authenticated;
GRANT ALL ON public.peer_transfers TO service_role;

DROP POLICY IF EXISTS "Users can view peer transfers they sent or received" ON public.peer_transfers;
DROP POLICY IF EXISTS "Service role full access to peer_transfers" ON public.peer_transfers;
CREATE POLICY "Users can view peer transfers they sent or received"
  ON public.peer_transfers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Service role full access to peer_transfers"
  ON public.peer_transfers FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Crypto accounts, balances, transactions, deposit addresses: SELECT own rows only
ALTER TABLE public.crypto_accounts ENABLE ROW LEVEL SECURITY;
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
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.crypto_balances ENABLE ROW LEVEL SECURITY;
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
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;
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
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.crypto_deposit_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crypto_deposit_addresses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crypto_deposit_addresses TO authenticated;
GRANT ALL ON public.crypto_deposit_addresses TO service_role;
DROP POLICY IF EXISTS "Users can view own crypto deposit addresses" ON public.crypto_deposit_addresses;
DROP POLICY IF EXISTS "Service role full access to crypto_deposit_addresses" ON public.crypto_deposit_addresses;
CREATE POLICY "Users can view own crypto deposit addresses"
  ON public.crypto_deposit_addresses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to crypto_deposit_addresses"
  ON public.crypto_deposit_addresses FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.crypto_deposit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crypto_deposit_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crypto_deposit_events TO service_role;
DROP POLICY IF EXISTS "Service role full access to crypto_deposit_events" ON public.crypto_deposit_events;
CREATE POLICY "Service role full access to crypto_deposit_events"
  ON public.crypto_deposit_events FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Business tables: read-only own records for authenticated; all mutations via backend API
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
  USING (true)
  WITH CHECK (true);

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
  USING (true)
  WITH CHECK (true);

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
  USING (true)
  WITH CHECK (true);

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
  USING (true)
  WITH CHECK (true);

-- Business security: strictly backend service_role only (PIN hashes never leave server)
ALTER TABLE public.business_security ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_security FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_security TO service_role;
DROP POLICY IF EXISTS "Users can manage own business security" ON public.business_security;
DROP POLICY IF EXISTS "Service role full access to business_security" ON public.business_security;
CREATE POLICY "Service role full access to business_security"
  ON public.business_security FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 5. Lock Down Admin & Internal Tables (Fix USING (true) Without TO service_role) ──

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_roles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_roles TO service_role;
DROP POLICY IF EXISTS "Service role has full access to admin_roles" ON public.admin_roles;
CREATE POLICY "Service role has full access to admin_roles"
  ON public.admin_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kyc_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kyc_requests TO service_role;
DROP POLICY IF EXISTS "Service role has full access to kyc_requests" ON public.kyc_requests;
CREATE POLICY "Service role has full access to kyc_requests"
  ON public.kyc_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cards TO service_role;
DROP POLICY IF EXISTS "Service role has full access to cards" ON public.cards;
CREATE POLICY "Service role has full access to cards"
  ON public.cards FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.support_tickets TO service_role;
DROP POLICY IF EXISTS "Service role has full access to support_tickets" ON public.support_tickets;
CREATE POLICY "Service role has full access to support_tickets"
  ON public.support_tickets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fraud_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;
DROP POLICY IF EXISTS "Service role has full access to fraud_alerts" ON public.fraud_alerts;
CREATE POLICY "Service role has full access to fraud_alerts"
  ON public.fraud_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
DROP POLICY IF EXISTS "Service role has full access to admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Service role has full access to admin_audit_logs"
  ON public.admin_audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;
DROP POLICY IF EXISTS "Service role has full access to system_settings" ON public.system_settings;
CREATE POLICY "Service role has full access to system_settings"
  ON public.system_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_credentials TO service_role;

-- ── 6. Remove Hardcoded Admin Auto-Promotion From Sync Trigger ───────────────

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

-- ── 7. Paystack Webhook Idempotency Ledger & Atomic Credit RPC ───────────────

CREATE TABLE IF NOT EXISTS public.paystack_deposit_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference  TEXT NOT NULL UNIQUE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_ngn NUMERIC(15, 2) NOT NULL CHECK (amount_ngn > 0),
  channel    TEXT NOT NULL DEFAULT 'paystack',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paystack_deposit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paystack_deposit_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.paystack_deposit_events TO service_role;

DROP POLICY IF EXISTS "Service role full access to paystack_deposit_events" ON public.paystack_deposit_events;
CREATE POLICY "Service role full access to paystack_deposit_events"
  ON public.paystack_deposit_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.process_paystack_deposit(
  p_reference TEXT,
  p_user_id UUID,
  p_amount_ngn NUMERIC,
  p_channel TEXT DEFAULT 'paystack'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id UUID;
  new_bal NUMERIC;
BEGIN
  IF p_reference IS NULL OR trim(p_reference) = '' OR p_user_id IS NULL OR p_amount_ngn IS NULL OR p_amount_ngn <= 0 THEN
    RAISE EXCEPTION 'Invalid Paystack deposit parameters';
  END IF;

  INSERT INTO public.paystack_deposit_events (reference, user_id, amount_ngn, channel)
  VALUES (trim(p_reference), p_user_id, p_amount_ngn, COALESCE(NULLIF(trim(p_channel), ''), 'paystack'))
  ON CONFLICT (reference) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  UPDATE public.profiles
  SET balance = balance + p_amount_ngn
  WHERE id = p_user_id
  RETURNING balance INTO new_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user profile not found';
  END IF;

  INSERT INTO public.transactions (user_id, type, name, amount, note)
  VALUES (p_user_id, 'in', 'Wallet Deposit (Paystack)', p_amount_ngn, 'Paystack Ref: ' || trim(p_reference));

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    p_user_id,
    'credit',
    'Deposit received',
    '₦' || to_char(p_amount_ngn, 'FM999G999G999G990D00') || ' added to your Vexa wallet.',
    false
  );

  RETURN jsonb_build_object('status', 'credited', 'balance', new_bal);
END;
$$;

REVOKE ALL ON FUNCTION public.process_paystack_deposit(TEXT, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_paystack_deposit(TEXT, UUID, NUMERIC, TEXT) TO service_role;

-- ── 8. Revoke Client Execution of Legacy Direct RPCs & Create _srv RPCs ──────

DO $$
BEGIN
  IF to_regprocedure('public.transfer_vexa_money(text,numeric,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.transfer_vexa_money(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.transfer_vexa_money(TEXT, NUMERIC, TEXT, TEXT) TO service_role';
  END IF;
  IF to_regprocedure('public.deposit_to_crypto(numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.deposit_to_crypto(NUMERIC) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.deposit_to_crypto(NUMERIC) TO service_role';
  END IF;
  IF to_regprocedure('public.exchange_crypto(text,text,numeric,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.exchange_crypto(TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.exchange_crypto(TEXT, TEXT, NUMERIC, NUMERIC) TO service_role';
  END IF;
  IF to_regprocedure('public.transfer_crypto(text,text,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.transfer_crypto(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.transfer_crypto(TEXT, TEXT, NUMERIC) TO service_role';
  END IF;
  IF to_regprocedure('public.redeem_cashback()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.redeem_cashback() FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.redeem_cashback() TO service_role';
  END IF;
  IF to_regprocedure('public.complete_bank_transfer(numeric,text,text,text,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.complete_bank_transfer(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_bank_transfer(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role';
  END IF;
END
$$;

-- Server-only atomic cashback redemption
CREATE OR REPLACE FUNCTION public.redeem_cashback_srv(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redeemed NUMERIC := 0;
  v_new_balance NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required';
  END IF;

  SELECT COALESCE(SUM(GREATEST(earned, 0)), 0)
  INTO v_redeemed
  FROM public.cashback_history
  WHERE user_id = p_user_id AND status = 'cleared'
  FOR UPDATE;

  IF v_redeemed <= 0 THEN
    RAISE EXCEPTION 'No cleared cashback available to redeem';
  END IF;

  UPDATE public.cashback_history
  SET status = 'redeemed'
  WHERE user_id = p_user_id AND status = 'cleared';

  UPDATE public.profiles
  SET balance = balance + v_redeemed
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (user_id, type, name, amount, note)
  VALUES (p_user_id, 'in', 'Cashback Redemption', v_redeemed, 'Redeemed cleared cashback rewards to Vexa balance');

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    p_user_id,
    'credit',
    'Cashback Redeemed',
    '₦' || to_char(v_redeemed, 'FM999G999G999G990D00') || ' cashback was added to your Vexa balance.',
    false
  );

  RETURN jsonb_build_object('balance', v_new_balance, 'redeemed', v_redeemed);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_cashback_srv(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_cashback_srv(UUID) TO service_role;

-- Server-only atomic bank transfer (PIN verified by backend prior to call)
CREATE OR REPLACE FUNCTION public.complete_bank_transfer_srv(
  p_user_id UUID,
  p_amount NUMERIC,
  p_recipient_name TEXT,
  p_recipient_bank TEXT,
  p_recipient_account TEXT,
  p_note TEXT DEFAULT 'Transfer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender public.profiles;
  v_fee NUMERIC := 10.75;
  v_total NUMERIC;
  v_tx public.transactions;
  v_note TEXT := left(coalesce(nullif(trim(p_note), ''), 'Transfer'), 120);
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a valid transfer amount';
  END IF;

  SELECT * INTO sender FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF sender.id IS NULL THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  v_total := p_amount + v_fee;
  IF sender.balance < v_total THEN
    RAISE EXCEPTION 'Insufficient Vexa balance (including ₦10.75 fee)';
  END IF;

  UPDATE public.profiles
  SET balance = balance - v_total
  WHERE id = p_user_id;

  INSERT INTO public.transactions (
    user_id, type, name, amount, note, recipient_bank, recipient_account, sender_name, sender_account
  )
  VALUES (
    p_user_id, 'out', p_recipient_name, p_amount, v_note,
    p_recipient_bank, p_recipient_account, sender.name, sender.account_number
  )
  RETURNING * INTO v_tx;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    p_user_id,
    'debit',
    'Bank transfer sent',
    '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' sent to ' || p_recipient_name || ' (' || p_recipient_bank || ').',
    false
  );

  RETURN to_jsonb(v_tx);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_bank_transfer_srv(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_bank_transfer_srv(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Server-only atomic Vexa-to-Vexa transfer
CREATE OR REPLACE FUNCTION public.transfer_vexa_money_srv(
  p_sender_id UUID,
  p_recipient_account TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT ''
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
  clean_account TEXT := trim(p_recipient_account);
  clean_note TEXT := left(coalesce(p_note, ''), 120);
BEGIN
  IF p_sender_id IS NULL THEN RAISE EXCEPTION 'Sender required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid transfer amount'; END IF;

  SELECT * INTO sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  SELECT * INTO recipient FROM public.profiles WHERE account_number = clean_account FOR UPDATE;

  IF sender.id IS NULL THEN RAISE EXCEPTION 'Sender profile was not found'; END IF;
  IF recipient.id IS NULL THEN RAISE EXCEPTION 'No Vexa user was found for that account number'; END IF;
  IF sender.id = recipient.id THEN RAISE EXCEPTION 'You cannot transfer money to your own account'; END IF;
  IF sender.balance < p_amount THEN RAISE EXCEPTION 'Insufficient Vexa balance'; END IF;

  UPDATE public.profiles SET balance = balance - p_amount WHERE id = sender.id;
  UPDATE public.profiles SET balance = balance + p_amount WHERE id = recipient.id;

  INSERT INTO public.peer_transfers (sender_id, recipient_id, amount, note)
  VALUES (sender.id, recipient.id, p_amount, clean_note)
  RETURNING id INTO peer_id;

  INSERT INTO public.transactions (
    user_id, type, name, amount, note, recipient_bank, recipient_account, sender_name, sender_account
  )
  VALUES (
    sender.id, 'out', recipient.name, p_amount,
    CASE WHEN clean_note = '' THEN 'Vexa-to-Vexa transfer' ELSE clean_note END,
    'Vexa', recipient.account_number, sender.name, sender.account_number
  )
  RETURNING id INTO debit_id;

  INSERT INTO public.transactions (
    user_id, type, name, amount, note, recipient_bank, recipient_account, sender_name, sender_account
  )
  VALUES (
    recipient.id, 'in', sender.name, p_amount,
    CASE WHEN clean_note = '' THEN 'Received from Vexa user' ELSE clean_note END,
    'Vexa', recipient.account_number, sender.name, sender.account_number
  );

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES
    (sender.id, 'debit', 'Vexa transfer sent',
      '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' sent to ' || recipient.name, false),
    (recipient.id, 'credit', 'Money received',
      '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' received from ' || sender.name, false);

  RETURN jsonb_build_object(
    'peer_transfer_id', peer_id,
    'transaction_id', debit_id,
    'recipient_name', recipient.name,
    'recipient_account', recipient.account_number,
    'amount', p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_vexa_money_srv(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_vexa_money_srv(UUID, TEXT, NUMERIC, TEXT) TO service_role;

-- Server-only atomic Exchange Naira deposit
CREATE OR REPLACE FUNCTION public.deposit_to_crypto_srv(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet public.crypto_accounts;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid deposit amount'; END IF;

  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient Vexa balance'; END IF;

  INSERT INTO public.crypto_accounts (user_id, naira_balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET naira_balance = public.crypto_accounts.naira_balance + EXCLUDED.naira_balance
  RETURNING * INTO wallet;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, naira_amount, note)
  VALUES (p_user_id, 'deposit', 'NGN', p_amount, p_amount, 'Funded from Vexa balance');

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    p_user_id,
    'crypto',
    'Exchange wallet funded',
    '₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' moved from your Vexa balance to your Exchange wallet.',
    false
  );

  RETURN jsonb_build_object('naira_balance', wallet.naira_balance, 'notified', true);
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_to_crypto_srv(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_to_crypto_srv(UUID, NUMERIC) TO service_role;

-- Server-only atomic Crypto buy/sell (authoritative server-side rate supplied by backend oracle)
CREATE OR REPLACE FUNCTION public.exchange_crypto_srv(
  p_user_id UUID,
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
  wallet public.crypto_accounts;
  current_asset NUMERIC;
  crypto_amount NUMERIC;
  formatted_crypto TEXT;
  formatted_naira TEXT;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID required'; END IF;
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') THEN RAISE EXCEPTION 'Unsupported asset'; END IF;
  IF p_side NOT IN ('buy', 'sell') THEN RAISE EXCEPTION 'Unsupported exchange side'; END IF;
  IF p_naira_amount IS NULL OR p_naira_amount <= 0 OR p_rate IS NULL OR p_rate <= 0 THEN
    RAISE EXCEPTION 'Enter a valid exchange amount';
  END IF;

  INSERT INTO public.crypto_accounts (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = p_user_id FOR UPDATE;

  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (p_user_id, p_asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;
  SELECT amount INTO current_asset
  FROM public.crypto_balances
  WHERE user_id = p_user_id AND asset = p_asset
  FOR UPDATE;

  crypto_amount := p_naira_amount / p_rate;
  IF p_side = 'buy' THEN
    IF wallet.naira_balance < p_naira_amount THEN RAISE EXCEPTION 'Insufficient exchange Naira balance'; END IF;
    UPDATE public.crypto_accounts SET naira_balance = naira_balance - p_naira_amount WHERE user_id = p_user_id;
    UPDATE public.crypto_balances SET amount = amount + crypto_amount, updated_at = now()
    WHERE user_id = p_user_id AND asset = p_asset;
  ELSE
    IF current_asset < crypto_amount THEN RAISE EXCEPTION 'Insufficient crypto balance'; END IF;
    UPDATE public.crypto_accounts SET naira_balance = naira_balance + p_naira_amount WHERE user_id = p_user_id;
    UPDATE public.crypto_balances SET amount = amount - crypto_amount, updated_at = now()
    WHERE user_id = p_user_id AND asset = p_asset;
  END IF;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, naira_amount, rate, note)
  VALUES (p_user_id, p_side, p_asset, crypto_amount, p_naira_amount, p_rate,
    CASE WHEN p_side = 'buy' THEN 'Bought with exchange balance' ELSE 'Sold to exchange balance' END);

  formatted_crypto := regexp_replace(to_char(ROUND(crypto_amount, 8), 'FM999G999G990.00000000'), '\.?0+$', '');
  formatted_naira := to_char(p_naira_amount, 'FM999G999G999G990D00');

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    p_user_id,
    'crypto',
    CASE WHEN p_side = 'buy' THEN p_asset || ' purchase successful' ELSE p_asset || ' sale successful' END,
    CASE
      WHEN p_side = 'buy' THEN 'Bought ' || formatted_crypto || ' ' || p_asset || ' for ₦' || formatted_naira || '.'
      ELSE 'Sold ' || formatted_crypto || ' ' || p_asset || ' for ₦' || formatted_naira || ' to your Exchange balance.'
    END,
    false
  );

  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = p_user_id;
  RETURN jsonb_build_object('asset_amount', crypto_amount, 'naira_balance', wallet.naira_balance, 'notified', true);
END;
$$;

REVOKE ALL ON FUNCTION public.exchange_crypto_srv(UUID, TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_crypto_srv(UUID, TEXT, TEXT, NUMERIC, NUMERIC) TO service_role;

-- Server-only atomic Crypto transfer between Vexa users
CREATE OR REPLACE FUNCTION public.transfer_crypto_srv(
  p_sender_id UUID,
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
  sender public.profiles;
  recipient public.profiles;
  current_asset NUMERIC;
  clean_account TEXT := trim(p_recipient_account);
  formatted_crypto TEXT;
BEGIN
  IF p_sender_id IS NULL THEN RAISE EXCEPTION 'Sender required'; END IF;
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') THEN RAISE EXCEPTION 'Unsupported asset'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid crypto amount'; END IF;

  SELECT * INTO sender FROM public.profiles WHERE id = p_sender_id;
  SELECT * INTO recipient FROM public.profiles WHERE account_number = clean_account FOR UPDATE;
  IF recipient.id IS NULL THEN RAISE EXCEPTION 'No Vexa user was found for that account number'; END IF;
  IF recipient.id = p_sender_id THEN RAISE EXCEPTION 'You cannot transfer to your own account'; END IF;

  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (p_sender_id, p_asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;
  INSERT INTO public.crypto_balances (user_id, asset, amount)
  VALUES (recipient.id, p_asset, 0)
  ON CONFLICT (user_id, asset) DO NOTHING;

  SELECT amount INTO current_asset FROM public.crypto_balances
  WHERE user_id = p_sender_id AND asset = p_asset FOR UPDATE;
  IF current_asset < p_amount THEN RAISE EXCEPTION 'Insufficient crypto balance'; END IF;

  UPDATE public.crypto_balances SET amount = amount - p_amount, updated_at = now()
  WHERE user_id = p_sender_id AND asset = p_asset;
  UPDATE public.crypto_balances SET amount = amount + p_amount, updated_at = now()
  WHERE user_id = recipient.id AND asset = p_asset;

  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, counterparty_account, note)
  VALUES
    (p_sender_id, 'transfer_out', p_asset, p_amount, recipient.account_number, 'Crypto sent to Vexa user'),
    (recipient.id, 'transfer_in', p_asset, p_amount, sender.account_number, 'Crypto received from Vexa user');

  formatted_crypto := regexp_replace(to_char(ROUND(p_amount, 8), 'FM999G999G990.00000000'), '\.?0+$', '');
  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES
    (p_sender_id, 'crypto', p_asset || ' transfer sent',
      formatted_crypto || ' ' || p_asset || ' sent to ' || recipient.name || ' (' || recipient.account_number || ').', false),
    (recipient.id, 'crypto', p_asset || ' received',
      formatted_crypto || ' ' || p_asset || ' received from ' || COALESCE(sender.name, 'Vexa user') || '.', false);

  RETURN jsonb_build_object('recipient_name', recipient.name, 'recipient_account', recipient.account_number, 'notified', true);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_crypto_srv(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_crypto_srv(UUID, TEXT, TEXT, NUMERIC) TO service_role;

-- ── 9. Harden process_tatum_crypto_deposit & Audit All SECURITY DEFINER RPCs ──

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

-- ── 10. Distributed Security Tables, Atomic Telecom/Business RPCs & Full Lockdown ──

-- Fix redeem_cashback_srv (lock rows with FOR UPDATE before summing)
CREATE OR REPLACE FUNCTION public.redeem_cashback_srv(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_cb RECORD;
  v_redeemed NUMERIC := 0;
  v_new_balance NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  FOR v_cb IN
    SELECT id, earned
    FROM public.cashback_history
    WHERE user_id = p_user_id AND status = 'cleared'
    FOR UPDATE
  LOOP
    v_redeemed := ROUND((v_redeemed + GREATEST(0, COALESCE(v_cb.earned, 0)))::NUMERIC, 2);
  END LOOP;

  IF v_redeemed <= 0 THEN
    RAISE EXCEPTION 'No cleared cashback available to redeem';
  END IF;

  UPDATE public.cashback_history
  SET status = 'redeemed'
  WHERE user_id = p_user_id AND status = 'cleared';

  UPDATE public.profiles
  SET balance = balance + v_redeemed
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (user_id, type, name, amount, note)
  VALUES (p_user_id, 'in', 'Cashback Redemption', v_redeemed, 'Redeemed cleared cashback rewards to Vexa balance');

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    p_user_id,
    'credit',
    'Cashback Redeemed',
    '₦' || to_char(v_redeemed, 'FM999G999G999G990D00') || ' cashback was added to your Vexa balance.',
    false
  );

  RETURN jsonb_build_object('balance', v_new_balance, 'redeemed', v_redeemed);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_cashback_srv(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_cashback_srv(UUID) TO service_role;

-- Distributed rate-limit bucket storage (persists across Cloud Run instances & restarts)
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

-- Distributed SHA-256 hashed ephemeral session/challenge store (Admin 2FA, OTP, Reset tokens)
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

-- Atomic single-transaction telecom airtime/data settlement
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

-- Atomic single-transaction business debit (payroll, transfers, business bills)
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

-- Defense-in-depth: 100% deny-by-default lockdown of EVERY SECURITY DEFINER
-- function in public schema (now including check_login_lockout,
-- record_login_failure, and clear_login_lockout since login is server-proxied).
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      p.oid::regprocedure AS sig,
      p.proname,
      pg_catalog.pg_get_function_result(p.oid) AS return_type
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
      IF fn.return_type NOT IN ('trigger', 'event_trigger') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN
        IF fn.return_type = 'event_trigger' THEN
          RAISE NOTICE 'Skipped event trigger % due to ownership', fn.sig;
        ELSE
          RAISE;
        END IF;
    END;
  END LOOP;
END
$$;

-- Verification output: compact permission columns first so they are immediately
-- visible on mobile screens without horizontal scrolling.
SELECT
  p.proname AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS srv,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

