---
name: Supabase profile loading
description: Authenticated screens must wait for Supabase session restoration and use the profiles row as the source of user-facing account data
---

Protected pages must distinguish “session is still restoring” from “there is no session.” Load the authenticated `profiles` row before redirecting, and use its stored referral code, identity, account number, and profile fields throughout the UI.

**Why:** Redirecting on the first render while Supabase was restoring the session sent valid users from Settings → Profile back to sign-in, while recomputed or demo values made profile data inconsistent.

**How to apply:** Keep auth loading state in the provider, delay protected-route redirects until loading is false, and map all user-facing profile values from the authenticated `profiles` record.