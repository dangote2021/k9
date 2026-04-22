-- =====================================================================
-- K9 — Supabase schema (v1)
-- =====================================================================
-- À déployer quand on passe en mode "comptes + sync multi-device".
-- Tant qu'on est en localStorage-only, ce fichier n'est qu'une référence.
--
-- Pour activer :
--   1. Créer un projet Supabase
--   2. Exécuter ce script dans le SQL Editor
--   3. Ajouter SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_KEY
--      dans les env vars Vercel
--   4. Déployer /api/sync.js (stub déjà présent, décommenter la partie DB)
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =====================================================================
-- users : profil propriétaire (auth.users géré par Supabase Auth)
-- =====================================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  lang text default 'fr' check (lang in ('fr','en')),
  use_imperial boolean default false,
  ai_soft_mode boolean default false,
  a11y_large boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================================
-- dogs : la meute du propriétaire (multi-chiens)
-- =====================================================================
create table if not exists public.dogs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed_idx int,
  years int default 0,
  months int default 0,
  sex text check (sex in ('m','f') or sex is null),
  weight_kg numeric,
  emoji text default '🐕',
  coat text,
  photo_data_url text,  -- base64 small, else storage bucket URL
  is_active boolean default false,
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists dogs_user_idx on public.dogs(user_id);

-- =====================================================================
-- calendar_events : vaccins, vermifuges, RDV véto, anniversaires…
-- =====================================================================
create table if not exists public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  type text not null check (type in ('vax','worm','vet','birth','food','other')),
  title text not null,
  event_date date not null,
  notes text,
  reminded_at timestamptz,          -- dernière fois qu'on a fired le rappel
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists cal_user_date_idx on public.calendar_events(user_id, event_date);

-- =====================================================================
-- walks : historique balades
-- =====================================================================
create table if not exists public.walks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min int,
  distance_km numeric,
  source text default 'timer',     -- 'timer' | 'gps' | 'manual'
  notes text,
  created_at timestamptz default now()
);
create index if not exists walks_user_idx on public.walks(user_id, started_at desc);

-- =====================================================================
-- rescue_entries : journal des programmes (3-3-3, 100 premiers jours…)
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
-- ai_conversations : historique des échanges Claude (pour continuité)
-- =====================================================================
create table if not exists public.ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  mode text default 'chat' check (mode in ('chat','plan')),
  question text not null,
  answer text,
  created_at timestamptz default now()
);

-- =====================================================================
-- reminder_jobs : notifications email / SMS planifiées (géré par cron)
-- =====================================================================
create table if not exists public.reminder_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.calendar_events(id) on delete cascade,
  channel text default 'email' check (channel in ('email','sms','push')),
  fire_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists jobs_fire_idx on public.reminder_jobs(fire_at) where sent_at is null;

-- =====================================================================
-- Row-level security : chaque utilisateur ne voit que ses données
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.dogs              enable row level security;
alter table public.calendar_events   enable row level security;
alter table public.walks             enable row level security;
alter table public.rescue_entries    enable row level security;
alter table public.ai_conversations  enable row level security;
alter table public.reminder_jobs     enable row level security;

-- Policies : user_id = auth.uid()
create policy "profiles_self"   on public.profiles          for all using (auth.uid() = user_id);
create policy "dogs_self"       on public.dogs              for all using (auth.uid() = user_id);
create policy "cal_self"        on public.calendar_events   for all using (auth.uid() = user_id);
create policy "walks_self"      on public.walks             for all using (auth.uid() = user_id);
create policy "rescue_self"     on public.rescue_entries    for all using (auth.uid() = user_id);
create policy "ai_self"         on public.ai_conversations  for all using (auth.uid() = user_id);
create policy "jobs_self"       on public.reminder_jobs     for all using (auth.uid() = user_id);

-- =====================================================================
-- Trigger : updated_at auto
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
