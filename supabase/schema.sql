-- MyShift — Schéma Supabase
-- Exécuter dans l'éditeur SQL Supabase (Settings > SQL Editor)

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id             uuid references auth.users on delete cascade primary key,
  pseudo         text unique not null,
  role           text not null default 'user' check (role in ('admin', 'user')),
  target_lph     integer not null default 80,
  supabase_email text,   -- email réel utilisé pour Supabase Auth (null = fake email {pseudo}@myshift.internal)
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chaque user voit/modifie son propre profil
-- L'admin voit tous les profils (check via app_metadata dans le JWT pour éviter la récursion)
create policy "profiles_select"
  on public.profiles for select
  using (
    auth.uid() = id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_admin_all"
  on public.profiles for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- PAUSE SCHEDULES
-- ============================================================
create table public.pause_schedules (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  name                text not null,
  scheduled_time      time not null,
  duration_minutes    integer not null check (duration_minutes > 0),
  is_system_deducted  boolean not null default false,
  order_index         integer not null default 0,
  created_at          timestamptz not null default now()
);

alter table public.pause_schedules enable row level security;

create policy "pause_schedules_own"
  on public.pause_schedules for all
  using (auth.uid() = user_id);

-- ============================================================
-- WORK SESSIONS
-- ============================================================
create table public.work_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  date                date not null,
  arrived_at          timestamptz,
  pad_connected_at    timestamptz,
  pad_disconnected_at timestamptz,
  left_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.work_sessions enable row level security;

create policy "sessions_own"
  on public.work_sessions for all
  using (auth.uid() = user_id);

-- ============================================================
-- MISSIONS
-- ============================================================
create table public.missions (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.work_sessions(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  mission_number   integer not null default 1,
  support_type     text not null check (support_type in ('role', 'palette')),
  support_count    smallint not null default 1 check (support_count between 1 and 3),
  started_at       timestamptz,
  ended_at         timestamptz,
  total_pad_lines  integer not null default 0,
  total_weight_kg  numeric(8,2) not null default 0,
  total_liters     numeric(8,2),
  created_at       timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy "missions_own"
  on public.missions for all
  using (auth.uid() = user_id);

-- ============================================================
-- MISSION SUPPORTS
-- ============================================================
create table public.mission_supports (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references public.missions(id) on delete cascade,
  support_index smallint not null,
  label         text not null,
  pad_lines     integer not null default 0,
  weight_kg     numeric(8,2) not null default 0,
  liters        numeric(8,2),
  created_at    timestamptz not null default now()
);

alter table public.mission_supports enable row level security;

create policy "mission_supports_own"
  on public.mission_supports for all
  using (
    exists (
      select 1 from public.missions m
      where m.id = mission_id and m.user_id = auth.uid()
    )
  );

-- ============================================================
-- PAUSES
-- ============================================================
create table public.pauses (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.work_sessions(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  started_at         timestamptz not null,
  ended_at           timestamptz,
  is_system_deducted boolean not null default false,
  schedule_id        uuid references public.pause_schedules(id) on delete set null,
  created_at         timestamptz not null default now()
);

alter table public.pauses enable row level security;

create policy "pauses_own"
  on public.pauses for all
  using (auth.uid() = user_id);

-- ============================================================
-- PRODUCTION SNAPSHOTS
-- ============================================================
create table public.production_snapshots (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.work_sessions(id) on delete cascade,
  mission_id        uuid not null references public.missions(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  total_final_lines integer not null check (total_final_lines >= 0),
  created_at        timestamptz not null default now()
);

alter table public.production_snapshots enable row level security;

create policy "snapshots_own"
  on public.production_snapshots for all
  using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER : auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo, role, target_lph)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'pseudo', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'role', 'user'),
    80
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FUNCTION : créer les pauses par défaut pour un utilisateur
-- ============================================================
create or replace function public.create_default_pause_schedules(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.pause_schedules
    (user_id, name, scheduled_time, duration_minutes, is_system_deducted, order_index)
  values
    (p_user_id, 'Pause 14h00', '14:00:00', 10, false, 1),
    (p_user_id, 'Pause 16h00', '16:00:00', 21, true,  2),
    (p_user_id, 'Pause 18h00', '18:00:00', 10, false, 3);
end;
$$;
