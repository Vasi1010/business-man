/**
 * Optimistic-concurrency write loop, independent of React and Supabase so it can be unit tested.
 * Apply `fn` to the latest known row, try to write it at that version, and on
 * a conflict re-fetch and re-apply. Network errors back off and retry.
 */

export interface VersionedRow<S> {
  state: S
  version: number
}

export interface SyncIO<S, R extends VersionedRow<S>> {
  current: () => R | null
  refresh: () => Promise<R | null>
  write: (expectedVersion: number, state: S) => Promise<boolean>
  committed: (row: R) => void
  setConnected: (ok: boolean) => void
  sleep?: (ms: number) => Promise<void>
}

export const MAX_ATTEMPTS = 6

export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /fetch|network|timeout|offline|Load failed/i.test(msg)
}

export async function mutateWithRetry<S, R extends VersionedRow<S>>(
  io: SyncIO<S, R>,
  fn: (state: S, row: R) => S | { error: string },
): Promise<string | null> {
  const sleep = io.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cur = io.current() ?? (await io.refresh())
    if (!cur) return 'Game not found'
    const next = fn(cur.state, cur)
    if (next && typeof next === 'object' && 'error' in next) return (next as { error: string }).error
    try {
      const ok = await io.write(cur.version, next as S)
      io.setConnected(true)
      if (ok) {
        io.committed({ ...cur, state: next as S, version: cur.version + 1 })
        return null
      }
      await io.refresh()
    } catch (e) {
      if (!isNetworkError(e)) return e instanceof Error ? e.message : 'Something went wrong'
      io.setConnected(false)
      await sleep(400 * 2 ** attempt)
      await io.refresh()
    }
  }
  return 'Could not reach the server — check your connection'
}
