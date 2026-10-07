import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureSession, fetchRoom, subscribeRoom, writeState, type RoomRow, type RoomState } from './room'

export type RoomStatus = 'loading' | 'ready' | 'notFound' | 'error'

export type Mutator = (state: RoomState, row: RoomRow) => RoomState | { error: string }

const MAX_ATTEMPTS = 6
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /fetch|network|timeout|offline|Load failed/i.test(msg)
}

/**
 * Keeps one game row in sync via Supabase Realtime, and writes to it with
 * optimistic concurrency (re-fetch and re-apply on version conflicts).
 */
export function useRoom(code: string) {
  const [uid, setUid] = useState<string | null>(null)
  const [row, setRow] = useState<RoomRow | null>(null)
  const [status, setStatus] = useState<RoomStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
  const rowRef = useRef<RoomRow | null>(null)

  const accept = useCallback((r: RoomRow, force = false) => {
    const cur = rowRef.current
    if (!force && cur && r.version <= cur.version) return
    rowRef.current = r
    setRow(r)
    setStatus('ready')
  }, [])

  const refresh = useCallback(async (): Promise<RoomRow | null> => {
    try {
      const r = await fetchRoom(code)
      setConnected(true)
      if (!r) {
        rowRef.current = null
        setRow(null)
        setStatus('notFound')
        return null
      }
      accept(r, !rowRef.current || r.version >= rowRef.current.version)
      return rowRef.current
    } catch (e) {
      if (isNetworkError(e)) setConnected(false)
      else {
        setError(e instanceof Error ? e.message : 'Could not load the game')
        setStatus((s) => (s === 'loading' ? 'error' : s))
      }
      return rowRef.current
    }
  }, [code, accept])

  // Sign in, load and subscribe.
  useEffect(() => {
    let closed = false
    let sub: { close: () => void } | null = null
    ;(async () => {
      try {
        const id = await ensureSession()
        if (closed) return
        setUid(id)
        await refresh()
        if (closed) return
        sub = subscribeRoom(code, id, {
          onRow: (r) => {
            if (r.members && r.members.length === 0 && !r.state) {
              void refresh()
              return
            }
            if (!r.state || typeof r.version !== 'number') {
              void refresh()
              return
            }
            accept(r as RoomRow)
          },
          onPresence: setOnlineIds,
          onStatus: (ok) => {
            setConnected(ok)
            if (ok) void refresh()
          },
        })
      } catch (e) {
        if (closed) return
        if (isNetworkError(e)) setConnected(false)
        setError(e instanceof Error ? e.message : 'Could not connect')
        setStatus('error')
      }
    })()
    return () => {
      closed = true
      sub?.close()
    }
  }, [code, refresh, accept])

  // Catch up after the phone wakes or the network returns.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [refresh])

  // While disconnected, poll so the game keeps moving even if realtime is down.
  useEffect(() => {
    if (connected) return
    const t = setInterval(() => void refresh(), 4000)
    return () => clearInterval(t)
  }, [connected, refresh])

  const mutate = useCallback(
    async (fn: Mutator): Promise<string | null> => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const cur = rowRef.current ?? (await refresh())
        if (!cur) return 'Game not found'
        const next = fn(cur.state, cur)
        if ('error' in next) return next.error
        try {
          const ok = await writeState(code, cur.version, next)
          setConnected(true)
          if (ok) {
            accept({ ...cur, state: next, status: next.status, version: cur.version + 1 })
            return null
          }
          // Someone else wrote first: load their version and try again.
          await refresh()
        } catch (e) {
          if (!isNetworkError(e)) return e instanceof Error ? e.message : 'Something went wrong'
          setConnected(false)
          await sleep(400 * 2 ** attempt)
          await refresh()
        }
      }
      return 'Could not reach the server — check your connection'
    },
    [code, refresh, accept],
  )

  return { uid, row, status, error, connected, onlineIds, refresh, mutate }
}
