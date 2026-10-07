import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'local' }
  | { name: 'join'; code: string }
  | { name: 'room'; code: string }

const listeners = new Set<() => void>()

function parse(path: string): Route {
  const join = path.match(/^\/join\/([A-Za-z0-9]{6})\/?$/)
  if (join) return { name: 'join', code: join[1].toUpperCase() }
  const room = path.match(/^\/room\/([A-Za-z0-9]{6})\/?$/)
  if (room) return { name: 'room', code: room[1].toUpperCase() }
  if (path.startsWith('/local')) return { name: 'local' }
  return { name: 'home' }
}

let current = parse(window.location.pathname)

window.addEventListener('popstate', () => {
  current = parse(window.location.pathname)
  listeners.forEach((l) => l())
})

export function navigate(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  current = parse(path)
  listeners.forEach((l) => l())
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
