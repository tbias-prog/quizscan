import { createClient } from '@supabase/supabase-js';

let supabase: any = null;

export async function getSupabase() {
  if (supabase) return supabase;

  try {
    const res = await fetch('/api/config');
    const { supabaseUrl, supabaseAnonKey } = await res.json();

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase credentials missing. Check your .env file.");
      return null;
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);
    return supabase;
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    return null;
  }
}
