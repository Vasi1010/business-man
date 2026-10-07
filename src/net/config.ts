/** Kept separate from supabase.ts so checking this doesn't pull in the Supabase SDK. */
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const onlineConfigured = Boolean(supabaseUrl && supabaseAnonKey)
