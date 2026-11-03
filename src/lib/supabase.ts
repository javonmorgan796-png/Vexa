import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';

// Normalize: keep only the origin (scheme + host) — strip any /rest/v1/ or trailing paths
// that users sometimes accidentally copy from the Supabase dashboard
const url = rawUrl
  ? (() => {
      try {
        const { origin } = new URL(rawUrl);
        return origin; // e.g. https://abcdefg.supabase.co
      } catch {
        return rawUrl;
      }
    })()
  : '';

if (!url || !key) {
  console.error('[Vexa] Supabase URL / anon key missing — check VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY secrets.');
}

export const supabase = createClient(url, key);
