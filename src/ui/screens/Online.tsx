import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MIN_PLAYERS, applyAction, initialState, type Action, type PlayerSetup, type Settings, type TokenId } from '../../engine'
import { createRoom, getProfile, joinRoom, removeMember, saveProfile, setLastRoom, type Profile, type RoomState } from '../../net/room'
import { useRoom } from '../../net/useRoom'
import { toast } from '../../store/toasts'
import { Logo, TokenBadge } from '../components/Art'
import { SettingsEditor, TokenPicker } from '../components/SetupForms'
import { Button, Panel } from '../components/ui'
import type { GameController } from '../controller'
import { navigate } from '../router'
import { PLAYER_COLORS, TOKENS } from '../tokens'
import { GameScreen, PrefButtons } from './GameScreen'

function Shell({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <div className="bg-print min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <button type="button" onClick={() => navigate('/')} aria-label="Home">
          <Logo size="sm" />
        </button>
        <div className="flex items-center gap-1">
          {code && <span className="mr-1 font-mono text-sm tracking-widest text-muted">{code}</span>}
          <PrefButtons />
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-12">{children}</main>
    </div>
  )
}

function Centered({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Panel className="mt-8 text-center">
      <h1 className="font-display text-2xl">{title}</h1>
      {children && <div className="mt-2 text-muted">{children}</div>}
      <Button className="mt-4" onClick={() => navigate('/')}>
        Back home
      </Button>
    </Panel>
  )
}

/** Name + token + colour picker. */
function ProfileForm({
  submitLabel,
  takenTokens = [],
  takenColors = [],
  onSubmit,
}: {
  submitLabel: string
  takenTokens?: TokenId[]
  takenColors?: string[]
  onSubmit: (p: Profile) => Promise<void>
}) {
  const saved = getProfile()
  const firstFree = <T,>(list: T[], taken: T[], pref?: T) => (pref !== undefined && !taken.includes(pref) ? pref : (list.find((x) => !taken.includes(x)) ?? list[0]))
  const [name, setName] = useState(saved?.name ?? '')
  const [token, setToken] = useState<TokenId>(firstFree(TOKENS.map((t) => t.id), takenTokens, saved?.token))
  const [color, setColor] = useState(firstFree(PLAYER_COLORS.map((c) => c.hex), takenColors, saved?.color))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clash = takenTokens.includes(token) || takenColors.includes(color)

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim() || clash) return
        setBusy(true)
        setError(null)
        const profile = { name: name.trim().slice(0, 16), token, color }
        saveProfile(profile)
        try {
          await onSubmit(profile)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="block">
        <span className="font-semibold">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          required
          autoComplete="nickname"
          className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-lg"
          placeholder="e.g. Meera"
        />
      </label>
      <div>
        <span className="mb-1 block font-semibold">Pick your token</span>
        <TokenPicker
          token={token}
          color={color}
          takenTokens={takenTokens}
          takenColors={takenColors}
          onChange={(v) => {
            setToken(v.token)
            setColor(v.color)
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !name.trim() || clash}>
        {busy ? 'Please wait…' : submitLabel}
      </Button>
    </form>
  )
}

export function CreateGame() {
  return (
    <Shell>
      <h1 className="font-display text-3xl">Create a game</h1>
      <Panel>
        <ProfileForm
          submitLabel="Create room"
          onSubmit={async (profile) => {
            const code = await createRoom(profile)
            setLastRoom(code)
            navigate(`/room/${code}`, true)
          }}
        />
      </Panel>
    </Shell>
  )
}

function Lobby({
  code,
  uid,
  state,
  members,
  host,
  online,
  mutate,
}: {
  code: string
  uid: string
  state: RoomState
  members: string[]
  host: string
  online: Set<string>
  mutate: ReturnType<typeof useRoom>['mutate']
}) {
  const isHost = uid === host
  const players = state.lobby.players
  const link = `${window.location.origin}/join/${code}`
  const [settings, setSettingsDraft] = useState<Settings>(state.lobby.settings)
  const [lastSeen, setLastSeen] = useState(state.lobby.settings)
  if (state.lobby.settings !== lastSeen) {
    setLastSeen(state.lobby.settings)
    setSettingsDraft(state.lobby.settings)
  }

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Join my Business-Man game', text: `Room code ${code}`, url: link })
      else {
        await navigator.clipboard.writeText(link)
        toast('Invite link copied')
      }
    } catch {
      /* user cancelled */
    }
  }

  const saveSettings = async (next: Settings) => {
    setSettingsDraft(next)
    const err = await mutate((s) => ({ ...s, lobby: { ...s.lobby, settings: next } }))
    if (err) toast(err, 'error')
  }

  const start = async () => {
    const err = await mutate((s) => {
      const roster = s.lobby.players.filter((p) => members.includes(p.id))
      if (roster.length < MIN_PLAYERS) return { error: 'Need at least 2 players' }
      const order = [...roster].sort(() => Math.random() - 0.5)
      return { ...s, status: 'playing', game: initialState(order, s.lobby.settings, { now: Date.now() }) }
    })
    if (err) toast(err, 'error')
  }

  const kick = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the game?`)) return
    try {
      await removeMember(code, id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove player', 'error')
    }
  }

  const leave = async () => {
    if (!window.confirm('Leave this game?')) return
    try {
      await removeMember(code, uid)
    } catch {
      /* ignore */
    }
    setLastRoom(null)
    navigate('/')
  }

  const waitingToJoin = members.length - players.filter((p) => members.includes(p.id)).length

  return (
    <Shell code={code}>
      <Panel className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Room code</p>
        <p className="font-mono text-5xl font-bold tracking-[0.25em] text-brand">{code}</p>
        <p className="mt-1 break-all text-sm text-muted">{link}</p>
        <Button className="mt-3" onClick={() => void share()}>
          Share invite link
        </Button>
      </Panel>

      <Panel>
        <h2 className="mb-2 font-semibold">
          Players ({players.length}/6)
          {waitingToJoin > 0 && <span className="ml-2 text-sm font-normal text-muted">{waitingToJoin} joining…</span>}
        </h2>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
              <span className="relative">
                <TokenBadge token={p.token} color={p.color} size={36} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${online.has(p.id) ? 'bg-good' : 'bg-line'}`} aria-label={online.has(p.id) ? 'online' : 'offline'} />
              </span>
              <span className="flex-1 font-semibold">
                {p.name}
                {p.id === host && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">host</span>}
                {p.id === uid && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
              </span>
              {isHost && p.id !== uid && (
                <Button size="sm" variant="ghost" onClick={() => void kick(p.id, p.name)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        {players.length < MIN_PLAYERS && <p className="mt-2 text-sm text-muted">Waiting for at least one more player…</p>}
      </Panel>

      <Panel>
        <h2 className="mb-1 font-semibold">House rules {!isHost && <span className="text-sm font-normal text-muted">(set by the host)</span>}</h2>
        <SettingsEditor value={settings} onChange={(s) => void saveSettings(s)} disabled={!isHost} />
      </Panel>

      <div className="flex flex-col gap-2">
        {isHost ? (
          <Button variant="primary" size="lg" disabled={players.length < MIN_PLAYERS} onClick={() => void start()}>
            Start game
          </Button>
        ) : (
          <p className="text-center text-muted">Waiting for the host to start the game…</p>
        )}
        <Button variant="ghost" onClick={() => void leave()}>
          Leave game
        </Button>
      </div>
    </Shell>
  )
}

export function OnlineRoom({ code }: { code: string }) {
  const room = useRoom(code)
  const { uid, row, status, error, connected, onlineIds, mutate } = room

  const isMember = !!(uid && row?.members.includes(uid))
  const inLobbyList = !!(uid && row?.state.lobby.players.some((p) => p.id === uid))

  useEffect(() => {
    if (isMember) setLastRoom(code)
    else if (status === 'notFound') setLastRoom(null)
  }, [isMember, status, code])

  // Add our profile to the lobby once we're a member (e.g. after joining).
  const [joining, setJoining] = useState(false)

  const controller = useMemo<GameController | null>(() => {
    if (!row?.state.game || !uid) return null
    return {
      mode: 'online',
      state: row.state.game,
      meId: uid,
      onlineIds,
      roomCode: code,
      isHost: uid === row.host,
      connection: connected ? 'connected' : 'reconnecting',
      dispatch: async (action: Action, actorId, opts) => {
        if (actorId !== uid) return 'You can only act for yourself'
        const stamped = { ...action, now: action.now ?? Date.now() } as Action
        const err = await mutate((s) => {
          if (!s.game) return { error: 'The game has not started' }
          const r = applyAction(s.game, stamped, uid)
          if ('error' in r) return { error: r.error }
          return { ...s, status: r.state.status === 'finished' ? 'finished' : 'playing', game: r.state }
        })
        if (err && !opts?.silent) toast(err, 'error')
        return err
      },
      playAgain: () => {
        void mutate((s) => ({ ...s, status: 'lobby', game: null })).then((err) => err && toast(err, 'error'))
      },
      leave: () => {
        if (row.state.status === 'finished') setLastRoom(null)
        navigate('/')
      },
    }
  }, [row, uid, onlineIds, code, connected, mutate])

  if (status === 'loading') {
    return (
      <Shell code={code}>
        <p className="mt-10 text-center text-muted" role="status">
          Connecting to room {code}…
        </p>
      </Shell>
    )
  }
  if (status === 'notFound') {
    return (
      <Shell>
        <Centered title={`No game called ${code}`}>Check the code and try again. Rooms are deleted when everyone leaves the lobby.</Centered>
      </Shell>
    )
  }
  if (status === 'error' || !row || !uid) {
    return (
      <Shell>
        <Centered title="Couldn't connect">{error ?? 'Please check your internet connection.'}</Centered>
      </Shell>
    )
  }

  if (!isMember || !inLobbyList) {
    if (row.status !== 'lobby' && !isMember) {
      return (
        <Shell>
          <Centered title="This game has already started">Ask the host to start a new one, or play pass-and-play.</Centered>
        </Shell>
      )
    }
    if (row.status !== 'lobby' && isMember && !inLobbyList) {
      return (
        <Shell>
          <Centered title="You're not in this game" />
        </Shell>
      )
    }
    const others = row.state.lobby.players.filter((p) => p.id !== uid)
    if (!isMember && row.members.length >= 6) {
      return (
        <Shell>
          <Centered title="This game is full">Six players have already joined.</Centered>
        </Shell>
      )
    }
    return (
      <Shell code={code}>
        <h1 className="font-display text-3xl">Join room {code}</h1>
        {others.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            Already here:
            {others.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <TokenBadge token={p.token} color={p.color} size={22} /> {p.name}
              </span>
            ))}
          </div>
        )}
        <Panel>
          <ProfileForm
            submitLabel={joining ? 'Joining…' : 'Join game'}
            takenTokens={others.map((p) => p.token)}
            takenColors={others.map((p) => p.color)}
            onSubmit={async (profile) => {
              setJoining(true)
              try {
                await joinRoom(code)
                const err = await mutate((s) => {
                  if (s.status !== 'lobby') return { error: 'That game has already started' }
                  const rest = s.lobby.players.filter((p) => p.id !== uid)
                  if (rest.some((p) => p.token === profile.token || p.color === profile.color))
                    return { error: 'Someone just took that token or colour — pick another' }
                  const me: PlayerSetup = { id: uid, ...profile }
                  return { ...s, lobby: { ...s.lobby, players: [...rest, me] } }
                })
                if (err) throw new Error(err)
                setLastRoom(code)
                if (window.location.pathname.startsWith('/join/')) navigate(`/room/${code}`, true)
              } finally {
                setJoining(false)
              }
            }}
          />
        </Panel>
      </Shell>
    )
  }

  if (row.state.status === 'lobby' || !controller) {
    return <Lobby code={code} uid={uid} state={row.state} members={row.members} host={row.host} online={onlineIds} mutate={mutate} />
  }

  return <GameScreen controller={controller} />
}
