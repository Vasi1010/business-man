import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureSession, fetchRoom, subscribeRoom, writeState, type RoomRow, type RoomState } from './room'
import { isNetworkError, mutateWithRetry } from './sync'

export type RoomStatus = 'loading' | 'ready' | 'notFound' | 'error'

export type Mutator = (state: RoomState, row: RoomRow) => RoomState | { error: string }


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
        const subscription = await subscribeRoom(code, id, {
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
            if (ok) {
              void refresh()
              // Change streaming can lag the SUBSCRIBED signal; catch anything written in that gap.
              setTimeout(() => !closed && void refresh(), 2000)
            }
          },
        })
        if (closed) subscription.close()
        else sub = subscription
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

  // Poll as a safety net: often while disconnected, occasionally otherwise
  // (a single small read) in case a realtime message was dropped.
  useEffect(() => {
    const t = setInterval(() => void refresh(), connected ? 15000 : 4000)
    return () => clearInterval(t)
  }, [connected, refresh])

  const mutate = useCallback(
    (fn: Mutator): Promise<string | null> =>
      mutateWithRetry<RoomState, RoomRow>(
        {
          current: () => rowRef.current,
          refresh,
          write: (version, state) => writeState(code, version, state),
          committed: (r) => accept({ ...r, status: r.state.status }),
          setConnected,
        },
        fn,
      ),
    [code, refresh, accept],
  )

  return { uid, row, status, error, connected, onlineIds, refresh, mutate }
}
