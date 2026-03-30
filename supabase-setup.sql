-- ═══════════════════════════════════════════════════════════
--  Box Battles — Supabase SQL Setup
--  Run this in your Supabase SQL Editor:
--  https://app.supabase.com → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- 1. PROFILES (one row per player)
create table if not exists profiles (
  username    text primary key,
  password    text not null,
  xp          integer default 0,
  coins       integer default 0,
  wins        integer default 0,
  losses      integer default 0,
  kills       integer default 0,
  color       text default '#5b8cff',
  owned_items jsonb default '[]',
  party_id    text,
  alliance_id uuid
);

-- 2. ALLIANCES
create table if not exists alliances (
  id      uuid primary key default gen_random_uuid(),
  name    text unique not null,
  owner   text not null,
  members jsonb default '[]',
  created_at timestamptz default now()
);

-- 3. PARTIES (transient; cleaned up after game)
create table if not exists parties (
  id      text primary key,
  host    text not null,
  members jsonb default '[]',
  mode    text default 'ffa',
  created_at timestamptz default now()
);

-- 4. INVITES (party invitations)
create table if not exists invites (
  id        uuid primary key default gen_random_uuid(),
  to_user   text not null,
  from_user text not null,
  party_id  text,
  type      text default 'party',
  created_at timestamptz default now()
);

-- 5. OPEN LOBBIES (for quick match)
create table if not exists open_lobbies (
  id           text primary key,
  mode         text default 'ffa',
  player_count integer default 1,
  created_at   timestamptz default now()
);

-- ─── Row Level Security (allow public read/write for MVP) ──
-- NOTE: For a real game you'd want proper auth + stricter RLS.
-- These policies allow anyone with the anon key to read/write,
-- which is fine for a game hosted on GitHub Pages.

alter table profiles    enable row level security;
alter table alliances   enable row level security;
alter table parties     enable row level security;
alter table invites     enable row level security;
alter table open_lobbies enable row level security;

-- Public access policies
create policy "profiles_public"     on profiles     for all using (true) with check (true);
create policy "alliances_public"    on alliances    for all using (true) with check (true);
create policy "parties_public"      on parties      for all using (true) with check (true);
create policy "invites_public"      on invites      for all using (true) with check (true);
create policy "open_lobbies_public" on open_lobbies for all using (true) with check (true);

-- ─── Optional: auto-clean stale open lobbies older than 1hr ──
-- Run this as a cron job or Supabase Edge Function if you want:
-- delete from open_lobbies where created_at < now() - interval '1 hour';
