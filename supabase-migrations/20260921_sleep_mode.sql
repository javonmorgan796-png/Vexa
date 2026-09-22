-- Sleep Mode and emergency account freeze.
-- Run this migration in Supabase SQL Editor after the existing schema.

CREATE TABLE IF NOT EXISTS public.account_security_state (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sleep_mode_active BOOLEAN NOT NULL DEFAULT false,
  sleep_mode_activated_at TIMESTAMPTZ,
  sleep_mode_device_name TEXT,
  sleep_mode_device_type TEXT,
  freeze_active BOOLEAN NOT NULL DEFAULT false,
  freeze_activated_at TIMESTAMPTZ,
  freeze_device_name TEXT,
  freeze_device_type TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('sleep_mode', 'freeze_account')),
  device_name TEXT NOT NULL DEFAULT 'Unknown device',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  ip_address TEXT NOT NULL DEFAULT '',
  location TEXT,
  auth_method TEXT NOT NULL DEFAULT 'session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_audit_log_user_created_idx
  ON public.security_audit_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.security_verification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.account_security_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.security_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.security_verification_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_security_state TO service_role;
GRANT ALL ON public.security_audit_log TO service_role;
GRANT ALL ON public.security_verification_challenges TO service_role;

ALTER TABLE public.account_security_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_verification_challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.account_money_movement_allowed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.account_security_state
    WHERE user_id = p_user_id
      AND (sleep_mode_active OR freeze_active)
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_account_can_move_money(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  security_row public.account_security_state;
BEGIN
  SELECT * INTO security_row
  FROM public.account_security_state
  WHERE user_id = p_user_id;

  IF security_row.freeze_active THEN
    RAISE EXCEPTION 'Account is frozen. Money movement is disabled until the freeze is removed.';
  END IF;
  IF security_row.sleep_mode_active THEN
    RAISE EXCEPTION 'Sleep Mode is active. Money movement is temporarily disabled.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_account_security_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  state_row public.account_security_state;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;

  INSERT INTO public.account_security_state (user_id)
  VALUES (current_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO state_row
  FROM public.account_security_state
  WHERE user_id = current_user_id;

  RETURN jsonb_build_object(
    'sleep_mode_active', state_row.sleep_mode_active,
    'sleep_mode_activated_at', state_row.sleep_mode_activated_at,
    'sleep_mode_device_name', state_row.sleep_mode_device_name,
    'sleep_mode_device_type', state_row.sleep_mode_device_type,
    'freeze_active', state_row.freeze_active,
    'freeze_activated_at', state_row.freeze_activated_at,
    'freeze_device_name', state_row.freeze_device_name,
    'freeze_device_type', state_row.freeze_device_type,
    'updated_at', state_row.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_security_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_account_security_lock(
  p_user_id UUID,
  p_lock_type TEXT,
  p_enabled BOOLEAN,
  p_device_name TEXT DEFAULT 'Unknown device',
  p_device_type TEXT DEFAULT 'unknown',
  p_ip_address TEXT DEFAULT '',
  p_location TEXT DEFAULT NULL,
  p_auth_method TEXT DEFAULT 'session'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  state_row public.account_security_state;
  action_name TEXT;
  lock_label TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  IF p_user_id IS NULL OR p_lock_type NOT IN ('sleep_mode', 'freeze_account') THEN
    RAISE EXCEPTION 'Invalid account security request';
  END IF;

  INSERT INTO public.account_security_state (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO state_row
  FROM public.account_security_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  action_name := CASE WHEN p_enabled THEN 'activated' ELSE 'deactivated' END;
  lock_label := CASE WHEN p_lock_type = 'sleep_mode' THEN 'Sleep Mode' ELSE 'Freeze Account' END;

  IF p_lock_type = 'sleep_mode' THEN
    UPDATE public.account_security_state
    SET sleep_mode_active = p_enabled,
        sleep_mode_activated_at = CASE WHEN p_enabled THEN NOW() ELSE NULL END,
        sleep_mode_device_name = CASE WHEN p_enabled THEN left(coalesce(p_device_name, 'Unknown device'), 120) ELSE NULL END,
        sleep_mode_device_type = CASE WHEN p_enabled THEN left(coalesce(p_device_type, 'unknown'), 40) ELSE NULL END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.account_security_state
    SET freeze_active = p_enabled,
        freeze_activated_at = CASE WHEN p_enabled THEN NOW() ELSE NULL END,
        freeze_device_name = CASE WHEN p_enabled THEN left(coalesce(p_device_name, 'Unknown device'), 120) ELSE NULL END,
        freeze_device_type = CASE WHEN p_enabled THEN left(coalesce(p_device_type, 'unknown'), 40) ELSE NULL END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.security_audit_log (
    user_id, action, lock_type, device_name, device_type, ip_address, location, auth_method
  )
  VALUES (
    p_user_id, action_name, p_lock_type,
    left(coalesce(p_device_name, 'Unknown device'), 120),
    left(coalesce(p_device_type, 'unknown'), 40),
    left(coalesce(p_ip_address, ''), 120),
    nullif(left(coalesce(p_location, ''), 160), ''),
    left(coalesce(p_auth_method, 'session'), 40)
  );

  notification_title := CASE WHEN p_enabled THEN lock_label || ' activated' ELSE lock_label || ' deactivated' END;
  notification_body := CASE
    WHEN p_enabled THEN lock_label || ' was activated on ' || left(coalesce(p_device_name, 'this device'), 120) || '. Money movement is now blocked.'
    ELSE lock_label || ' was deactivated after strong authentication. Money movement is available again.'
  END;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (p_user_id, 'security', notification_title, notification_body);

  SELECT * INTO state_row
  FROM public.account_security_state
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'sleep_mode_active', state_row.sleep_mode_active,
    'sleep_mode_activated_at', state_row.sleep_mode_activated_at,
    'freeze_active', state_row.freeze_active,
    'freeze_activated_at', state_row.freeze_activated_at,
    'action', action_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_account_security_lock(
  UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_security_verification(
  p_user_id UUID,
  p_purpose TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_id UUID;
BEGIN
  SELECT id INTO challenge_id
  FROM public.security_verification_challenges
  WHERE user_id = p_user_id
    AND purpose = p_purpose
    AND consumed_at IS NULL
    AND expires_at > NOW()
  ORDER BY verified_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF challenge_id IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.security_verification_challenges
  SET consumed_at = NOW()
  WHERE id = challenge_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_security_verification(UUID, TEXT) TO service_role;

-- These triggers are the database-side backstop for crafted client requests.
-- Read access remains available; writes that can move money are blocked while
-- either security lock is active.
CREATE OR REPLACE FUNCTION public.prevent_locked_money_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'UPDATE' AND NEW.balance IS DISTINCT FROM OLD.balance THEN
      target_user_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME IN ('transactions', 'crypto_accounts', 'crypto_balances', 'crypto_transactions') THEN
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'business_accounts' THEN
    target_user_id := COALESCE(NEW.owner_id, OLD.owner_id);
  ELSIF TG_TABLE_NAME = 'business_transactions' THEN
    SELECT owner_id INTO target_user_id
    FROM public.business_accounts
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);
  END IF;

  IF target_user_id IS NOT NULL AND NOT public.account_money_movement_allowed(target_user_id) THEN
    RAISE EXCEPTION 'Account is locked. Money movement is disabled.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_locked_money_guard ON public.profiles;
CREATE TRIGGER profiles_locked_money_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

DROP TRIGGER IF EXISTS transactions_locked_money_guard ON public.transactions;
CREATE TRIGGER transactions_locked_money_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

DROP TRIGGER IF EXISTS crypto_accounts_locked_money_guard ON public.crypto_accounts;
CREATE TRIGGER crypto_accounts_locked_money_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.crypto_accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

DROP TRIGGER IF EXISTS crypto_balances_locked_money_guard ON public.crypto_balances;
CREATE TRIGGER crypto_balances_locked_money_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.crypto_balances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

DROP TRIGGER IF EXISTS crypto_transactions_locked_money_guard ON public.crypto_transactions;
CREATE TRIGGER crypto_transactions_locked_money_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.crypto_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

DROP TRIGGER IF EXISTS business_accounts_locked_money_guard ON public.business_accounts;
CREATE TRIGGER business_accounts_locked_money_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

DROP TRIGGER IF EXISTS business_transactions_locked_money_guard ON public.business_transactions;
CREATE TRIGGER business_transactions_locked_money_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.business_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_money_movement();

CREATE OR REPLACE FUNCTION public.redeem_cashback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  total_amount NUMERIC(15, 2);
  new_balance NUMERIC(15, 2);
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  PERFORM public.assert_account_can_move_money(current_user_id);

  SELECT balance INTO new_balance
  FROM public.profiles
  WHERE id = current_user_id
  FOR UPDATE;

  SELECT COALESCE(SUM(earned), 0) INTO total_amount
  FROM public.cashback_history
  WHERE user_id = current_user_id AND status = 'cleared';

  IF total_amount <= 0 THEN
    RETURN jsonb_build_object('redeemed', 0, 'balance', new_balance);
  END IF;

  UPDATE public.profiles
  SET balance = balance + total_amount
  WHERE id = current_user_id;

  UPDATE public.cashback_history
  SET status = 'redeemed'
  WHERE user_id = current_user_id AND status = 'cleared';

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (current_user_id, 'credit', 'Cashback redeemed',
    '₦' || to_char(total_amount, 'FM999G999G999G990D00') || ' cashback was added to your Vexa balance.');

  RETURN jsonb_build_object('redeemed', total_amount, 'balance', new_balance + total_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_cashback() TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_bank_transfer(
  p_amount NUMERIC,
  p_pin TEXT,
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
  current_user_id UUID := auth.uid();
  account public.profiles;
  transaction_row public.transactions;
  clean_note TEXT := left(coalesce(p_note, 'Transfer'), 120);
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid transfer amount'; END IF;
  PERFORM public.assert_account_can_move_money(current_user_id);

  SELECT * INTO account
  FROM public.profiles
  WHERE id = current_user_id
  FOR UPDATE;

  IF account.id IS NULL THEN RAISE EXCEPTION 'Your profile was not found'; END IF;
  IF account.pin = '0000' THEN RAISE EXCEPTION 'Set your transaction PIN before sending money'; END IF;
  IF account.pin <> p_pin THEN RAISE EXCEPTION 'Incorrect transaction PIN'; END IF;
  IF account.balance < p_amount THEN RAISE EXCEPTION 'Insufficient Vexa balance'; END IF;

  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = current_user_id;

  INSERT INTO public.transactions (
    user_id, type, name, amount, note, recipient_bank, recipient_account,
    sender_name, sender_account
  )
  VALUES (
    current_user_id, 'out', left(coalesce(p_recipient_name, 'Bank recipient'), 160), p_amount,
    clean_note, left(coalesce(p_recipient_bank, ''), 120), left(coalesce(p_recipient_account, ''), 40),
    account.name, account.account_number
  )
  RETURNING * INTO transaction_row;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (current_user_id, 'debit', 'Transfer Successful',
    'Transfer of ₦' || to_char(p_amount, 'FM999G999G999G990D00') || ' to ' ||
    left(coalesce(p_recipient_name, 'the bank recipient'), 160) || ' was successful.');

  RETURN jsonb_build_object(
    'id', transaction_row.id,
    'type', transaction_row.type,
    'name', transaction_row.name,
    'amount', transaction_row.amount,
    'note', transaction_row.note,
    'recipient_bank', transaction_row.recipient_bank,
    'recipient_account', transaction_row.recipient_account,
    'sender_name', transaction_row.sender_name,
    'sender_account', transaction_row.sender_account,
    'created_at', transaction_row.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_bank_transfer(
  NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Guard the existing authenticated RPCs as well. Their existing atomic
-- implementations remain unchanged; these checks fail before any write.
CREATE OR REPLACE FUNCTION public.deposit_to_crypto(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_user_id UUID := auth.uid();
  wallet public.crypto_accounts;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid deposit amount'; END IF;
  PERFORM public.assert_account_can_move_money(current_user_id);
  UPDATE public.profiles SET balance = balance - p_amount
    WHERE id = current_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient Vexa balance'; END IF;
  INSERT INTO public.crypto_accounts (user_id, naira_balance) VALUES (current_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET naira_balance = public.crypto_accounts.naira_balance + EXCLUDED.naira_balance
    RETURNING * INTO wallet;
  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, naira_amount, note)
    VALUES (current_user_id, 'deposit', 'NGN', p_amount, p_amount, 'Funded from Vexa balance');
  RETURN jsonb_build_object('naira_balance', wallet.naira_balance);
END; $$;

CREATE OR REPLACE FUNCTION public.exchange_crypto(
  p_asset TEXT, p_side TEXT, p_naira_amount NUMERIC, p_rate NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  PERFORM public.assert_account_can_move_money(current_user_id);
  INSERT INTO public.crypto_accounts (user_id) VALUES (current_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = current_user_id FOR UPDATE;
  INSERT INTO public.crypto_balances (user_id, asset, amount) VALUES (current_user_id, p_asset, 0)
    ON CONFLICT (user_id, asset) DO NOTHING;
  SELECT amount INTO current_asset FROM public.crypto_balances
    WHERE user_id = current_user_id AND asset = p_asset FOR UPDATE;
  crypto_amount := p_naira_amount / p_rate;
  IF p_side = 'buy' THEN
    IF wallet.naira_balance < p_naira_amount THEN RAISE EXCEPTION 'Insufficient exchange Naira balance'; END IF;
    UPDATE public.crypto_accounts SET naira_balance = naira_balance - p_naira_amount WHERE user_id = current_user_id;
    UPDATE public.crypto_balances SET amount = amount + crypto_amount, updated_at = NOW()
      WHERE user_id = current_user_id AND asset = p_asset;
  ELSE
    IF current_asset < crypto_amount THEN RAISE EXCEPTION 'Insufficient crypto balance'; END IF;
    UPDATE public.crypto_accounts SET naira_balance = naira_balance + p_naira_amount WHERE user_id = current_user_id;
    UPDATE public.crypto_balances SET amount = amount - crypto_amount, updated_at = NOW()
      WHERE user_id = current_user_id AND asset = p_asset;
  END IF;
  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, naira_amount, rate, note)
    VALUES (current_user_id, p_side, p_asset, crypto_amount, p_naira_amount, p_rate,
      CASE WHEN p_side = 'buy' THEN 'Bought with exchange balance' ELSE 'Sold to exchange balance' END);
  SELECT * INTO wallet FROM public.crypto_accounts WHERE user_id = current_user_id;
  RETURN jsonb_build_object('asset_amount', crypto_amount, 'naira_balance', wallet.naira_balance);
END; $$;

CREATE OR REPLACE FUNCTION public.transfer_crypto(
  p_recipient_account TEXT, p_asset TEXT, p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_user_id UUID := auth.uid();
  recipient public.profiles;
  current_asset NUMERIC;
  clean_account TEXT := trim(p_recipient_account);
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') THEN RAISE EXCEPTION 'Unsupported asset'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid crypto amount'; END IF;
  PERFORM public.assert_account_can_move_money(current_user_id);
  SELECT * INTO recipient FROM public.profiles WHERE account_number = clean_account FOR UPDATE;
  IF recipient.id IS NULL THEN RAISE EXCEPTION 'No Vexa user was found for that account number'; END IF;
  IF recipient.id = current_user_id THEN RAISE EXCEPTION 'You cannot transfer to your own account'; END IF;
  PERFORM public.assert_account_can_move_money(recipient.id);
  INSERT INTO public.crypto_balances (user_id, asset, amount) VALUES (current_user_id, p_asset, 0)
    ON CONFLICT (user_id, asset) DO NOTHING;
  INSERT INTO public.crypto_balances (user_id, asset, amount) VALUES (recipient.id, p_asset, 0)
    ON CONFLICT (user_id, asset) DO NOTHING;
  SELECT amount INTO current_asset FROM public.crypto_balances
    WHERE user_id = current_user_id AND asset = p_asset FOR UPDATE;
  IF current_asset < p_amount THEN RAISE EXCEPTION 'Insufficient crypto balance'; END IF;
  UPDATE public.crypto_balances SET amount = amount - p_amount, updated_at = NOW()
    WHERE user_id = current_user_id AND asset = p_asset;
  UPDATE public.crypto_balances SET amount = amount + p_amount, updated_at = NOW()
    WHERE user_id = recipient.id AND asset = p_asset;
  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, counterparty_account, note)
    VALUES
      (current_user_id, 'transfer_out', p_asset, p_amount, recipient.account_number, 'Crypto sent to Vexa user'),
      (recipient.id, 'transfer_in', p_asset, p_amount,
        (SELECT account_number FROM public.profiles WHERE id = current_user_id), 'Crypto received from Vexa user');
  RETURN jsonb_build_object('recipient_name', recipient.name, 'recipient_account', recipient.account_number);
END; $$;

CREATE OR REPLACE FUNCTION public.process_tatum_crypto_deposit(
  p_deposit_reference TEXT, p_user_id UUID, p_asset TEXT, p_network TEXT,
  p_address TEXT, p_transaction_hash TEXT, p_amount NUMERIC,
  p_confirmations INTEGER, p_required_confirmations INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deposit_event public.crypto_deposit_events;
BEGIN
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') OR p_amount IS NULL OR p_amount <= 0 THEN
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
  IF deposit_event.status = 'credited' THEN RETURN jsonb_build_object('status', 'already_processed'); END IF;
  IF deposit_event.confirmations < deposit_event.required_confirmations THEN
    RETURN jsonb_build_object('status', 'pending', 'confirmations', deposit_event.confirmations,
      'required_confirmations', deposit_event.required_confirmations);
  END IF;
  IF NOT public.account_money_movement_allowed(deposit_event.user_id) THEN
    RETURN jsonb_build_object('status', 'blocked_sleep_mode');
  END IF;
  INSERT INTO public.crypto_balances (user_id, asset, amount) VALUES (deposit_event.user_id, deposit_event.asset, 0)
    ON CONFLICT (user_id, asset) DO NOTHING;
  UPDATE public.crypto_balances SET amount = amount + deposit_event.amount, updated_at = NOW()
    WHERE user_id = deposit_event.user_id AND asset = deposit_event.asset;
  INSERT INTO public.crypto_transactions (user_id, kind, asset, amount, note)
    VALUES (deposit_event.user_id, 'deposit', deposit_event.asset, deposit_event.amount,
      'Confirmed blockchain deposit ' || deposit_event.transaction_hash);
  UPDATE public.crypto_deposit_events SET status = 'credited', credited_at = NOW() WHERE id = deposit_event.id;
  RETURN jsonb_build_object('status', 'credited');
END; $$;

GRANT EXECUTE ON FUNCTION public.deposit_to_crypto(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_crypto(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_crypto(TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_tatum_crypto_deposit(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER
) TO service_role;