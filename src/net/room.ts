import type { RealtimeChannel } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, type GameState, type PlayerSetup, type Settings } from '../engine'
import { supabase } from './supabase'

/** What is stored in games.state. */
export interface RoomState {
  status: 'lobby' | 'playing' | 'finished'
  lobby: {
    hostId: string
    players: PlayerSetup[]
    settings: Settings
  }
  game: GameState | null
}

export interface RoomRow {
  id: string
  state: RoomState
  version: number
  members: string[]
  host: string
  status: RoomState['status']
}

export interface Profile {
  name: string
  token: PlayerSetup['token']
  color: string
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LAST_ROOM_KEY = 'lakhpati:lastRoom'
const PROFILE_KEY = 'lakhpati:profile'

function client() {
  if (!supabase) throw new Error('Online play is not configured')
  return supabase
}

export function randomCode(): string {
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('')
}

/* ---------------------------- local storage ---------------------------- */

export function getLastRoom(): string | null {
  try {
    return localStorage.getItem(LAST_ROOM_KEY)
  } catch {
    return null
  }
}
export function setLastRoom(code: string | null) {
  try {
    if (code) localStorage.setItem(LAST_ROOM_KEY, code)
    else localStorage.removeItem(LAST_ROOM_KEY)
  } catch {
    /* ignore */
  }
}
export function getProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/* -------------------------------- auth --------------------------------- */

/** Returns the current user id, signing in anonymously on first use. */
export async function ensureSession(): Promise<string> {
  const sb = client()
  const { data } = await sb.auth.getSession()
  if (data.session?.user) return data.session.user.id
  const { data: signed, error } = await sb.auth.signInAnonymously()
  if (error || !signed.user) throw new Error(error?.message ?? 'Could not sign in')
  return signed.user.id
}

/** The current user id if a session already exists (never creates one). */
export async function existingUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/* ------------------------------- rooms --------------------------------- */

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Something went wrong'
}

export async function fetchRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await client().from('games').select('id,state,version,members,host,status').eq('id', code).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as RoomRow | null) ?? null
}

export async function createRoom(profile: Profile, settings: Settings = DEFAULT_SETTINGS): Promise<string> {
  const uid = await ensureSession()
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode()
    const state: RoomState = {
      status: 'lobby',
      lobby: { hostId: uid, players: [{ id: uid, ...profile }], settings },
      game: null,
    }
    const { data, error } = await client().rpc('create_game', { p_id: code, p_state: state })
    if (error) throw new Error(errorMessage(error))
    if (data === true) return code
  }
  throw new Error('Could not find a free room code — try again')
}

export async function joinRoom(code: string): Promise<void> {
  await ensureSession()
  const { error } = await client().rpc('join_game', { p_id: code })
  if (error) throw new Error(errorMessage(error))
}

/** Optimistic write. Resolves true on success, false on a version conflict. */
export async function writeState(code: string, expectedVersion: number, state: RoomState): Promise<boolean> {
  const { data, error } = await client().rpc('apply_state', {
    p_id: code,
    p_expected_version: expectedVersion,
    p_state: state,
  })
  if (error) throw new Error(errorMessage(error))
  return data === true
}

export async function removeMember(code: string, uid: string): Promise<void> {
  const { error } = await client().rpc('remove_member', { p_id: code, p_uid: uid })
  if (error) throw new Error(errorMessage(error))
}

/* ------------------------------ realtime ------------------------------- */

export interface Subscription {
  close: () => void
}

/**
 * Subscribe to a game row and to presence for that game.
 * `onRow` receives every update (with `state` possibly missing if the payload
 * was too large — callers should re-fetch in that case).
 */
export function subscribeRoom(
  code: string,
  uid: string,
  handlers: {
    onRow: (row: Partial<RoomRow>) => void
    onPresence: (ids: Set<string>) => void
    onStatus: (connected: boolean) => void
  },
): Subscription {
  const sb = client()
  const channel: RealtimeChannel = sb.channel(`game:${code}`, { config: { presence: { key: uid } } })
  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${code}` }, (payload) => {
      if (payload.eventType === 'DELETE') handlers.onRow({ id: code, members: [] })
      else handlers.onRow(payload.new as Partial<RoomRow>)
    })
    .on('presence', { event: 'sync' }, () => {
      handlers.onPresence(new Set(Object.keys(channel.presenceState())))
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        handlers.onStatus(true)
        void channel.track({ at: Date.now() })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onStatus(false)
      }
    })
  return {
    close: () => {
      void sb.removeChannel(channel)
    },
  }
}
