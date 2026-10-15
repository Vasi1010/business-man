import { Component, Suspense, lazy, type ReactNode } from 'react'
import { usePrefs } from '../../store/prefs'
import { boardStatus } from '../boardStatus'
import { useController } from '../controller'
import { Board } from './Board'

const Scene3D = lazy(() => import('../three/Scene3D'))

/** Falls back to the 2D board if the 3D scene can't start (no WebGL, lost context…). */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The game board in the player's chosen style: full 3D table or flat 2D. */
export function GameBoard({ onTileClick, onDiceClick }: { onTileClick: (i: number) => void; onDiceClick?: () => void }) {
  const { state } = useController()
  const view = usePrefs((p) => p.board)
  const flat = <Board onTileClick={onTileClick} onDiceClick={onDiceClick} />
  if (view === '2d') return flat
  return (
    <SceneBoundary fallback={flat}>
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#1d140d] shadow-xl">
        <Suspense fallback={<p className="grid h-full place-items-center text-sm text-white/70">Setting up the table…</p>}>
          <Scene3D state={state} onTile={onTileClick} onDiceClick={onDiceClick} status={boardStatus(state)} saver />
        </Suspense>
      </div>
    </SceneBoundary>
  )
}

/** Small switch between the 3D and 2D boards. */
export function BoardViewToggle() {
  const { board, setBoard } = usePrefs()
  return (
    <div className="flex rounded-full border border-line p-0.5 text-xs font-semibold" role="group" aria-label="Board style">
      {(['3d', '2d'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={board === v}
          onClick={() => setBoard(v)}
          className={`rounded-full px-2 py-0.5 uppercase ${board === v ? 'bg-brand text-brand-ink' : 'text-muted'}`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
