import { useState } from 'react'
import { isLegal, type Trade } from '../../engine'
import { usePrefs } from '../../store/prefs'
import { toast } from '../../store/toasts'
import { ControllerContext, canAct, perspectiveId, type GameController } from '../controller'
import { rollDice } from '../dice'
import { useAutoActions } from '../hooks/useAutoActions'
import { useGameFeedback } from '../hooks/useGameFeedback'
import { useNow } from '../hooks/useNow'
import { ActionPanel } from '../components/ActionPanel'
import { Logo } from '../components/Art'
import { Board } from '../components/Board'
import { CardReveal, EndScreen } from '../components/Overlays'
import { PropertyCard } from '../components/PropertyCard'
import { AssetsPanel, EventLog, PlayersPanel } from '../components/SidePanels'
import { TradeDialog, TradesInbox, type TradeDraft } from '../components/Trades'
import { Button, Panel } from '../components/ui'

export function PrefButtons() {
  const { muted, toggleMuted, theme, setTheme } = usePrefs()
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  return (
    <>
      <Button variant="ghost" size="sm" onClick={toggleMuted} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} aria-pressed={!muted}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />}
        </svg>
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setTheme(nextTheme)} aria-label={`Theme: ${theme}. Switch to ${nextTheme}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          {theme === 'dark' ? (
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          ) : theme === 'light' ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor" />
            </>
          )}
        </svg>
      </Button>
    </>
  )
}

function Countdown({ endsAt }: { endsAt: number }) {
  const now = useNow(true, 1000)
  const left = Math.max(0, endsAt - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return (
    <span className={`rounded-full border border-line px-2 py-0.5 text-sm tabular-nums ${left < 60000 ? 'text-bad' : ''}`} aria-label={`${m} minutes ${s} seconds left`}>
      ⏱ {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

function TopBar({ c }: { c: GameController }) {
  const copyLink = async () => {
    const url = `${window.location.origin}/join/${c.roomCode}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Invite link copied')
    } catch {
      toast(url)
    }
  }
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-1.5">
        <Logo size="sm" />
        {c.roomCode && (
          <button type="button" onClick={() => void copyLink()} className="ml-1 rounded-full border border-line px-2 py-0.5 font-mono text-sm tracking-widest" aria-label={`Room ${c.roomCode}. Copy invite link`}>
            {c.roomCode}
          </button>
        )}
        {c.mode === 'local' && <span className="ml-1 hidden text-sm text-muted sm:inline">Pass and play</span>}
        <div className="ml-auto flex items-center gap-1">
          {c.state.endsAt > 0 && c.state.status === 'playing' && <Countdown endsAt={c.state.endsAt} />}
          <PrefButtons />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(c.mode === 'local' ? 'Leave this game? It stays saved on this device.' : 'Leave the game? You can rejoin with the room code.')) c.leave()
            }}
          >
            Leave
          </Button>
        </div>
      </div>
      {c.connection === 'reconnecting' && (
        <div className="bg-accent px-3 py-1 text-center text-sm font-semibold text-black" role="status">
          Connection lost — reconnecting…
        </div>
      )}
    </header>
  )
}

type Tab = 'players' | 'assets' | 'log'

export function GameScreen({ controller: c }: { controller: GameController }) {
  const s = c.state
  const [tile, setTile] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('players')
  const [draft, setDraft] = useState<(TradeDraft & { key: number }) | null>(null)
  useGameFeedback(s, c.meId)
  useAutoActions(c)

  const viewer = perspectiveId(s, c.meId)

  // Tapping the dice rolls them when it's your turn to roll.
  const roller = s.turn.playerId
  const [rolling, setRolling] = useState(false)
  const canRoll = !rolling && canAct(c, roller) && isLegal(s, { type: 'roll', dice: [1, 2] }, roller)
  const onDiceClick = canRoll
    ? () => {
        setRolling(true)
        void c.dispatch({ type: 'roll', dice: rollDice() }, roller).finally(() => setTimeout(() => setRolling(false), 400))
      }
    : undefined
  const viewerPlayer = s.players.find((p) => p.id === viewer)

  const startTrade = () => {
    setDraft({ key: Date.now(), fromId: viewer, toId: null, give: { tiles: [], cash: 0, passes: 0 }, get: { tiles: [], cash: 0, passes: 0 } })
  }
  const counter = (t: Trade) => {
    setDraft({ key: Date.now(), fromId: t.toId, toId: t.fromId, give: t.get, get: t.give, counterOf: t.id })
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'players', label: 'Players' },
    { id: 'assets', label: c.meId ? 'My properties' : `${viewerPlayer?.name ?? ''}'s properties` },
    { id: 'log', label: 'Log' },
  ]

  return (
    <ControllerContext.Provider value={c}>
      <div className="bg-print min-h-dvh pb-8">
        <TopBar c={c} />
        <main className="mx-auto grid max-w-7xl gap-3 px-2 pt-2 sm:px-4 sm:pt-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="mx-auto w-full lg:max-w-[calc(100dvh-5.5rem)]">
            <Board onTileClick={setTile} onDiceClick={onDiceClick} />
          </div>
          <div className="flex flex-col gap-3">
            <ActionPanel />
            <TradesInbox onCounter={counter} />
            <Panel className="p-0">
              <div role="tablist" aria-label="Game details" className="flex border-b border-line">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`panel-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 truncate px-3 py-2.5 text-sm font-semibold ${tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-muted'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-3">
                {tab === 'players' && <PlayersPanel onTile={setTile} />}
                {tab === 'assets' && <AssetsPanel playerId={viewer} onTile={setTile} onTrade={startTrade} />}
                {tab === 'log' && <EventLog />}
              </div>
            </Panel>
          </div>
        </main>
        <PropertyCard tile={tile} onClose={() => setTile(null)} />
        {draft && <TradeDialog key={draft.key} draft={draft} onClose={() => setDraft(null)} />}
        <CardReveal />
        <EndScreen />
      </div>
    </ControllerContext.Provider>
  )
}
