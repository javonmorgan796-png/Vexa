---
name: Supabase phone-auth pattern
description: How Vexa maps phone+passcode login to Supabase Auth email/password
---

The app authenticates with phone number + 6-digit passcode. Supabase Auth only supports email or phone (SMS) natively. We use email mode with a fake domain:

- Email used for Supabase: `{normalizedPhone}@vexa.app` (e.g. `08012345678@vexa.app`)
- Password: the 6-digit passcode

**Why:** Avoids needing SMS/Twilio setup while keeping real auth sessions and RLS.

**How to apply:** Any change to auth must keep this convention. `normalizePhone` strips all non-digits. `phoneToEmail` appends `@vexa.app`.

**Required Supabase setting:** Email confirmations must be DISABLED in Authentication → Settings. Otherwise signUp won't create a session automatically.

Profile data lives in `public.profiles` table (not auth.users metadata). Fetch it by `auth.uid() = id` after sign-in.
