-- =====================================================================
-- LOGIX — Sistema de Trazabilidad y Última Milla
-- Script de inicialización para Supabase (PostgreSQL)
-- Sin gestión de sucursales. Roles: admin, coordinador, bodega, motorista
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'coordinador', 'bodega', 'motorista');

create type public.package_status as enum (
  'registrado',           -- escaneado en manifiesto, aún no en ruta
  'en_ruta',              -- manifiesto cerrado, motorista en camino
  'entregado',            -- entrega exitosa al cliente final
  'no_entregado',         -- incidencia / no se pudo entregar
  'recibido_bodega'       -- recepción masiva en bodega destino
);

create type public.manifest_status as enum ('abierto', 'cerrado', 'recibido', 'anulado');

create type public.incident_reason as enum (
  'cliente_ausente',
  'direccion_incorrecta',
  'rechazado_por_cliente',
  'paquete_danado',
  'zona_insegura',
  'otro'
);

-- ---------------------------------------------------------------------
-- 2. PERFILES (extiende auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'motorista',
  dni text,
  phone text,
  vehicle_plate text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil y rol de cada usuario. El rol determina el panel al que es redirigido al iniciar sesión.';

-- Trigger: crear perfil automáticamente cuando se crea un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'motorista')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger genérico updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. JORNADAS (Módulo 1 — inicio de ruta del motorista)
-- ---------------------------------------------------------------------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id),
  driver_name_snapshot text not null,
  driver_dni_snapshot text not null,
  vehicle_plate_snapshot text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_shifts_driver on public.shifts(driver_id);

-- ---------------------------------------------------------------------
-- 4. MANIFIESTOS (Módulo 2 — cierre de lote / QR maestro)
-- ---------------------------------------------------------------------
create table public.manifests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- código corto legible, ej: MAN-20260920-0001
  qr_payload text not null unique,        -- contenido codificado en el QR maestro
  shift_id uuid not null references public.shifts(id),
  driver_id uuid not null references public.profiles(id),
  status public.manifest_status not null default 'abierto',
  total_packages int not null default 0,
  closed_at timestamptz,
  received_at timestamptz,
  received_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_manifests_driver on public.manifests(driver_id);
create index idx_manifests_status on public.manifests(status);

-- ---------------------------------------------------------------------
-- 5. PAQUETES / TICKETS (unidad trazable, escaneada en ráfaga)
-- ---------------------------------------------------------------------
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,     -- código de barras / OCR (ej. RF-XXXXXX)
  manifest_id uuid references public.manifests(id),
  status public.package_status not null default 'registrado',
  captured_via text not null default 'scan' check (captured_via in ('scan','ocr','manual')),
  client_signature_url text,              -- POD (Módulo 4)
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_packages_manifest on public.packages(manifest_id);
create index idx_packages_status on public.packages(status);

create trigger trg_packages_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. EVENTOS DE TRAZABILIDAD (historial inmutable, incl. offline sync)
-- ---------------------------------------------------------------------
create table public.package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  status public.package_status not null,
  recorded_by uuid references public.profiles(id),
  recorded_at timestamptz not null,        -- timestamp original capturado offline en el dispositivo
  synced_at timestamptz not null default now(), -- cuándo llegó al servidor
  latitude numeric(9,6),
  longitude numeric(9,6),
  client_uuid text not null unique,        -- idempotencia: generado en el dispositivo para evitar duplicados al reintentar sync
  notes text,
  created_at timestamptz not null default now()
);

create index idx_package_events_package on public.package_events(package_id);

-- ---------------------------------------------------------------------
-- 7. INCIDENCIAS / RECLAMOS (Módulo 3 — con evidencia fotográfica)
-- ---------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  reason public.incident_reason not null,
  description text,
  photo_url text,                          -- Supabase Storage: bucket 'evidence'
  reported_by uuid references public.profiles(id),
  reported_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index idx_incidents_package on public.incidents(package_id);

-- ---------------------------------------------------------------------
-- 8. FIRMAS DIGITALES / POD (Módulo 4)
-- ---------------------------------------------------------------------
create table public.proof_of_delivery (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid references public.manifests(id),
  package_id uuid references public.packages(id),
  signer_name text,
  signature_url text not null,             -- imagen PNG en Supabase Storage: bucket 'signatures'
  received_by uuid references public.profiles(id),
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. SLA (reglas de servicio, Módulo 5)
-- ---------------------------------------------------------------------
create table public.sla_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_hours_to_deliver int not null,
  alert_threshold_hours int not null,      -- horas antes del vencimiento para disparar alerta
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. BITÁCORA DE AUDITORÍA (Módulo 5)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor on public.audit_logs(actor_id);
create index idx_audit_logs_entity on public.audit_logs(entity, entity_id);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.manifests enable row level security;
alter table public.packages enable row level security;
alter table public.package_events enable row level security;
alter table public.incidents enable row level security;
alter table public.proof_of_delivery enable row level security;
alter table public.sla_rules enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: rol del usuario autenticado actual
create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- --- profiles ---
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.current_role() in ('admin','coordinador','bodega')
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_manage"
  on public.profiles for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- --- shifts ---
create policy "shifts_driver_own"
  on public.shifts for select
  using (driver_id = auth.uid() or public.current_role() in ('admin','coordinador'));

create policy "shifts_driver_insert"
  on public.shifts for insert
  with check (driver_id = auth.uid() or public.current_role() = 'admin');

create policy "shifts_driver_update_own"
  on public.shifts for update
  using (driver_id = auth.uid() or public.current_role() = 'admin');

-- --- manifests ---
create policy "manifests_visibility"
  on public.manifests for select
  using (
    driver_id = auth.uid()
    or public.current_role() in ('admin','coordinador','bodega')
  );

create policy "manifests_driver_create"
  on public.manifests for insert
  with check (driver_id = auth.uid() or public.current_role() = 'admin');

create policy "manifests_update"
  on public.manifests for update
  using (
    driver_id = auth.uid()
    or public.current_role() in ('admin','coordinador','bodega')
  );

-- --- packages ---
create policy "packages_visibility"
  on public.packages for select
  using (public.current_role() in ('admin','coordinador','bodega')
    or exists (
      select 1 from public.manifests m
      where m.id = packages.manifest_id and m.driver_id = auth.uid()
    ));

create policy "packages_insert"
  on public.packages for insert
  with check (public.current_role() in ('admin','coordinador')
    or exists (
      select 1 from public.manifests m
      where m.id = packages.manifest_id and m.driver_id = auth.uid()
    ));

create policy "packages_update"
  on public.packages for update
  using (public.current_role() in ('admin','coordinador','bodega')
    or exists (
      select 1 from public.manifests m
      where m.id = packages.manifest_id and m.driver_id = auth.uid()
    ));

-- --- package_events ---
create policy "package_events_visibility"
  on public.package_events for select
  using (public.current_role() in ('admin','coordinador','bodega')
    or recorded_by = auth.uid());

create policy "package_events_insert"
  on public.package_events for insert
  with check (recorded_by = auth.uid() or public.current_role() = 'admin');

-- --- incidents ---
create policy "incidents_visibility"
  on public.incidents for select
  using (public.current_role() in ('admin','coordinador','bodega')
    or reported_by = auth.uid());

create policy "incidents_insert"
  on public.incidents for insert
  with check (reported_by = auth.uid() or public.current_role() = 'admin');

create policy "incidents_update_staff"
  on public.incidents for update
  using (public.current_role() in ('admin','coordinador'));

-- --- proof_of_delivery ---
create policy "pod_visibility"
  on public.proof_of_delivery for select
  using (public.current_role() in ('admin','coordinador','bodega')
    or received_by = auth.uid());

create policy "pod_insert"
  on public.proof_of_delivery for insert
  with check (received_by = auth.uid() or public.current_role() = 'admin');

-- --- sla_rules ---
create policy "sla_read_all_staff"
  on public.sla_rules for select
  using (public.current_role() in ('admin','coordinador','bodega'));

create policy "sla_admin_write"
  on public.sla_rules for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- --- audit_logs ---
create policy "audit_read_admin_coord"
  on public.audit_logs for select
  using (public.current_role() in ('admin','coordinador'));

create policy "audit_insert_any_authenticated"
  on public.audit_logs for insert
  with check (auth.uid() is not null);

-- =====================================================================
-- STORAGE BUCKETS (ejecutar también desde el dashboard o vía API)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('signatures', 'signatures', false)
  on conflict (id) do nothing;

create policy "evidence_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'evidence' and auth.role() = 'authenticated');

create policy "evidence_authenticated_upload"
  on storage.objects for insert
  with check (bucket_id = 'evidence' and auth.role() = 'authenticated');

create policy "signatures_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'signatures' and auth.role() = 'authenticated');

create policy "signatures_authenticated_upload"
  on storage.objects for insert
  with check (bucket_id = 'signatures' and auth.role() = 'authenticated');

-- =====================================================================
-- REALTIME (para el dashboard del Módulo 5)
-- =====================================================================
alter publication supabase_realtime add table public.packages;
alter publication supabase_realtime add table public.manifests;
alter publication supabase_realtime add table public.incidents;

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================
