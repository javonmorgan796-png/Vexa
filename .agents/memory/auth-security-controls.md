---
name: Authentication security controls
description: Durable choices for login lockouts and active-device session management
---

Login security is layered: the client persists a five-minute delay after three failed passcodes so refresh cannot reopen the form, while Supabase RPCs record the same lockout server-side when the security migration is installed. Active devices are tracked in a user-owned session registry with heartbeats and revocation checks.

**Why:** The phone-to-email auth flow has no authenticated session before a password attempt, so the UI needs a refresh-safe local guard while the anonymous RPCs provide shared enforcement. Supabase does not provide an individual-device list through the browser auth client, so the app registry is required for per-device management.

**How to apply:** Keep phone normalization consistent with the `{normalized_phone}@vexa.app` auth convention. Do not expose the lockout table directly to clients; use the security-definer RPCs. Device revocation should update the registry and be checked by the active session heartbeat.

Browser device identity is privacy-limited: Chromium User-Agent Client Hints can expose many Android models, but Safari does not expose the exact iPhone/iPad generation and desktop browsers generally do not expose a PC manufacturer/model. Store the most specific permitted make/model and use a clear platform fallback.

**Why:** A web app cannot reliably recover hardware identity that the browser intentionally withholds; claiming an exact model from screen dimensions or a reduced user agent would be inaccurate.

**How to apply:** Refresh stored device metadata during session registration and heartbeat so records created with older generic labels become more specific when the browser provides better information.