-- Production Tatum deposit subscriptions and idempotent credits.
-- Run this migration in the Vexa Supabase SQL editor before enabling
-- production webhook processing.

ALTER TABLE public.crypto_deposit_addresses
  ADD COLUMN IF NOT EXISTS tatum_subscription_id TEXT UNIQUE;
ALTER TABLE public.crypto_deposit_addresses
  ADD COLUMN IF NOT EXISTS tatum_subscription_status TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.crypto_deposit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  amount NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  confirmations INTEGER NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  required_confirmations INTEGER NOT NULL CHECK (required_confirmations > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMPTZ
);

ALTER TABLE public.crypto_deposit_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crypto_deposit_events TO service_role;

CREATE OR REPLACE FUNCTION public.process_tatum_crypto_deposit(
  p_deposit_reference TEXT, p_user_id UUID, p_asset TEXT, p_network TEXT,
  p_address TEXT, p_transaction_hash TEXT, p_amount NUMERIC,
  p_confirmations INTEGER, p_required_confirmations INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deposit_event public.crypto_deposit_events;
BEGIN
  IF p_asset NOT IN ('BTC', 'ETH', 'USDT') OR p_amount IS NULL OR p_amount <= 0
    OR p_confirmations IS NULL OR p_required_confirmations IS NULL
    OR p_required_confirmations <= 0 THEN
    RAISE EXCEPTION 'Invalid crypto deposit';
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
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;
  IF deposit_event.confirmations < deposit_event.required_confirmations THEN
    RETURN jsonb_build_object(
      'status', 'pending',
      'confirmations', deposit_event.confirmations,
      'required_confirmations', deposit_event.required_confirmations
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
    deposit_event.user_id, 'deposit', deposit_event.asset, deposit_event.amount,
    'Confirmed blockchain deposit ' || deposit_event.transaction_hash
  );
  UPDATE public.crypto_deposit_events
  SET status = 'credited', credited_at = NOW()
  WHERE id = deposit_event.id;
  RETURN jsonb_build_object('status', 'credited');
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_tatum_crypto_deposit(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER
) TO service_role;