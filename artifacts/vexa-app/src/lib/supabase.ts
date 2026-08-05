import { createClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

const url  = typeof __SUPABASE_URL__  !== 'undefined' ? __SUPABASE_URL__  : '';
const key  = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';

if (!url || !key) {
  console.error('[Vexa] Supabase URL / anon key missing — check SUPABASE_URL & SUPABASE_ANON_KEY secrets.');
}

export const supabase = createClient(url, key);
