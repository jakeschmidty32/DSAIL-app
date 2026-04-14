-- Run this in the Supabase SQL editor to initialize the schema.
-- All tables are scoped to a user_id so the schema supports multiple users
-- if auth is extended later, but for now a single user is created on first login.

create extension if not exists "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────────────────────
create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  google_id        text unique not null,
  email            text,
  display_name     text,
  location_name    text,
  location_lat     double precision,
  location_lng     double precision,
  timezone         text default 'America/Chicago',
  temperature_unit text default 'fahrenheit',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ─── Calendar accounts ───────────────────────────────────────────────────────
create table if not exists calendar_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id) on delete cascade,
  provider          text default 'google',
  access_token      text,
  refresh_token     text,
  token_expires_at  timestamptz,
  connected_at      timestamptz default now(),
  unique (user_id, provider)
);

-- Unique constraint needed for upsert on (user_id, provider) in auth callback
-- (already declared inline above)

-- ─── Journal days ─────────────────────────────────────────────────────────────
-- One row per (user, date). Acts as the anchor for all day-level data.
create table if not exists journal_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  date       date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

-- ─── Calendar events snapshot ─────────────────────────────────────────────────
create table if not exists journal_events (
  id               uuid primary key default gen_random_uuid(),
  journal_day_id   uuid references journal_days(id) on delete cascade,
  user_id          uuid references users(id) on delete cascade,
  ms_event_id      text,
  title            text not null,
  start_time       timestamptz,
  end_time         timestamptz,
  is_all_day       boolean default false,
  location         text,
  notes            text,
  is_online_meeting boolean default false,
  meeting_url      text,
  raw_json         jsonb,
  fetched_at       timestamptz default now()
);

create index if not exists journal_events_day_idx on journal_events(journal_day_id);
create index if not exists journal_events_user_date_idx on journal_events(user_id, start_time);

-- ─── Weather snapshots ────────────────────────────────────────────────────────
create table if not exists weather_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id) on delete cascade,
  date              date not null,
  location_name     text,
  temperature_max   double precision,
  temperature_min   double precision,
  temperature_unit  text default 'fahrenheit',
  condition         text,
  precipitation     double precision,
  wind_speed        double precision,
  humidity          double precision,
  weather_code      integer,
  uv_index          double precision,
  raw_json          jsonb,
  fetched_at        timestamptz default now(),
  unique (user_id, date)
);

-- ─── News headlines ───────────────────────────────────────────────────────────
-- Top 3 headlines fetched for the day; at most one is selected.
create table if not exists news_headlines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  date         date not null,
  position     integer not null,  -- 1, 2, or 3
  title        text not null,
  source       text,
  url          text,
  published_at timestamptz,
  fetched_at   timestamptz default now()
);

create index if not exists news_headlines_user_date_idx on news_headlines(user_id, date);

create table if not exists selected_headlines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  date         date not null,
  headline_id  uuid references news_headlines(id) on delete set null,
  title        text not null,
  source       text,
  url          text,
  selected_at  timestamptz default now(),
  unique (user_id, date)
);

-- ─── Journal notes ────────────────────────────────────────────────────────────
create table if not exists journal_notes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete cascade,
  journal_day_id uuid references journal_days(id) on delete cascade,
  content        text not null,
  is_voice       boolean default false,
  is_pinned      boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists journal_notes_day_idx on journal_notes(journal_day_id);

-- Full-text search index on note content
create index if not exists journal_notes_fts_idx
  on journal_notes using gin(to_tsvector('english', content));

-- ─── Quotes ──────────────────────────────────────────────────────────────────
create table if not exists quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  date       date not null,
  text       text not null,
  author     text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- ─── Tags ─────────────────────────────────────────────────────────────────────
create table if not exists tags (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name    text not null,
  color   text default '#6366f1',
  unique (user_id, name)
);

create table if not exists note_tags (
  note_id uuid references journal_notes(id) on delete cascade,
  tag_id  uuid references tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

-- ─── Attachments (future use) ─────────────────────────────────────────────────
create table if not exists attachments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete cascade,
  journal_day_id uuid references journal_days(id) on delete cascade,
  note_id        uuid references journal_notes(id) on delete set null,
  file_name      text not null,
  file_type      text,
  file_size      integer,
  storage_path   text not null,
  created_at     timestamptz default now()
);

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on users
  for each row execute function set_updated_at();
create trigger journal_days_updated_at before update on journal_days
  for each row execute function set_updated_at();
create trigger journal_notes_updated_at before update on journal_notes
  for each row execute function set_updated_at();
