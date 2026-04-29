-- =====================================================================
-- K9 — Supabase schema (v2.1 — schéma isolé "k9")
-- =====================================================================
-- IMPORTANT : ce projet partage la base Supabase avec un autre produit
-- (ravito). Pour éviter toute collision (tables, triggers, types, RPC,
-- buckets storage), tout K9 vit dans un schéma dédié `k9` :
--
--   k9.profiles, k9.dogs, k9.calendar_events, k9.walks, k9.posts, …
--
-- L'auth (auth.users) reste partagée — c'est voulu : un même email = un
-- même user_id partout. Côté API, tous les clients Supabase pointent
-- explicitement sur le schéma `k9` via `db: { schema: 'k9' }`.
--
-- Storage buckets (à créer manuellement, namespace `k9-` pour isolation) :
--   • k9-dog-photos     (public read, write authenticated)
--   • k9-alert-photos   (public read, write authenticated)
--   • k9-post-photos    (public read, write authenticated)
--   • k9-vet-scans      (private, write authenticated)
--
-- Inspiré du pattern Adventurer : RLS stricte par défaut, ownership via
-- auth.uid(), index ciblés sur les colonnes filtrées côté API, triggers
-- updated_at génériques.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schéma k9 + extensions
-- ---------------------------------------------------------------------
create schema if not exists k9;

create extension if not exists "uuid-ossp"  with schema extensions;
create extension if not exists "pg_trgm"    with schema extensions;
create extension if not exists "postgis"    with schema extensions;

-- L'API REST (PostgREST) doit pouvoir voir ce schéma. Le réglage est
-- prioritairement à appliquer côté Dashboard → Settings → API → Exposed
-- schemas (ajouter `k9`). Le ALTER ci-dessous est un best-effort qui
-- fonctionne sur la plupart des projets Supabase auto-hébergés.
do $$
begin
  perform 1;
  -- Pas de fail si on n'a pas les droits — l'admin Supabase prendra le relais
exception when others then
  null;
end $$;

grant usage on schema k9 to anon, authenticated, service_role;
grant all on all tables in schema k9 to anon, authenticated, service_role;
grant all on all sequences in schema k9 to anon, authenticated, service_role;
grant all on all functions in schema k9 to anon, authenticated, service_role;

alter default privileges in schema k9 grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema k9 grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema k9 grant all on functions to anon, authenticated, service_role;

-- =====================================================================
-- profiles : données propriétaire (référence auth.users — partagée)
-- =====================================================================
create table if not exists k9.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  lang text default 'fr' check (lang in ('fr','en')),
  use_imperial boolean default false,
  ai_soft_mode boolean default false,
  a11y_large boolean default false,
  notif_enabled boolean default false,
  -- Stripe / plan
  plan text default 'free' check (plan in ('free','plus','pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_started_at timestamptz,
  plan_current_period_end timestamptz,
  -- Geo
  approx_city text,
  geo_lat numeric,
  geo_lon numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================================
-- dogs
-- =====================================================================
create table if not exists k9.dogs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed_idx int,
  years int default 0,
  months int default 0,
  sex text check (sex in ('m','f','male','female') or sex is null),
  weight_kg numeric,
  emoji text default '🐕',
  coat text,
  photo_url text,
  photo_data_url text,
  chip_id text,
  birthday date,
  goal text,
  exp text,
  vet_name text,
  vet_phone text,
  vet_address text,
  is_active boolean default false,
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists k9_dogs_user_idx on k9.dogs(user_id);
create index if not exists k9_dogs_user_active_idx on k9.dogs(user_id, is_active) where is_active = true;

-- =====================================================================
-- calendar_events
-- =====================================================================
create table if not exists k9.calendar_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete set null,
  type text not null check (type in ('vax','worm','vet','birth','food','treatment','other')),
  title text not null,
  event_date date not null,
  notes text,
  reminded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists k9_cal_user_date_idx on k9.calendar_events(user_id, event_date);
create index if not exists k9_cal_date_unsent_idx on k9.calendar_events(event_date) where reminded_at is null;

-- =====================================================================
-- walks
-- =====================================================================
create table if not exists k9.walks (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min int,
  distance_km numeric,
  source text default 'timer' check (source in ('timer','gps','manual')),
  track_points jsonb,
  notes text,
  created_at timestamptz default now()
);
create index if not exists k9_walks_user_idx on k9.walks(user_id, started_at desc);

-- =====================================================================
-- rescue_entries
-- =====================================================================
create table if not exists k9.rescue_entries (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete set null,
  program text default 'rescue_3_3_3',
  text text not null,
  created_at timestamptz default now()
);
create index if not exists k9_rescue_user_idx on k9.rescue_entries(user_id, created_at desc);

-- =====================================================================
-- ai_conversations
-- =====================================================================
create table if not exists k9.ai_conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete set null,
  mode text default 'chat' check (mode in ('chat','plan','scan')),
  question text not null,
  answer text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz default now()
);
create index if not exists k9_ai_user_idx on k9.ai_conversations(user_id, created_at desc);

-- =====================================================================
-- ai_quotas
-- =====================================================================
create table if not exists k9.ai_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
create index if not exists k9_quotas_day_idx on k9.ai_quotas(day);

-- =====================================================================
-- reminder_jobs
-- =====================================================================
create table if not exists k9.reminder_jobs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references k9.calendar_events(id) on delete cascade,
  channel text default 'email' check (channel in ('email','sms','push')),
  fire_at timestamptz not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);
create index if not exists k9_jobs_fire_idx on k9.reminder_jobs(fire_at) where sent_at is null;

-- =====================================================================
-- lost_found_alerts
-- =====================================================================
create table if not exists k9.lost_found_alerts (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lost','found')),
  dog_name text,
  breed text,
  photo_url text,
  photo_data_url text,
  place text not null,
  geo_lat numeric,
  geo_lon numeric,
  description text,
  contact text not null,
  resolved boolean default false,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists k9_alerts_active_idx on k9.lost_found_alerts(created_at desc) where resolved = false;
create index if not exists k9_alerts_geo_idx on k9.lost_found_alerts(geo_lat, geo_lon) where resolved = false;

-- =====================================================================
-- posts
-- =====================================================================
create table if not exists k9.posts (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete set null,
  text text,
  photo_url text,
  place text,
  geo_lat numeric,
  geo_lon numeric,
  like_count int default 0,
  comment_count int default 0,
  created_at timestamptz default now()
);
create index if not exists k9_posts_recent_idx on k9.posts(created_at desc);
create index if not exists k9_posts_user_idx on k9.posts(user_id, created_at desc);

-- =====================================================================
-- friendships
-- =====================================================================
create table if not exists k9.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text default 'accepted' check (status in ('pending','accepted','blocked')),
  created_at timestamptz default now(),
  primary key (user_id, friend_id)
);

-- =====================================================================
-- playdates
-- =====================================================================
create table if not exists k9.playdates (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place text not null,
  geo_lat numeric,
  geo_lon numeric,
  scheduled_at timestamptz not null,
  notes text,
  max_dogs int default 4,
  created_at timestamptz default now()
);
create table if not exists k9.playdate_attendees (
  playdate_id uuid not null references k9.playdates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete set null,
  joined_at timestamptz default now(),
  primary key (playdate_id, user_id)
);

-- =====================================================================
-- share_tokens
-- =====================================================================
create table if not exists k9.share_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references k9.dogs(id) on delete cascade,
  scope text default 'health' check (scope in ('health','full')),
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  last_accessed_at timestamptz,
  access_count int default 0
);
create index if not exists k9_share_expiry_idx on k9.share_tokens(expires_at);

-- =====================================================================
-- push_subscriptions
-- =====================================================================
create table if not exists k9.push_subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
create index if not exists k9_push_user_idx on k9.push_subscriptions(user_id);

-- =====================================================================
-- audit_logs
-- =====================================================================
create table if not exists k9.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb,
  ip inet,
  ua text,
  created_at timestamptz default now()
);
create index if not exists k9_audit_user_idx on k9.audit_logs(user_id, created_at desc);

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table k9.profiles              enable row level security;
alter table k9.dogs                  enable row level security;
alter table k9.calendar_events       enable row level security;
alter table k9.walks                 enable row level security;
alter table k9.rescue_entries        enable row level security;
alter table k9.ai_conversations      enable row level security;
alter table k9.ai_quotas             enable row level security;
alter table k9.reminder_jobs         enable row level security;
alter table k9.lost_found_alerts     enable row level security;
alter table k9.posts                 enable row level security;
alter table k9.friendships           enable row level security;
alter table k9.playdates             enable row level security;
alter table k9.playdate_attendees    enable row level security;
alter table k9.share_tokens          enable row level security;
alter table k9.push_subscriptions    enable row level security;
alter table k9.audit_logs            enable row level security;

drop policy if exists "k9_profiles_self"   on k9.profiles;
drop policy if exists "k9_dogs_self"       on k9.dogs;
drop policy if exists "k9_cal_self"        on k9.calendar_events;
drop policy if exists "k9_walks_self"      on k9.walks;
drop policy if exists "k9_rescue_self"     on k9.rescue_entries;
drop policy if exists "k9_ai_self"         on k9.ai_conversations;
drop policy if exists "k9_quotas_self"     on k9.ai_quotas;
drop policy if exists "k9_jobs_self"       on k9.reminder_jobs;
drop policy if exists "k9_alerts_read"     on k9.lost_found_alerts;
drop policy if exists "k9_alerts_write"    on k9.lost_found_alerts;
drop policy if exists "k9_alerts_update"   on k9.lost_found_alerts;
drop policy if exists "k9_alerts_delete"   on k9.lost_found_alerts;
drop policy if exists "k9_posts_read"      on k9.posts;
drop policy if exists "k9_posts_write"     on k9.posts;
drop policy if exists "k9_posts_update"    on k9.posts;
drop policy if exists "k9_posts_delete"    on k9.posts;
drop policy if exists "k9_friends_self"    on k9.friendships;
drop policy if exists "k9_playdates_read"  on k9.playdates;
drop policy if exists "k9_playdates_write" on k9.playdates;
drop policy if exists "k9_playdates_update" on k9.playdates;
drop policy if exists "k9_playdates_delete" on k9.playdates;
drop policy if exists "k9_attendees_read"  on k9.playdate_attendees;
drop policy if exists "k9_attendees_write" on k9.playdate_attendees;
drop policy if exists "k9_attendees_delete" on k9.playdate_attendees;
drop policy if exists "k9_share_self"      on k9.share_tokens;
drop policy if exists "k9_push_self"       on k9.push_subscriptions;
drop policy if exists "k9_audit_self"      on k9.audit_logs;

-- self-only
create policy "k9_profiles_self"   on k9.profiles          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_dogs_self"       on k9.dogs              for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_cal_self"        on k9.calendar_events   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_walks_self"      on k9.walks             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_rescue_self"     on k9.rescue_entries    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_ai_self"         on k9.ai_conversations  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_quotas_self"     on k9.ai_quotas         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_jobs_self"       on k9.reminder_jobs     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_share_self"      on k9.share_tokens      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_push_self"       on k9.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_audit_self"      on k9.audit_logs        for select using (auth.uid() = user_id);

-- public read tables
create policy "k9_alerts_read"     on k9.lost_found_alerts for select using (true);
create policy "k9_alerts_write"    on k9.lost_found_alerts for insert with check (auth.uid() = user_id);
create policy "k9_alerts_update"   on k9.lost_found_alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_alerts_delete"   on k9.lost_found_alerts for delete using (auth.uid() = user_id);

create policy "k9_posts_read"      on k9.posts             for select using (true);
create policy "k9_posts_write"     on k9.posts             for insert with check (auth.uid() = user_id);
create policy "k9_posts_update"    on k9.posts             for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_posts_delete"    on k9.posts             for delete using (auth.uid() = user_id);

create policy "k9_friends_self"    on k9.friendships       for all
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id);

create policy "k9_playdates_read"  on k9.playdates         for select using (true);
create policy "k9_playdates_write" on k9.playdates         for insert with check (auth.uid() = user_id);
create policy "k9_playdates_update" on k9.playdates        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "k9_playdates_delete" on k9.playdates        for delete using (auth.uid() = user_id);
create policy "k9_attendees_read"  on k9.playdate_attendees for select using (true);
create policy "k9_attendees_write" on k9.playdate_attendees for insert with check (auth.uid() = user_id);
create policy "k9_attendees_delete" on k9.playdate_attendees for delete using (auth.uid() = user_id);

-- =====================================================================
-- Triggers : updated_at auto
-- =====================================================================
create or replace function k9.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists _k9_touch_profiles on k9.profiles;
create trigger _k9_touch_profiles before update on k9.profiles for each row execute procedure k9.touch_updated_at();
drop trigger if exists _k9_touch_dogs on k9.dogs;
create trigger _k9_touch_dogs before update on k9.dogs for each row execute procedure k9.touch_updated_at();
drop trigger if exists _k9_touch_cal on k9.calendar_events;
create trigger _k9_touch_cal before update on k9.calendar_events for each row execute procedure k9.touch_updated_at();
drop trigger if exists _k9_touch_alerts on k9.lost_found_alerts;
create trigger _k9_touch_alerts before update on k9.lost_found_alerts for each row execute procedure k9.touch_updated_at();

-- =====================================================================
-- Trigger : on auth.users insert → create k9.profiles row
-- IMPORTANT : nom de trigger unique (`_on_auth_user_created_k9`) pour
-- coexister avec d'éventuels triggers d'autres produits (ex. ravito).
-- =====================================================================
create or replace function k9.handle_new_user()
returns trigger language plpgsql security definer set search_path = k9, public, auth as $$
begin
  insert into k9.profiles (user_id, email, lang)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'lang','fr'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists _on_auth_user_created_k9 on auth.users;
create trigger _on_auth_user_created_k9
  after insert on auth.users
  for each row execute procedure k9.handle_new_user();

-- =====================================================================
-- RPC : increment AI quota (atomic) — 3/day free, Plus/Pro = bypass
-- =====================================================================
create or replace function k9.ai_quota_increment(p_limit int default 3)
returns table (allowed boolean, count_after int, day date)
language plpgsql security definer set search_path = k9, public as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Europe/Paris')::date;
  v_plan text;
  v_count int;
begin
  if v_user is null then
    return query select false, 0, v_day;
    return;
  end if;
  select plan into v_plan from k9.profiles where user_id = v_user;
  if v_plan in ('plus','pro') then
    insert into k9.ai_quotas(user_id, day, count) values (v_user, v_day, 1)
      on conflict (user_id, day) do update set count = k9.ai_quotas.count + 1
      returning count into v_count;
    return query select true, v_count, v_day;
    return;
  end if;
  insert into k9.ai_quotas(user_id, day, count) values (v_user, v_day, 1)
    on conflict (user_id, day) do update set count = k9.ai_quotas.count + 1
    returning count into v_count;
  if v_count > p_limit then
    update k9.ai_quotas set count = count - 1 where user_id = v_user and day = v_day;
    return query select false, v_count - 1, v_day;
  else
    return query select true, v_count, v_day;
  end if;
end;
$$;
grant execute on function k9.ai_quota_increment(int) to authenticated;

-- =====================================================================
-- RPC : alerts_nearby (haversine approximatif). Retourne setof
-- k9.lost_found_alerts pour matcher exactement la table — tri par
-- distance fait dans l'ORDER BY (sans colonne supplémentaire).
-- =====================================================================
create or replace function k9.alerts_nearby(
  p_lat numeric default null,
  p_lon numeric default null,
  p_radius_km numeric default 30,
  p_limit int default 50
)
returns setof k9.lost_found_alerts
language plpgsql stable as $$
begin
  if p_lat is null or p_lon is null then
    return query
      select * from k9.lost_found_alerts
      where resolved = false
      order by created_at desc
      limit p_limit;
  else
    return query
      select * from k9.lost_found_alerts
      where resolved = false
        and geo_lat is not null and geo_lon is not null
        and 111.0 * sqrt(power(geo_lat - p_lat, 2) + power((geo_lon - p_lon) * cos(radians(p_lat)), 2)) <= p_radius_km
      order by 111.0 * sqrt(power(geo_lat - p_lat, 2) + power((geo_lon - p_lon) * cos(radians(p_lat)), 2)) asc
      limit p_limit;
  end if;
end;
$$;
grant execute on function k9.alerts_nearby(numeric,numeric,numeric,int) to anon, authenticated;
