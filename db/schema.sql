-- =====================================================================
-- K9 — Supabase schema (v2 — backend production-ready)
-- =====================================================================
-- Inspiré du pattern Adventurer : RLS stricte par défaut, ownership via
-- auth.uid(), index ciblés sur les colonnes filtrées côté API, triggers
-- updated_at génériques. Schéma conçu pour le client single-file HTML :
-- une source de vérité serveur (quand connecté), fallback localStorage
-- sinon.
--
-- Déploiement :
--   1. supabase.com → Nouveau projet
--   2. SQL Editor → coller ce script → Run
--   3. Storage → créer 2 buckets :
--        • dog-photos       (public read, write authenticated)
--        • alert-photos     (public read, write authenticated)
--        • vet-scans        (private, write authenticated)
--   4. Authentication → activer "Email (magic link)"
--   5. Variables Vercel : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- recherche fuzzy lieu (alertes)
create extension if not exists "postgis" with schema extensions;  -- geo-search alertes / feed

-- =====================================================================
-- profiles : données propriétaire (référence auth.users)
-- =====================================================================
create table if not exists public.profiles (
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
  -- Geo (pour feed + alertes locales)
  approx_city text,
  geo_lat numeric,
  geo_lon numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================================
-- dogs : la meute du propriétaire
-- =====================================================================
create table if not exists public.dogs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed_idx int,
  years int default 0,
  months int default 0,
  sex text check (sex in ('m','f','male','female') or sex is null),
  weight_kg numeric,
  emoji text default '🐕',
  coat text,
  photo_url text,          -- Storage bucket URL
  photo_data_url text,     -- fallback base64 (ancien client)
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
create index if not exists dogs_user_idx on public.dogs(user_id);
create index if not exists dogs_user_active_idx on public.dogs(user_id, is_active) where is_active = true;

-- =====================================================================
-- calendar_events : vaccins, vermifuges, RDV véto, anniversaires…
-- =====================================================================
create table if not exists public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  type text not null check (type in ('vax','worm','vet','birth','food','treatment','other')),
  title text not null,
  event_date date not null,
  notes text,
  reminded_at timestamptz,          -- dernier rappel envoyé
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists cal_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists cal_date_unsent_idx on public.calendar_events(event_date) where reminded_at is null;

-- =====================================================================
-- walks : historique balades (timer ou GPS réel)
-- =====================================================================
create table if not exists public.walks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min int,
  distance_km numeric,
  source text default 'timer' check (source in ('timer','gps','manual')),
  track_points jsonb,            -- [[lat,lon,ts], ...] si source=gps
  notes text,
  created_at timestamptz default now()
);
create index if not exists walks_user_idx on public.walks(user_id, started_at desc);

-- =====================================================================
-- rescue_entries : journal des programmes 3-3-3 / 100 premiers jours…
-- =====================================================================
create table if not exists public.rescue_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  program text default 'rescue_3_3_3',
  text text not null,
  created_at timestamptz default now()
);
create index if not exists rescue_user_idx on public.rescue_entries(user_id, created_at desc);

-- =====================================================================
-- ai_conversations : historique Claude (continuité + audit)
-- =====================================================================
create table if not exists public.ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  mode text default 'chat' check (mode in ('chat','plan','scan')),
  question text not null,
  answer text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz default now()
);
create index if not exists ai_user_idx on public.ai_conversations(user_id, created_at desc);

-- =====================================================================
-- ai_quotas : compteurs IA journaliers (3/jour en free, illimité Plus/Pro)
-- =====================================================================
create table if not exists public.ai_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
create index if not exists quotas_day_idx on public.ai_quotas(day);

-- =====================================================================
-- reminder_jobs : file d'attente de notifications (email / push)
-- =====================================================================
create table if not exists public.reminder_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.calendar_events(id) on delete cascade,
  channel text default 'email' check (channel in ('email','sms','push')),
  fire_at timestamptz not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);
create index if not exists jobs_fire_idx on public.reminder_jobs(fire_at) where sent_at is null;

-- =====================================================================
-- lost_found_alerts : signalements chiens perdus/trouvés
-- =====================================================================
create table if not exists public.lost_found_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lost','found')),
  dog_name text,
  breed text,
  photo_url text,              -- Storage bucket URL
  photo_data_url text,         -- fallback base64
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
create index if not exists alerts_active_idx on public.lost_found_alerts(created_at desc) where resolved = false;
create index if not exists alerts_geo_idx on public.lost_found_alerts(geo_lat, geo_lon) where resolved = false;

-- =====================================================================
-- posts : feed communautaire (photo + texte + géoloc)
-- =====================================================================
create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  text text,
  photo_url text,
  place text,
  geo_lat numeric,
  geo_lon numeric,
  like_count int default 0,
  comment_count int default 0,
  created_at timestamptz default now()
);
create index if not exists posts_recent_idx on public.posts(created_at desc);
create index if not exists posts_user_idx on public.posts(user_id, created_at desc);

-- =====================================================================
-- friendships : liens entre propriétaires (symétriques, 2 lignes par paire)
-- =====================================================================
create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text default 'accepted' check (status in ('pending','accepted','blocked')),
  created_at timestamptz default now(),
  primary key (user_id, friend_id)
);

-- =====================================================================
-- playdates : rendez-vous au parc entre chiens/propriétaires
-- =====================================================================
create table if not exists public.playdates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place text not null,
  geo_lat numeric,
  geo_lon numeric,
  scheduled_at timestamptz not null,
  notes text,
  max_dogs int default 4,
  created_at timestamptz default now()
);
create table if not exists public.playdate_attendees (
  playdate_id uuid not null references public.playdates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  joined_at timestamptz default now(),
  primary key (playdate_id, user_id)
);

-- =====================================================================
-- share_tokens : liens lecture seule pour véto / pension (TTL)
-- =====================================================================
create table if not exists public.share_tokens (
  token text primary key,                              -- nanoid signé
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete cascade,
  scope text default 'health' check (scope in ('health','full')),
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  last_accessed_at timestamptz,
  access_count int default 0
);
create index if not exists share_expiry_idx on public.share_tokens(expires_at);

-- =====================================================================
-- push_subscriptions : endpoints Web Push des navigateurs
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
create index if not exists push_user_idx on public.push_subscriptions(user_id);

-- =====================================================================
-- audit_logs : traces sensibles (partage véto, upgrade Stripe…)
-- =====================================================================
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,                     -- 'share.created', 'share.accessed', 'plan.upgraded', ...
  payload jsonb,
  ip inet,
  ua text,
  created_at timestamptz default now()
);
create index if not exists audit_user_idx on public.audit_logs(user_id, created_at desc);

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.dogs                  enable row level security;
alter table public.calendar_events       enable row level security;
alter table public.walks                 enable row level security;
alter table public.rescue_entries        enable row level security;
alter table public.ai_conversations      enable row level security;
alter table public.ai_quotas             enable row level security;
alter table public.reminder_jobs         enable row level security;
alter table public.lost_found_alerts     enable row level security;
alter table public.posts                 enable row level security;
alter table public.friendships           enable row level security;
alter table public.playdates             enable row level security;
alter table public.playdate_attendees    enable row level security;
alter table public.share_tokens          enable row level security;
alter table public.push_subscriptions    enable row level security;
alter table public.audit_logs            enable row level security;

-- Drop/recreate policies (idempotence)
drop policy if exists "profiles_self"   on public.profiles;
drop policy if exists "dogs_self"       on public.dogs;
drop policy if exists "cal_self"        on public.calendar_events;
drop policy if exists "walks_self"      on public.walks;
drop policy if exists "rescue_self"     on public.rescue_entries;
drop policy if exists "ai_self"         on public.ai_conversations;
drop policy if exists "quotas_self"     on public.ai_quotas;
drop policy if exists "jobs_self"       on public.reminder_jobs;
drop policy if exists "alerts_read"     on public.lost_found_alerts;
drop policy if exists "alerts_write"    on public.lost_found_alerts;
drop policy if exists "posts_read"      on public.posts;
drop policy if exists "posts_write"     on public.posts;
drop policy if exists "friends_self"    on public.friendships;
drop policy if exists "playdates_read"  on public.playdates;
drop policy if exists "playdates_write" on public.playdates;
drop policy if exists "attendees_read"  on public.playdate_attendees;
drop policy if exists "attendees_write" on public.playdate_attendees;
drop policy if exists "share_self"      on public.share_tokens;
drop policy if exists "push_self"       on public.push_subscriptions;
drop policy if exists "audit_self"      on public.audit_logs;

-- "self-only" tables (données sensibles propriétaire)
create policy "profiles_self"   on public.profiles          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dogs_self"       on public.dogs              for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cal_self"        on public.calendar_events   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "walks_self"      on public.walks             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rescue_self"     on public.rescue_entries    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_self"         on public.ai_conversations  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quotas_self"     on public.ai_quotas         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "jobs_self"       on public.reminder_jobs     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "share_self"      on public.share_tokens      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_self"       on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "audit_self"      on public.audit_logs        for select using (auth.uid() = user_id);

-- "public read" tables (alertes + feed)
create policy "alerts_read"     on public.lost_found_alerts for select using (true);
create policy "alerts_write"    on public.lost_found_alerts for insert with check (auth.uid() = user_id);
create policy "alerts_update"   on public.lost_found_alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alerts_delete"   on public.lost_found_alerts for delete using (auth.uid() = user_id);

create policy "posts_read"      on public.posts             for select using (true);
create policy "posts_write"     on public.posts             for insert with check (auth.uid() = user_id);
create policy "posts_update"    on public.posts             for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts_delete"    on public.posts             for delete using (auth.uid() = user_id);

-- Friendships : les deux côtés peuvent lire
create policy "friends_self"    on public.friendships       for all
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id);

-- Playdates : lecture publique, écriture owner
create policy "playdates_read"  on public.playdates         for select using (true);
create policy "playdates_write" on public.playdates         for insert with check (auth.uid() = user_id);
create policy "playdates_update" on public.playdates        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "playdates_delete" on public.playdates        for delete using (auth.uid() = user_id);
create policy "attendees_read"  on public.playdate_attendees for select using (true);
create policy "attendees_write" on public.playdate_attendees for insert with check (auth.uid() = user_id);
create policy "attendees_delete" on public.playdate_attendees for delete using (auth.uid() = user_id);

-- =====================================================================
-- Triggers : updated_at auto
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists _touch_profiles on public.profiles;
create trigger _touch_profiles before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists _touch_dogs on public.dogs;
create trigger _touch_dogs before update on public.dogs for each row execute procedure public.touch_updated_at();
drop trigger if exists _touch_cal on public.calendar_events;
create trigger _touch_cal before update on public.calendar_events for each row execute procedure public.touch_updated_at();
drop trigger if exists _touch_alerts on public.lost_found_alerts;
create trigger _touch_alerts before update on public.lost_found_alerts for each row execute procedure public.touch_updated_at();

-- =====================================================================
-- Trigger : on auth.users insert → create profile row
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, email, lang)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'lang','fr'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists _on_auth_user_created on auth.users;
create trigger _on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- RPC : increment AI quota (atomic) — 3/day free, Plus/Pro = bypass
-- =====================================================================
create or replace function public.ai_quota_increment(p_limit int default 3)
returns table (allowed boolean, count_after int, day date)
language plpgsql security definer as $$
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
  select plan into v_plan from public.profiles where user_id = v_user;
  -- Bypass quota pour Plus/Pro
  if v_plan in ('plus','pro') then
    insert into public.ai_quotas(user_id, day, count) values (v_user, v_day, 1)
      on conflict (user_id, day) do update set count = public.ai_quotas.count + 1
      returning count into v_count;
    return query select true, v_count, v_day;
    return;
  end if;
  -- Free : check + incr
  insert into public.ai_quotas(user_id, day, count) values (v_user, v_day, 1)
    on conflict (user_id, day) do update set count = public.ai_quotas.count + 1
    returning count into v_count;
  if v_count > p_limit then
    -- rollback (décrémenter)
    update public.ai_quotas set count = count - 1 where user_id = v_user and day = v_day;
    return query select false, v_count - 1, v_day;
  else
    return query select true, v_count, v_day;
  end if;
end;
$$;
grant execute on function public.ai_quota_increment(int) to authenticated;

-- =====================================================================
-- RPC : alerts nearby (haversine approximatif pour petites distances)
-- =====================================================================
create or replace function public.alerts_nearby(
  p_lat numeric default null,
  p_lon numeric default null,
  p_radius_km numeric default 30,
  p_limit int default 50
)
returns setof public.lost_found_alerts
language plpgsql stable as $$
begin
  if p_lat is null or p_lon is null then
    return query
      select * from public.lost_found_alerts
      where resolved = false
      order by created_at desc
      limit p_limit;
  else
    return query
      select *,
        111.0 * sqrt(power(geo_lat - p_lat, 2) + power((geo_lon - p_lon) * cos(radians(p_lat)), 2)) as dist_km
      from public.lost_found_alerts
      where resolved = false
        and geo_lat is not null and geo_lon is not null
        and 111.0 * sqrt(power(geo_lat - p_lat, 2) + power((geo_lon - p_lon) * cos(radians(p_lat)), 2)) <= p_radius_km
      order by dist_km asc
      limit p_limit;
  end if;
end;
$$;
grant execute on function public.alerts_nearby(numeric,numeric,numeric,int) to anon, authenticated;
