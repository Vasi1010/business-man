import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { supabaseAnonKey as anonKey, supabaseUrl as url } from './config'

/** null when the env vars are missing — the app then offers pass-and-play only. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'businessman:auth' },
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : null

