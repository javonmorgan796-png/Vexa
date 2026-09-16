-- Persistent login lockouts and device/session registry.
-- Run this migration in Supabase SQL Editor.

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

GRANT EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_lockout(TEXT) TO authenticated;

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