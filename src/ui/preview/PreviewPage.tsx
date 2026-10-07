import { Suspense, lazy, useState } from 'react'
import { Board } from '../components/Board'
import { Logo } from '../components/Art'
import { PropertyCard } from '../components/PropertyCard'
import { Button, Panel } from '../components/ui'
import { ControllerContext } from '../controller'
import { PlayersPanel } from '../components/SidePanels'
import { navigate } from '../router'
import { PrefButtons } from '../screens/GameScreen'
import { useDemoGame } from './useDemoGame'

const Scene3D = lazy(() => import('../three/Scene3D'))

type Style = 'tilt' | 'webgl'

/** Side-by-side preview of the two 3D styles, running a demo game. */
export function PreviewPage() {
  const { controller, roll, busy } = useDemoGame()
  const [style, setStyle] = useState<Style>('tilt')
  const [tile, setTile] = useState<number | null>(null)
  const s = controller.state
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
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper-2 p-1" role="tablist" aria-label="3D style">
            {(
              [
                ['tilt', 'A · Tilted 3D table'],
                ['webgl', 'B · Full 3D scene'],
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
              : 'A real 3D world: drag to rotate, pinch or scroll to zoom. Modelled pawns, houses and hotels. Heavier download (≈ 1 MB) and more battery use on older phones.'}
          </p>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className={style === 'webgl' ? 'aspect-square w-full overflow-hidden rounded-2xl lg:aspect-[4/3]' : 'mx-auto w-full lg:max-w-[calc(100dvh-8rem)]'}>
              {style === 'tilt' ? (
                <Board onTileClick={setTile} variant="tilt" onDiceClick={busy ? undefined : roll} />
              ) : (
                <Suspense fallback={<p className="p-10 text-center text-muted">Loading 3D scene…</p>}>
                  <Scene3D state={s} onTile={setTile} onDiceClick={busy ? undefined : roll} />
                </Suspense>
              )}
            </div>
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
      </div>
    </ControllerContext.Provider>
  )
}
