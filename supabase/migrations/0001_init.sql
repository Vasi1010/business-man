-- Lakhpati: realtime multiplayer schema.
-- Run once in the Supabase SQL editor, or with `supabase db push`.

create table if not exists public.games (
  id          text primary key check (id ~ '^[A-Z0-9]{6}$'),
  state       jsonb not null,
  version     int not null default 1,
  members     uuid[] not null default '{}',
  host        uuid not null,
  status      text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists games_members_idx on public.games using gin (members);

-- ---------------------------------------------------------------------------
-- Row level security: anyone signed in (including anonymous users) can read a
-- game — they need the 6-character code anyway. Nobody writes directly; all
-- writes go through the security-definer functions below.
-- ---------------------------------------------------------------------------
alter table public.games enable row level security;

drop policy if exists "Signed-in users can read games" on public.games;
create policy "Signed-in users can read games"
  on public.games for select
  to authenticated
  using (true);

revoke insert, update, delete on public.games from anon, authenticated;
revoke select on public.games from anon;
grant select on public.games to authenticated;

-- ---------------------------------------------------------------------------
-- create_game: insert a new lobby with the caller as host and first member.
-- Returns false if the room code is already taken (client picks a new code).
-- ---------------------------------------------------------------------------
create or replace function public.create_game(p_id text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if octet_length(p_state::text) > 512000 then
    raise exception 'State too large';
  end if;
  insert into games (id, state, members, host, status)
  values (upper(p_id), p_state, array[auth.uid()], auth.uid(), 'lobby')
  on conflict (id) do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_state: optimistic concurrency. Only succeeds when the caller is a
-- member and the stored version still equals the version they started from.
-- On failure the client re-fetches, re-applies its action and retries.
-- ---------------------------------------------------------------------------
create or replace function public.apply_state(p_id text, p_expected_version int, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := p_state ->> 'status';
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if v_status is null or v_status not in ('lobby', 'playing', 'finished') then
    raise exception 'Invalid status';
  end if;
  if octet_length(p_state::text) > 512000 then
    raise exception 'State too large';
  end if;
  update games
     set state = p_state,
         status = v_status,
         version = version + 1,
         updated_at = now()
   where id = p_id
     and version = p_expected_version
     and auth.uid() = any (members);
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_game: add the caller to members while the game is still in the lobby
-- and has fewer than 6 players. Re-joining as an existing member is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.join_game(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  g games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into g from games where id = upper(p_id) for update;
  if not found then
    raise exception 'Game not found';
  end if;
  if auth.uid() = any (g.members) then
    return true;
  end if;
  if g.status <> 'lobby' then
    raise exception 'That game has already started';
  end if;
  if cardinality(g.members) >= 6 then
    raise exception 'That game is full';
  end if;
  update games
     set members = array_append(members, auth.uid()),
         version = version + 1,
         updated_at = now()
   where id = g.id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_member: the host kicks a player, or a player leaves, while in the
-- lobby. Also removes them from the lobby player list stored in state.
-- ---------------------------------------------------------------------------
create or replace function public.remove_member(p_id text, p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  g games%rowtype;
  v_players jsonb;
  v_new_host uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into g from games where id = upper(p_id) for update;
  if not found then
    raise exception 'Game not found';
  end if;
  if auth.uid() <> g.host and auth.uid() <> p_uid then
    raise exception 'Only the host can remove other players';
  end if;
  if g.status <> 'lobby' then
    raise exception 'Players can only be removed in the lobby';
  end if;

  select coalesce(jsonb_agg(p), '[]'::jsonb) into v_players
    from jsonb_array_elements(g.state -> 'lobby' -> 'players') p
   where p ->> 'id' <> p_uid::text;

  v_new_host := g.host;
  if p_uid = g.host then
    select m into v_new_host from unnest(g.members) m where m <> p_uid limit 1;
  end if;

  if v_new_host is null then
    delete from games where id = g.id;
    return true;
  end if;

  update games
     set members = array_remove(members, p_uid),
         host = v_new_host,
         state = jsonb_set(
                   jsonb_set(state, '{lobby,players}', v_players),
                   '{lobby,hostId}', to_jsonb(v_new_host::text)),
         version = version + 1,
         updated_at = now()
   where id = g.id;
  return true;
end;
$$;

revoke all on function public.create_game(text, jsonb) from public, anon;
revoke all on function public.apply_state(text, int, jsonb) from public, anon;
revoke all on function public.join_game(text) from public, anon;
revoke all on function public.remove_member(text, uuid) from public, anon;
grant execute on function public.create_game(text, jsonb) to authenticated;
grant execute on function public.apply_state(text, int, jsonb) to authenticated;
grant execute on function public.join_game(text) to authenticated;
grant execute on function public.remove_member(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes to subscribed clients.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end;
$$;
