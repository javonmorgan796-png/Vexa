---
name: Supabase env injection via Vite define
description: How SUPABASE_URL and SUPABASE_ANON_KEY are made available in the browser bundle
---

Replit Secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` are NOT prefixed with `VITE_`, so Vite won't expose them automatically.

**Solution:** Use `define` in `vite.config.ts` to inject them at build/dev time:

```ts
define: {
  __SUPABASE_URL__:      JSON.stringify(process.env.SUPABASE_URL      ?? ''),
  __SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
},
```

In `src/lib/supabase.ts`, declare them as globals and use them:
```ts
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
export const supabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__);
```

**Why:** This bakes the values into the bundle at dev/build time. Works in both dev server (HMR) and production build.
