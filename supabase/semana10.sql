-- ==============================================================================
-- GEOCAM · SEMANA 10: descripción con IA y límite de uso por usuario
-- Ejecutar UNA sola vez, DESPUÉS de supabase_schema.sql y supabase_semana9.sql.
-- ==============================================================================

-- T3. La descripción generada (y editada) viaja con la foto en la sincronización.
alter table public.geocam_photos add column ai_description text;

-- C5. Cada petición de IA deja una fila. El límite se cuenta con el cliente del usuario:
-- RLS hace que cada quien solo vea y cree sus propias filas, y nadie puede borrarlas
-- para "reiniciar" su cuota.
create table public.uso_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  funcion text not null check (funcion in ('asistente', 'describir-foto', 'tarjetas')),
  created_at timestamptz not null default now()
);

create index uso_ia_user_created_idx on public.uso_ia (user_id, created_at desc);

alter table public.uso_ia enable row level security;

create policy "Usuarios ven su propio uso de IA"
  on public.uso_ia for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuarios registran su propio uso de IA"
  on public.uso_ia for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Sin políticas de update ni delete: el historial de uso no se puede alterar desde la app.
