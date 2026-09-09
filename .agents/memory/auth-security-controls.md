---
name: Authentication security controls
description: Durable choices for login lockouts and active-device session management
---

Login security is layered: the client persists a five-minute delay after three failed passcodes so refresh cannot reopen the form, while Supabase RPCs record the same lockout server-side when the security migration is installed. Active devices are tracked in a user-owned session registry with heartbeats and revocation checks.

**Why:** The phone-to-email auth flow has no authenticated session before a password attempt, so the UI needs a refresh-safe local guard while the anonymous RPCs provide shared enforcement. Supabase does not provide an individual-device list through the browser auth client, so the app registry is required for per-device management.

**How to apply:** Keep phone normalization consistent with the `{normalized_phone}@vexa.app` auth convention. Do not expose the lockout table directly to clients; use the security-definer RPCs. Device revocation should update the registry and be checked by the active session heartbeat.