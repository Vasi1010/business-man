import { useState } from 'react'
import { useLocalGame } from '../../store/localGame'
import { Logo, TokenBadge } from '../components/Art'
import { PLAYER_COLORS, TOKENS } from '../tokens'
import { Button, Panel } from '../components/ui'
import { navigate } from '../router'
import { PrefButtons } from './GameScreen'

export function Home({
  onlineReady,
  onCreate,
  resumeCode,
}: {
  onlineReady: boolean
  onCreate: () => void
  resumeCode: string | null
}) {
  const [code, setCode] = useState('')
  const localGame = useLocalGame((s) => s.game)
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

  return (
    <div className="bg-print min-h-dvh">
      <div className="mx-auto flex max-w-md justify-end gap-1 px-4 pt-3">
        <PrefButtons />
      </div>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-4">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-3 text-lg text-muted">Buy cities, build hotels, bankrupt your cousins.</p>
          <div className="mt-4 flex -space-x-2" aria-hidden>
            {TOKENS.map((t, i) => (
              <TokenBadge key={t.id} token={t.id} color={PLAYER_COLORS[i].hex} size={40} ring />
            ))}
          </div>
        </div>

        {resumeCode && (
          <Button variant="good" size="lg" onClick={() => navigate(`/room/${resumeCode}`)}>
            Rejoin room {resumeCode}
          </Button>
        )}

        <Panel className="space-y-3">
          <h2 className="font-display text-2xl">Play online</h2>
          <p className="text-sm text-muted">2–6 players, each on their own phone or laptop.</p>
          <Button variant="primary" size="lg" className="w-full" disabled={!onlineReady} onClick={onCreate}>
            Create a game
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (cleaned.length === 6) navigate(`/join/${cleaned}`)
            }}
          >
            <label className="sr-only" htmlFor="join-code">
              Room code
            </label>
            <input
              id="join-code"
              value={cleaned}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ROOM CODE"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={!onlineReady}
              className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-center font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button type="submit" size="lg" disabled={!onlineReady || cleaned.length !== 6}>
              Join
            </Button>
          </form>
          {!onlineReady && (
            <p className="text-sm text-bad">
              Online play isn't configured yet — add your Supabase URL and anon key (see the README). Pass and play works without it.
            </p>
          )}
        </Panel>

        <Panel className="space-y-3">
          <h2 className="font-display text-2xl">Pass and play</h2>
          <p className="text-sm text-muted">One device, passed around the table. Works offline.</p>
          <Button size="lg" className="w-full" onClick={() => navigate('/local')}>
            {localGame && localGame.status === 'playing' ? 'Resume saved game' : 'Set up a local game'}
          </Button>
        </Panel>

        <footer className="text-center text-xs text-muted">An original game. All artwork drawn for Lakhpati.</footer>
      </main>
    </div>
  )
}
