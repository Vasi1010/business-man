import { useMemo, useState } from 'react'
import { MAX_PLAYERS, MIN_PLAYERS, type Action, type PlayerSetup } from '../../engine'
import { useLocalGame } from '../../store/localGame'
import { toast } from '../../store/toasts'
import { Logo } from '../components/Art'
import { PLAYER_COLORS, TOKENS } from '../tokens'
import { SettingsEditor, TokenPicker } from '../components/SetupForms'
import { Button, Panel } from '../components/ui'
import type { GameController } from '../controller'
import { navigate } from '../router'
import { GameScreen, PrefButtons } from './GameScreen'

const NAMES = ['Ayaan', 'Sara', 'Kabir', 'Meera', 'Dev', 'Isha']

function newPlayer(index: number, roster: PlayerSetup[]): PlayerSetup {
  const token = TOKENS.find((t) => !roster.some((p) => p.token === t.id))!.id
  const color = PLAYER_COLORS.find((c) => !roster.some((p) => p.color === c.hex))!.hex
  return { id: `p${Date.now().toString(36)}${index}`, name: NAMES[index] ?? `Player ${index + 1}`, token, color }
}

function LocalSetup() {
  const { roster, settings, setRoster, setSettings, start } = useLocalGame()
  const [players, setPlayers] = useState<PlayerSetup[]>(() => {
    if (roster.length >= MIN_PLAYERS) return roster
    const a = newPlayer(0, [])
    return [a, newPlayer(1, [a])]
  })
  const [showRules, setShowRules] = useState(false)

  const update = (i: number, patch: Partial<PlayerSetup>) => setPlayers(players.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const names = players.map((p) => p.name.trim())
  const valid = players.length >= MIN_PLAYERS && names.every((n) => n.length > 0) && new Set(names).size === names.length

  return (
    <div className="bg-print min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <button type="button" onClick={() => navigate('/')} aria-label="Home">
          <Logo size="sm" />
        </button>
        <div className="flex items-center gap-1">
          <PrefButtons />
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-10">
        <div>
          <h1 className="font-display text-3xl">Pass and play</h1>
          <p className="text-muted">Everyone shares this device. No internet needed — the game is saved here as you play.</p>
        </div>
        <Panel>
          <h2 className="mb-2 font-semibold">Players ({players.length})</h2>
          <ul className="space-y-3">
            {players.map((p, i) => (
              <li key={p.id} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={p.name}
                    maxLength={16}
                    onChange={(e) => update(i, { name: e.target.value })}
                    aria-label={`Player ${i + 1} name`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 font-semibold"
                  />
                  {players.length > MIN_PLAYERS && (
                    <Button variant="ghost" size="sm" onClick={() => setPlayers(players.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>
                      Remove
                    </Button>
                  )}
                </div>
                <TokenPicker
                  token={p.token}
                  color={p.color}
                  takenTokens={players.filter((_, j) => j !== i).map((x) => x.token)}
                  takenColors={players.filter((_, j) => j !== i).map((x) => x.color)}
                  onChange={(v) => update(i, v)}
                />
              </li>
            ))}
          </ul>
          {players.length < MAX_PLAYERS && (
            <Button className="mt-3 w-full" onClick={() => setPlayers([...players, newPlayer(players.length, players)])}>
              + Add player
            </Button>
          )}
        </Panel>
        <Panel>
          <button type="button" className="flex w-full items-center justify-between font-semibold" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>
            House rules
            <span className="text-sm text-muted">{showRules ? 'Hide' : 'Show'}</span>
          </button>
          {showRules && (
            <div className="mt-2">
              <SettingsEditor value={settings} onChange={setSettings} />
            </div>
          )}
        </Panel>
        {!valid && <p className="text-sm text-bad">Every player needs a different, non-empty name.</p>}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            setRoster(players.map((p) => ({ ...p, name: p.name.trim() })))
            start()
          }}
        >
          Start game
        </Button>
      </main>
    </div>
  )
}

export function LocalPlay() {
  const game = useLocalGame((s) => s.game)
  const dispatch = useLocalGame((s) => s.dispatch)
  const start = useLocalGame((s) => s.start)
  const endGame = useLocalGame((s) => s.endGame)

  const controller = useMemo<GameController | null>(() => {
    if (!game) return null
    return {
      mode: 'local',
      state: game,
      meId: null,
      onlineIds: null,
      dispatch: async (action, actorId, opts) => {
        const err = dispatch({ ...action, now: action.now ?? Date.now() } as Action, actorId)
        if (err && !opts?.silent) toast(err, 'error')
        return err
      },
      playAgain: () => start(),
      leave: () => {
        if (game.status === 'finished') endGame()
        navigate('/')
      },
    }
  }, [game, dispatch, start, endGame])

  if (!controller) return <LocalSetup />
  return <GameScreen controller={controller} />
}
