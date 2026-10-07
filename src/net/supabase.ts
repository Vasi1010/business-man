import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null when the env vars are missing — the app then offers pass-and-play only. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'businessman:auth' },
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : null

export const onlineConfigured = supabase !== null
