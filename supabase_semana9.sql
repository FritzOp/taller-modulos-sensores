-- ==============================================================================
-- GEOCAM · SEMANA 9: sincronización en dos sentidos con borrado lógico
-- Ejecutar UNA sola vez, DESPUÉS de supabase_schema.sql.
-- ==============================================================================

-- 1. IDENTIDAD COMPARTIDA, BORRADO LÓGICO Y RELOJ DEL SERVIDOR
-- client_id:         UUID creado en el teléfono; es la llave del upsert.
-- deleted_at:        marca de borrado (la fila nunca se borra con DELETE).
-- server_updated_at: cuándo llegó el cambio a Supabase; es el cursor de bajada.
alter table public.geocam_photos
  add column client_id uuid,
  add column deleted_at timestamptz,
  add column server_updated_at timestamptz not null default now();

update public.geocam_photos set client_id = id where client_id is null;

alter table public.geocam_photos
  alter column client_id set default gen_random_uuid(),
  alter column client_id set not null,
  add constraint geocam_photos_client_id_key unique (client_id);

-- El bucket pasa a ser privado (paso 5): la URL pública ya no sirve.
alter table public.geocam_photos drop column public_url;

-- 2. LOS BORRADOS ANTERIORES PASAN A SER MARCAS QUE LOS TELÉFONOS PUEDEN BAJAR
insert into public.geocam_photos
  (client_id, user_id, storage_path, source, client_created_at, updated_at, deleted_at)
select distinct on (entity_id)
  entity_id, user_id, '', 'camera', deleted_at, deleted_at, deleted_at
from public.geocam_deleted_records
where entity_type = 'photo'
order by entity_id, deleted_at
on conflict (client_id) do nothing;

-- 3. TRIGGERS
-- Reloj del servidor. clock_timestamp() y no now(): dentro de una misma transacción
-- now() repite el valor y el cursor de bajada podría saltarse filas.
create or replace function public.touch_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger geocam_photos_touch_server_updated_at
  before insert or update on public.geocam_photos
  for each row execute function public.touch_server_updated_at();

-- Gana el último cambio, también en el servidor. Bajar antes de subir deja una ventana
-- pequeña: otro teléfono puede escribir entre los dos pasos. Si llega una versión más
-- vieja que la guardada, se descarta y el teléfono recibe la nueva en la siguiente bajada.
create or replace function public.reject_stale_photo_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

create trigger geocam_photos_reject_stale_update
  before update on public.geocam_photos
  for each row execute function public.reject_stale_photo_update();

-- 4. ÍNDICES
-- Cursor de bajada
create index geocam_photos_user_server_updated_idx
  on public.geocam_photos (user_id, server_updated_at);

-- Feed de la nube: solo fotos vivas, de la más reciente a la más antigua
create index geocam_photos_feed_idx
  on public.geocam_photos (user_id, client_created_at desc)
  where deleted_at is null;

-- 5. POLÍTICAS DE FILAS (upsert necesita select, insert y update)
drop policy if exists "Usuarios ven sus propias fotos" on public.geocam_photos;
create policy "Usuarios ven sus propias fotos"
  on public.geocam_photos for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Usuarios insertan sus propias fotos" on public.geocam_photos;
create policy "Usuarios insertan sus propias fotos"
  on public.geocam_photos for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Usuarios actualizan sus propias fotos" on public.geocam_photos;
create policy "Usuarios actualizan sus propias fotos"
  on public.geocam_photos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Un DELETE directo dejaría a los demás teléfonos sin enterarse: se borra con deleted_at.
drop policy if exists "Usuarios eliminan sus propias fotos" on public.geocam_photos;

-- 6. BUCKET PRIVADO: las fotos llevan ubicación, solo su dueño las puede leer
update storage.buckets set public = false where id = 'geocam-photos';

drop policy if exists "Acceso público de lectura a fotos" on storage.objects;
drop policy if exists "Usuarios leen sus propias fotos" on storage.objects;
create policy "Usuarios leen sus propias fotos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'geocam-photos' and
    (select auth.uid())::text = (storage.foldername(name))[1]
  );
