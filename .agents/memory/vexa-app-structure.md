---
name: Vexa app structure
description: Key file locations and architecture decisions for the Vexa banking app
---

## Key files
- All screens/pages: `artifacts/vexa-app/src/App.tsx` (~3900 lines, all inline)
- Auth context (Supabase): `artifacts/vexa-app/src/context/AuthContext.tsx`
- Live user data (balance, cashback, referrals): `artifacts/vexa-app/src/context/UserDataContext.tsx`
- Business banking: `artifacts/vexa-app/src/context/BusinessContext.tsx`
- Business PIN security: `artifacts/vexa-app/src/context/BusinessSecurityContext.tsx`
- Supabase client: `artifacts/vexa-app/src/lib/supabase.ts`
- DB schema: `supabase-schema.sql` (at workspace root — run in Supabase SQL Editor)

## Context provider order (App.tsx)
QueryClientProvider → AuthProvider → UserDataProvider → BusinessProvider → BusinessSecurityProvider → TooltipProvider → Router

UserDataProvider must be inside AuthProvider (uses useAuth). BusinessProvider and BusinessSecurityProvider also need AuthProvider.

## Business context pattern
Optimistic local state + fire-and-forget Supabase sync. Functions remain synchronous-looking to not break existing page callers. runPayroll returns `{ success, message }` synchronously after local state update.

## Lock timestamp
`LOCK_HIDDEN_AT_KEY` and `PASSCODE_RETURN_KEY` intentionally remain in localStorage — these are session-local UI preferences, not user data that needs to persist across devices.
