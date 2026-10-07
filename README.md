# Business-Man

**Play:** https://business-man-game.vercel.app

A multiplayer property-trading board game for 2–6 friends and family, each playing on their own phone or laptop. It plays like the classic Indian trading game: Indian cities, ₹, Club, Rest House, Wealth Tax, and Chance / Community Chest results decided by the dice total that brought you there.

- **Online:** create a room, share the link (`/join/ABC123`), play in real time. Refresh or phone sleep drops you straight back into your game.
- **Pass and play:** the same game on one device, fully offline, saved as you go.

Stack: Vite + React + TypeScript (strict) + Tailwind CSS v4, Zustand, Supabase (Postgres + Realtime + Anonymous Auth), Vitest. There's no custom server: the app deploys as static files.

---

## Quick start (pass and play only)

```bash
npm install
npm run dev
```

Open http://localhost:5173 and choose **Pass and play**. Online play needs Supabase (below).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, listening on your LAN (`--host`) |
| `npm test` | Vitest: engine rules, sync/retry logic, a quick fuzz run |
| `npm run lint` | ESLint |
| `npm run build` | Type-check and production build to `dist/` |
| `FUZZ_GAMES=50 FUZZ_STEPS=3000 npm test` | Long soak test: random full games checked for deadlocks and invariants |

---

## Setting up Supabase (for online play)

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Enable anonymous sign-ins:** *Authentication → Sign In / Providers → Anonymous Sign-Ins* → enable → save. Players never create accounts; each browser gets an anonymous identity.
   - Optional but recommended: *Authentication → Attack Protection* → enable CAPTCHA or keep the default rate limits, since anonymous sign-in is open to anyone with your URL.
3. **Run the migration** in `supabase/migrations/0001_init.sql`. Either:
   - **SQL editor:** open *SQL Editor → New query*, paste the whole file, click **Run**; or
   - **CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   This creates the `games` table, row-level security, the `create_game` / `apply_state` / `join_game` / `remove_member` functions, and adds `games` to the Realtime publication.
4. **Get your keys:** *Project Settings → API*. Copy the **Project URL** and the **anon / publishable** key. The anon key is meant to be public, and RLS protects the data. Never use the `service_role` key in the app.

### Local environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>
```

`.env.local` is git-ignored (every `.env*` file except `.env.example` is). Restart `npm run dev` after changing it.

### How multiplayer works

- Each game is one row in `games`: `id` (6-character room code), `state` (the whole game as JSON), `version`, `members`, `host`, `status`.
- Clients run the same pure engine. To act, a client applies the action locally and calls `apply_state(id, expected_version, new_state)`. That only succeeds if nobody else wrote in the meantime. On a conflict the client re-fetches, re-applies the action to the fresh state (the engine re-checks legality), and retries.
- Everyone subscribes to their game row over Supabase Realtime and re-renders on each update. A presence channel per game drives the online/offline dots.
- RLS lets signed-in users read games. Direct inserts/updates are blocked; every write goes through the security-definer functions, which check that `auth.uid()` is a member.
- If the connection drops, a "reconnecting" banner appears, the client polls until it's back, and catches up on wake/online events.

> **Trust model:** this is built for friends and family. The engine validates every action on every client, and the database enforces membership and versioning, but the database doesn't re-run game rules itself. A determined member with dev tools could write a doctored state. If you need cheat-proof play, move `applyAction` into a Supabase Edge Function.

---

## Playing on your LAN (phones on the same Wi-Fi)

`npm run dev` already listens on all interfaces. Vite prints something like:

```
➜  Network: http://192.168.1.23:5173/
```

Open that address on each phone. (On Windows, allow Node through the firewall for private networks if prompted.) Online mode still uses your Supabase project, so all devices need internet access. Pass-and-play works fully offline.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. The framework preset is **Vite**; build command `npm run build`, output `dist` (already set in `vercel.json`).
3. Add environment variables under *Settings → Environment Variables* (Production, and Preview if you want):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. `vercel.json` rewrites every path to `index.html`, so links like `/join/ABC123` work on refresh.

Or with the CLI:

```bash
npx vercel login
npx vercel link
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel --prod
```

Vite bakes env vars in at build time, so redeploy after changing them.

---

## Editing the board

Everything lives in **`src/engine/data/board.ts`**:

- `BOARD`: the 40 tiles in order, with city prices, rents `[site, 1 house, 2, 3, hotel]`, house/hotel cost, mortgage values, and paired-service rents.
- `GROUP_COLORS`: the colour bands.
- `CHANCE` / `CHEST`: what each dice total (2–12) does.
- `SPECIAL_DEFAULTS`: default starting cash, Start salary, taxes, Club, Rest House and jail fine. All of these can also be changed per game in the lobby.
- `AUCTION_STEP`, `AUCTION_SECONDS`, `UNMORTGAGE_INTEREST`.

The engine (`src/engine/`) is pure TypeScript with no React or network code: `initialState(players, settings)` and `applyAction(state, action, actorId) → { state, events } | { error }`. Dice and timestamps come in through the action, so it's deterministic and fully unit-tested (`src/engine/engine.test.ts`).

## Rules notes

The rules follow the brief. Where it left room for interpretation:

- **First-lap rule:** before passing Start you can't buy or bid. If you land on an unowned tile, nothing happens (it isn't auctioned).
- **Debts:** if you can't pay, the debt is queued and play pauses until you sell, mortgage, trade and pay. Bankruptcy is only offered when even selling everything wouldn't cover it. When several players are owed (Club, "pay every player"), each payment is a separate debt in order.
- **Bankruptcy:** buildings are sold back at half price first. Owing a player: they get your cash, properties (mortgages stay) and jail passes. Owing the bank: properties are auctioned one by one.
- **Mortgages:** you must sell the buildings in a colour group before mortgaging any of it. Traded mortgaged tiles stay mortgaged.
- **Full-group double rent** applies to unbuilt cities whenever the owner holds the whole group.
- **Jail:** doubles on your jail roll free you and move you, but don't give an extra roll.
- **Auctions:** start with a 10-second countdown that resets on each bid; they also end once everyone else drops out.

## Project layout

```
src/
  engine/        pure rules engine + board data + tests
  net/           Supabase client, room API, realtime hook, retry logic
  store/         Zustand stores (pass-and-play game, prefs, toasts)
  ui/            components, screens, hooks, router
supabase/migrations/0001_init.sql
vercel.json      SPA rewrite
```

All artwork (tokens, logo, icons) is original and drawn in SVG for this project.
