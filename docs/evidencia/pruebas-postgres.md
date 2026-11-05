# Pruebas contra PostgreSQL real

Fecha: 4 de noviembre de 2026. Proyecto de Supabase GeoCam, PostgreSQL 17.

Comprueban lo que el servidor en memoria de las pruebas automáticas solo imita: los triggers y las políticas RLS de `supabase_semana9.sql`.

Se ejecutaron con el rol `authenticated` y el `auth.uid()` real de la sesión simulada. El bloque termina con una excepción a propósito, así que **la transacción se revierte y no deja ningún dato**. Por eso el resultado aparece como un error `ROLLBACK_OK`.

## Resultado

```text
T1 insert server_updated_at set=true
T2 rows=1 note=v2 clock_advanced=true
T3 stale_rejected note=v2 clock_unchanged=true
T4 feed_rows=0 row_kept=1
T5 hard_delete_rows=0
T6 stranger_sees=0 stranger_updates=0 stranger_insert=rejected_by_RLS
T7 bucket_public=false
```

| Prueba | Qué comprueba | Resultado |
| --- | --- | --- |
| T1 | El upsert crea la fila y el trigger pone `server_updated_at` | ✅ |
| T2 | Repetir el upsert por `client_id` no duplica, actualiza y mueve el reloj | ✅ |
| T3 | Una versión más vieja se descarta sin error y el reloj no se mueve | ✅ |
| T4 | Con `deleted_at`, la fila se conserva pero el feed no la ve | ✅ |
| T5 | Un `DELETE` directo no borra nada, porque no hay política | ✅ |
| T6 | Otro usuario no ve, no edita y no puede insertar a nombre ajeno | ✅ |
| T7 | El bucket es privado | ✅ |

## Qué no cubre

Las políticas de `storage.objects` (subir, leer y borrar archivos) no se probaron aquí: hace falta una sesión real desde la app.

## Script

```sql
do $$
declare
  owner_id uuid := (select id from auth.users limit 1);
  stranger uuid := gen_random_uuid();
  photo uuid := gen_random_uuid();
  t0 timestamptz := '2026-11-04 12:00:00+00';
  first_clock timestamptz; second_clock timestamptz;
  note_after text; visible int; rows_affected int;
  bucket_public boolean := (select public from storage.buckets where id='geocam-photos');
  report text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.geocam_photos (client_id,user_id,storage_path,source,note,client_created_at,updated_at)
  values (photo,owner_id,owner_id||'/x.jpg','camera','v1',t0,t0)
  on conflict (client_id) do update set note=excluded.note, updated_at=excluded.updated_at;
  select server_updated_at into first_clock from public.geocam_photos where client_id=photo;
  report := report || 'T1 insert server_updated_at set=' || (first_clock is not null) || E'\n';

  perform pg_sleep(0.01);
  insert into public.geocam_photos (client_id,user_id,storage_path,source,note,client_created_at,updated_at)
  values (photo,owner_id,owner_id||'/x.jpg','camera','v2',t0,t0 + interval '1 minute')
  on conflict (client_id) do update set note=excluded.note, updated_at=excluded.updated_at;
  select server_updated_at, note into second_clock, note_after from public.geocam_photos where client_id=photo;
  select count(*) into visible from public.geocam_photos where client_id=photo;
  report := report || 'T2 rows=' || visible || ' note=' || note_after || ' clock_advanced=' || (second_clock > first_clock) || E'\n';

  insert into public.geocam_photos (client_id,user_id,storage_path,source,note,client_created_at,updated_at)
  values (photo,owner_id,owner_id||'/x.jpg','camera','vieja',t0,t0 - interval '1 hour')
  on conflict (client_id) do update set note=excluded.note, updated_at=excluded.updated_at;
  select note into note_after from public.geocam_photos where client_id=photo;
  report := report || 'T3 stale_rejected note=' || note_after || ' clock_unchanged=' || ((select server_updated_at from public.geocam_photos where client_id=photo) = second_clock) || E'\n';

  update public.geocam_photos set deleted_at=t0 + interval '2 minutes', updated_at=t0 + interval '2 minutes' where client_id=photo;
  select count(*) into visible from public.geocam_photos where user_id=owner_id and deleted_at is null and client_id=photo;
  report := report || 'T4 feed_rows=' || visible || ' row_kept=' || (select count(*) from public.geocam_photos where client_id=photo) || E'\n';

  delete from public.geocam_photos where client_id=photo;
  get diagnostics rows_affected = row_count;
  report := report || 'T5 hard_delete_rows=' || rows_affected || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role','authenticated')::text, true);
  select count(*) into visible from public.geocam_photos where client_id=photo;
  update public.geocam_photos set note='hack' where client_id=photo;
  get diagnostics rows_affected = row_count;
  report := report || 'T6 stranger_sees=' || visible || ' stranger_updates=' || rows_affected;
  begin
    insert into public.geocam_photos (client_id,user_id,storage_path,source,client_created_at,updated_at)
    values (gen_random_uuid(),owner_id,'x','camera',t0,t0);
    report := report || ' stranger_insert=ALLOWED' || E'\n';
  exception when insufficient_privilege then
    report := report || ' stranger_insert=rejected_by_RLS' || E'\n';
  end;
  report := report || 'T7 bucket_public=' || coalesce(bucket_public::text,'null');
  raise exception 'ROLLBACK_OK %', E'\n' || report;
end $$;
```
