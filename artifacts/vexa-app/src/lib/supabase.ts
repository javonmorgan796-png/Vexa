import { createClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

const rawUrl = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
const key    = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';

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
  console.error('[Vexa] Supabase URL / anon key missing — check SUPABASE_URL & SUPABASE_ANON_KEY secrets.');
}

export const supabase = createClient(url, key);
