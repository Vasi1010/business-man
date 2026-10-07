import { onlineConfigured } from './net/supabase'
import { Toaster } from './ui/components/Overlays'
import { navigate, useRoute } from './ui/router'
import { Home } from './ui/screens/Home'
import { LocalPlay } from './ui/screens/LocalPlay'

export default function App() {
  const route = useRoute()
  return (
    <>
      {route.name === 'local' ? (
        <LocalPlay />
      ) : (
        <Home onlineReady={onlineConfigured} onCreate={() => navigate('/')} resumeCode={null} />
      )}
      <Toaster />
    </>
  )
}
