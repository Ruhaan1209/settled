-- Settled: database schema
-- Run this whole file once in Supabase -> SQL Editor.
--
-- Design notes:
-- * Every visitor signs in anonymously, so auth.uid() identifies a device.
-- * Tables are read-only to clients (select policies only). All writes go
--   through the security-definer functions below, which enforce the rules.
-- * Options and votes are tagged with the room's round; "play again" bumps
--   the round and copies the option list forward.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  category         text not null check (category in ('eat', 'watch')),
  status           text not null default 'lobby' check (status in ('lobby', 'voting', 'results')),
  round            int  not null default 1,
  host_id          uuid not null,
  winner_option_id uuid,
  tie_broken       boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.participants (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null,
  name       text not null check (char_length(name) between 1 and 24),
  done_round int  not null default 0,
  joined_at  timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.options (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  round      int  not null,
  label      text not null check (char_length(label) between 1 and 80),
  added_by   uuid references public.participants (id) on delete set null,
  removed    boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index options_unique_label
  on public.options (room_id, round, lower(label))
  where not removed;

create table public.votes (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms (id) on delete cascade,
  round          int  not null,
  option_id      uuid not null references public.options (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  value          boolean not null,
  created_at     timestamptz not null default now(),
  unique (option_id, participant_id)
);

create index participants_room_idx on public.participants (room_id);
create index participants_user_idx on public.participants (user_id);
create index options_room_round_idx on public.options (room_id, round);
create index votes_room_round_idx on public.votes (room_id, round);

-- winner_option_id is added after options exists
alter table public.rooms
  add constraint rooms_winner_fk foreign key (winner_option_id)
  references public.options (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row level security: clients can only read rooms they belong to
-- ---------------------------------------------------------------------------

alter table public.rooms        enable row level security;
alter table public.participants enable row level security;
alter table public.options      enable row level security;
alter table public.votes        enable row level security;

create or replace function public.is_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from participants
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

create policy "members read rooms" on public.rooms
  for select to authenticated using (public.is_member(id));

create policy "members read participants" on public.participants
  for select to authenticated using (public.is_member(room_id));

create policy "members read options" on public.options
  for select to authenticated using (public.is_member(room_id));

create policy "members read votes" on public.votes
  for select to authenticated using (public.is_member(room_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._clean_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v text := left(btrim(coalesce(p_name, '')), 24);
begin
  if v = '' then
    raise exception 'Name is required';
  end if;
  return v;
end;
$$;

create or replace function public._my_participant(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from participants where room_id = p_room_id and user_id = auth.uid();
$$;

-- Picks the winner for the room's current round and moves it to results.
-- Most yes votes wins; ties are broken randomly. Caller must hold the row lock.
create or replace function public._finish_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round  int;
  v_winner uuid;
  v_tied   int;
begin
  select round into v_round from rooms where id = p_room_id;

  with tally as (
    select o.id, count(v.id) filter (where v.value) as yes
    from options o
    left join votes v on v.option_id = o.id
    where o.room_id = p_room_id and o.round = v_round and not o.removed
    group by o.id
  ),
  top as (
    select id from tally where yes = (select max(yes) from tally)
  )
  select (select id from top order by random() limit 1),
         (select count(*) from top)
  into v_winner, v_tied;

  update rooms
  set status = 'results',
      winner_option_id = v_winner,
      tie_broken = v_tied > 1
  where id = p_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Actions (called from the app via supabase.rpc)
-- ---------------------------------------------------------------------------

create or replace function public.create_room(p_category text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_room_id  uuid;
  v_name     text := _clean_name(p_name);
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;

  insert into rooms (code, category, host_id)
  values (v_code, p_category, auth.uid())
  returning id into v_room_id;

  insert into participants (room_id, user_id, name)
  values (v_room_id, auth.uid(), v_name);

  return v_code;
end;
$$;

create or replace function public.join_room(p_code text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_name    text := _clean_name(p_name);
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into v_room_id from rooms where code = upper(p_code);
  if v_room_id is null then
    raise exception 'Room not found';
  end if;

  insert into participants (room_id, user_id, name)
  values (v_room_id, auth.uid(), v_name)
  on conflict (room_id, user_id) do update set name = excluded.name;

  return v_room_id;
end;
$$;

create or replace function public.add_option(p_room_id uuid, p_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := _my_participant(p_room_id);
  v_room  rooms;
  v_label text := left(btrim(coalesce(p_label, '')), 80);
begin
  if v_me is null then raise exception 'Not in this room'; end if;
  if v_label = '' then raise exception 'Option is empty'; end if;

  select * into v_room from rooms where id = p_room_id;
  if v_room.status <> 'lobby' then raise exception 'Voting already started'; end if;

  insert into options (room_id, round, label, added_by)
  values (p_room_id, v_room.round, v_label, v_me);
exception
  when unique_violation then
    raise exception 'That option is already on the list';
end;
$$;

create or replace function public.remove_option(p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opt options;
begin
  select * into v_opt from options where id = p_option_id;
  if v_opt.id is null or _my_participant(v_opt.room_id) is null then
    raise exception 'Not in this room';
  end if;
  if (select status from rooms where id = v_opt.room_id) <> 'lobby' then
    raise exception 'Voting already started';
  end if;

  update options set removed = true where id = p_option_id;
end;
$$;

create or replace function public.start_voting(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.host_id is distinct from auth.uid() then raise exception 'Only the host can start voting'; end if;
  if v_room.status <> 'lobby' then return; end if;

  if (select count(*) from options
      where room_id = p_room_id and round = v_room.round and not removed) < 2 then
    raise exception 'Add at least 2 options first';
  end if;

  update rooms set status = 'voting' where id = p_room_id;
end;
$$;

create or replace function public.cast_vote(p_option_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opt  options;
  v_room rooms;
  v_me   uuid;
begin
  select * into v_opt from options where id = p_option_id;
  if v_opt.id is null then raise exception 'Option not found'; end if;

  v_me := _my_participant(v_opt.room_id);
  if v_me is null then raise exception 'Not in this room'; end if;

  select * into v_room from rooms where id = v_opt.room_id;
  if v_room.status <> 'voting' or v_opt.round <> v_room.round then
    raise exception 'Voting is closed';
  end if;

  insert into votes (room_id, round, option_id, participant_id, value)
  values (v_opt.room_id, v_opt.round, p_option_id, v_me, p_value)
  on conflict (option_id, participant_id) do update set value = excluded.value;
end;
$$;

-- Marks the caller as finished. If everyone is now finished, picks the winner.
create or replace function public.finish_voting(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.status <> 'voting' then return; end if;

  update participants set done_round = v_room.round
  where room_id = p_room_id and user_id = auth.uid();

  if not exists (
    select 1 from participants
    where room_id = p_room_id and done_round < v_room.round
  ) then
    perform _finish_round(p_room_id);
  end if;
end;
$$;

-- Host can close voting without waiting for stragglers.
create or replace function public.end_voting(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.host_id is distinct from auth.uid() then raise exception 'Only the host can end voting'; end if;
  if v_room.status <> 'voting' then return; end if;

  perform _finish_round(p_room_id);
end;
$$;

-- Starts a new round, carrying the current option list forward.
create or replace function public.play_again(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if v_room.host_id is distinct from auth.uid() then raise exception 'Only the host can start a new round'; end if;
  if v_room.status <> 'results' then return; end if;

  insert into options (room_id, round, label, added_by)
  select room_id, v_room.round + 1, label, added_by
  from options
  where room_id = p_room_id and round = v_room.round and not removed;

  update rooms
  set round = v_room.round + 1,
      status = 'lobby',
      winner_option_id = null,
      tie_broken = false
  where id = p_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: only signed-in (incl. anonymous) users may read or call actions
-- ---------------------------------------------------------------------------

-- Explicit so this works even with "Automatically expose new tables" turned off
revoke all on public.rooms, public.participants, public.options, public.votes from anon, authenticated;
grant select on public.rooms, public.participants, public.options, public.votes to authenticated;

revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.create_room(text, text),
  public.join_room(text, text),
  public.add_option(uuid, text),
  public.remove_option(uuid),
  public.start_voting(uuid),
  public.cast_vote(uuid, boolean),
  public.finish_voting(uuid),
  public.end_voting(uuid),
  public.play_again(uuid),
  public.is_member(uuid)
to authenticated;

-- Internal helpers are not callable from the app
revoke execute on function
  public._finish_round(uuid),
  public._my_participant(uuid),
  public._clean_name(text)
from authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: push room, participant and option changes to clients
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.rooms, public.participants, public.options;
