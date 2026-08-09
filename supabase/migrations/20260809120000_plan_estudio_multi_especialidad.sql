-- Aplicada al proyecto Supabase `temarios-opos` (hulbafouyprldwclyjsq)
-- el 9 de agosto de 2026. Capa de estudio multi-especialidad montada sobre el
-- esqueleto ya existente: profiles, temarios, purchases, subscriptions.

create table if not exists public.temas (
  id uuid primary key default extensions.uuid_generate_v4(),
  temario_id uuid not null references public.temarios(id) on delete cascade,
  numero integer not null,
  titulo text not null,
  bloque_id text,
  bloque_nombre text,
  recurso_url text,
  bytes_texto integer default 0,
  actualizado date,
  created_at timestamptz not null default now(),
  unique (temario_id, numero)
);

create table if not exists public.rubricas (
  id uuid primary key default extensions.uuid_generate_v4(),
  temario_id uuid not null references public.temarios(id) on delete cascade,
  anio integer not null,
  contenido jsonb not null,
  vigente boolean not null default true,
  created_at timestamptz not null default now(),
  unique (temario_id, anio)
);

create table if not exists public.supuestos (
  id uuid primary key default extensions.uuid_generate_v4(),
  temario_id uuid not null references public.temarios(id) on delete cascade,
  codigo text not null,
  anio integer,
  oficial boolean not null default false,
  tipo text not null,
  contenido jsonb not null,
  created_at timestamptz not null default now(),
  unique (temario_id, codigo)
);

create table if not exists public.planes (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  temario_id uuid not null references public.temarios(id) on delete cascade,
  fecha_inicio date not null,
  fecha_prueba date not null,
  disponibilidad jsonb not null default
    '{"porDiaSemana":[90,60,60,60,60,0,150],"excepciones":{}}'::jsonb,
  objetivo_temas integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, temario_id)
);

create table if not exists public.progreso_temas (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  temario_id uuid not null references public.temarios(id) on delete cascade,
  tema_numero integer not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','leido','esquematizado','memorizado','dominado')),
  vueltas integer not null default 0,
  ultimo_repaso date,
  minutos_invertidos integer not null default 0,
  confianza smallint check (confianza between 1 and 5),
  notas text,
  updated_at timestamptz not null default now(),
  unique (user_id, temario_id, tema_numero)
);

create table if not exists public.sesiones_estudio (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  temario_id uuid not null references public.temarios(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('estudio','repaso','supuesto','ud','hito')),
  tema_numero integer,
  minutos integer not null check (minutos >= 0),
  completada boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sesiones_estudio_user_fecha_idx
  on public.sesiones_estudio (user_id, fecha desc);

create table if not exists public.intentos_supuesto (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supuesto_id uuid references public.supuestos(id) on delete set null,
  fecha date not null default current_date,
  minutos integer not null default 0,
  texto text,
  autoevaluacion jsonb,
  nota numeric(4,2) check (nota >= 0 and nota <= 10),
  created_at timestamptz not null default now()
);
create index if not exists intentos_supuesto_user_idx
  on public.intentos_supuesto (user_id, fecha desc);

alter table public.temas             enable row level security;
alter table public.rubricas          enable row level security;
alter table public.supuestos         enable row level security;
alter table public.planes            enable row level security;
alter table public.progreso_temas    enable row level security;
alter table public.sesiones_estudio  enable row level security;
alter table public.intentos_supuesto enable row level security;

create policy "temas legibles"    on public.temas    for select to authenticated using (true);
create policy "rubricas legibles" on public.rubricas for select to authenticated using (true);
create policy "supuestos legibles" on public.supuestos for select to authenticated using (true);

create policy "planes propios"   on public.planes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progreso propio"  on public.progreso_temas
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sesiones propias" on public.sesiones_estudio
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "intentos propios" on public.intentos_supuesto
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists planes_touch on public.planes;
create trigger planes_touch before update on public.planes
  for each row execute function public.touch_updated_at();

drop trigger if exists progreso_touch on public.progreso_temas;
create trigger progreso_touch before update on public.progreso_temas
  for each row execute function public.touch_updated_at();

insert into public.temarios (slug, nombre, descripcion, total_temas, precio_cents, activo)
values ('filosofia-secundaria',
        'Filosofía — Cuerpo de Profesores de Enseñanza Secundaria (590/201)',
        'Temario oficial de 71 temas (Orden de 9 de septiembre de 1993, BOE-A-1993-23257).',
        71, 0, true)
on conflict (slug) do nothing;
