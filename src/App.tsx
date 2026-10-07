import { useEffect, useState } from 'react'
import { existingUserId, fetchRoom, getLastRoom, setLastRoom } from './net/room'
import { onlineConfigured } from './net/supabase'
import { Toaster } from './ui/components/Overlays'
import { navigate, useRoute } from './ui/router'
import { Home } from './ui/screens/Home'
import { LocalPlay } from './ui/screens/LocalPlay'
import { CreateGame, OnlineRoom } from './ui/screens/Online'

/** On first load, drop a returning player straight back into their unfinished online game. */
function useAutoRejoin(enabled: boolean) {
  const [resumeCode, setResumeCode] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled || !onlineConfigured) return
    const code = getLastRoom()
    if (!code) return
    let cancelled = false
    ;(async () => {
      try {
        const uid = await existingUserId()
        if (!uid) return
        const row = await fetchRoom(code)
        if (cancelled) return
        if (!row || !row.members.includes(uid) || row.status === 'finished') {
          setLastRoom(null)
          return
        }
        navigate(`/room/${code}`, true)
      } catch {
        // Offline: offer a manual rejoin button instead.
        if (!cancelled) setResumeCode(code)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return resumeCode
}

export default function App() {
  const route = useRoute()
  const [initialRoute] = useState(route.name)
  const resumeCode = useAutoRejoin(initialRoute === 'home')

  let screen
  switch (route.name) {
    case 'local':
      screen = <LocalPlay />
      break
    case 'new':
      screen = onlineConfigured ? <CreateGame /> : <Home onlineReady={false} onCreate={() => {}} resumeCode={null} />
      break
    case 'join':
    case 'room':
      screen = onlineConfigured ? (
        <OnlineRoom key={route.code} code={route.code} />
      ) : (
        <Home onlineReady={false} onCreate={() => {}} resumeCode={null} />
      )
      break
    default:
      screen = <Home onlineReady={onlineConfigured} onCreate={() => navigate('/new')} resumeCode={resumeCode} />
  }
  return (
    <>
      {screen}
      <Toaster />
    </>
  )
}
