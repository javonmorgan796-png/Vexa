---
name: Supabase env injection via Vite define
description: How the Vite client receives Supabase URL and anon-key secrets across workspace versions
---

This workspace has used both `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and `SUPABASE_URL` / `SUPABASE_ANON_KEY` secret names over time. The browser client must accept both naming conventions.

**Solution:** Use `define` in `vite.config.ts` to inject them at build/dev time:

```ts
const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';

define: {
  'import.meta.env.SUPABASE_URL': JSON.stringify(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
  ),
  'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  ),
},
```

**Why:** The GitHub app version and the existing Replit secrets can otherwise disagree on naming, causing the app to crash at startup even though the secrets exist. This keeps dev HMR and production builds compatible.
