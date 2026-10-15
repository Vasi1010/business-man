import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Board } from '../components/Board'
import { Logo } from '../components/Art'
import { PropertyCard } from '../components/PropertyCard'
import { Button, Panel } from '../components/ui'
import { ControllerContext, useController } from '../controller'
import { PlayersPanel } from '../components/SidePanels'
import { navigate } from '../router'
import { PrefButtons } from '../screens/GameScreen'
import { useDemoGame } from './useDemoGame'
import { MoneyFx } from '../components/MoneyFx'
import { useGameFeedback } from '../hooks/useGameFeedback'

const Scene3D = lazy(() => import('../three/Scene3D'))

/** Live redraws-per-second badge. Kept apart from the board so updating it doesn't redraw the scene. */
function RateBadge({ saver, subscribe }: { saver: boolean; subscribe: (set: (n: number) => void) => void }) {
  const [rate, setRate] = useState<number | null>(null)
  useEffect(() => subscribe(setRate), [subscribe])
  return (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${saver ? 'bg-good text-white dark:text-black' : 'bg-bad text-white dark:text-black'}`}
          aria-live="polite"
        >
          {rate === null ? '…' : `${rate} redraws/s`}
        </span>
  )
}

/** One side of the battery comparison, with a live count of redraws per second. */
function SaverSide({ title, note, saver, onTile, onDiceClick }: { title: string; note: string; saver: boolean; onTile: (i: number) => void; onDiceClick?: () => void }) {
  const { state } = useController()
  const badge = useRef<(n: number) => void>(undefined)
  const subscribe = useCallback((set: (n: number) => void) => {
    badge.current = set
  }, [])
  const onFrameRate = useCallback((n: number) => badge.current?.(n), [])
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="truncate font-semibold">{title}</h2>
        <RateBadge saver={saver} subscribe={subscribe} />
      </div>
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#1d140d]">
        <Suspense fallback={<p className="p-6 text-center text-sm text-white/70">Loading…</p>}>
          <Scene3D state={state} onTile={onTile} onDiceClick={onDiceClick} saver={saver} onFrameRate={onFrameRate} />
        </Suspense>
      </div>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  )
}

type Style = 'tilt' | 'webgl' | 'battery'

/** Side-by-side preview of the two 3D styles, running a demo game. */
export function PreviewPage() {
  const { controller, roll, busy } = useDemoGame()
  const [style, setStyle] = useState<Style>('tilt')
  const [tile, setTile] = useState<number | null>(null)
  const s = controller.state
  useGameFeedback(s, null)
  const current = s.players.find((p) => p.id === s.turn.playerId)

  return (
    <ControllerContext.Provider value={controller}>
      <div className="bg-print min-h-dvh pb-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2">
          <button type="button" onClick={() => navigate('/')} aria-label="Home">
            <Logo size="sm" />
          </button>
          <PrefButtons />
        </header>
        <main className="mx-auto max-w-6xl space-y-3 px-3">
          <div>
            <h1 className="font-display text-2xl">3D preview</h1>
            <p className="text-sm text-muted">Two styles, same demo game. Tap Roll (or the dice) to watch the pieces move. Tap any property to open its card.</p>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-paper-2 p-1" role="tablist" aria-label="3D style">
            {(
              [
                ['tilt', 'A · Tilted 3D table'],
                ['webgl', 'B · Full 3D scene'],
                ['battery', 'C · Battery saver'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={style === id}
                onClick={() => setStyle(id)}
                className={`rounded-lg px-2 py-2 text-sm font-semibold ${style === id ? 'bg-card shadow-sm' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            {style === 'tilt'
              ? 'Light and fast on any phone. Tiles stay sharp and tappable. Pieces stand up, hop and cast shadows; the dice are real 3D cubes.'
              : style === 'webgl'
                ? 'A real 3D world: drag to rotate, pinch or scroll to zoom. Modelled pawns, houses and hotels. Heavier download (≈ 1 MB) and more battery use on older phones.'
                : 'Same game on both boards. Roll the dice and watch the counters: the old board redraws all the time, the battery saver only while something moves, then rests at 0.'}
          </p>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            {style === 'battery' ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <SaverSide
                  title="Before"
                  note="Redraws ~60 times a second, all the time. Sharpest, glossiest, contact shadows."
                  saver={false}
                  onTile={setTile}
                  onDiceClick={busy ? undefined : roll}
                />
                <SaverSide
                  title="After: battery saver"
                  note="Redraws only while dice, pawns or the camera move. Slightly lower resolution, less gloss, simpler shadows."
                  saver
                  onTile={setTile}
                  onDiceClick={busy ? undefined : roll}
                />
              </div>
            ) : (
            <div className={style === 'webgl' ? 'aspect-square w-full overflow-hidden rounded-2xl lg:aspect-[4/3]' : 'mx-auto w-full lg:max-w-[calc(100dvh-8rem)]'}>
              {style === 'tilt' ? (
                <Board onTileClick={setTile} variant="tilt" onDiceClick={busy ? undefined : roll} />
              ) : (
                <Suspense fallback={<p className="p-10 text-center text-muted">Loading 3D scene…</p>}>
                  <Scene3D state={s} onTile={setTile} onDiceClick={busy ? undefined : roll} />
                </Suspense>
              )}
            </div>
            )}
            <div className="space-y-3">
              <Panel>
                <p className="mb-2 font-semibold">{current?.name}'s turn</p>
                <Button variant="primary" size="lg" disabled={busy} onClick={roll}>
                  {busy ? 'Moving…' : 'Roll dice'}
                </Button>
              </Panel>
              <Panel>
                <PlayersPanel onTile={setTile} />
              </Panel>
            </div>
          </div>
        </main>
        <PropertyCard tile={tile} onClose={() => setTile(null)} />
        <MoneyFx />
      </div>
    </ControllerContext.Provider>
  )
}
