-- ==============================================================================
-- GEOCAM - ESQUEMA DE BASE DE DATOS Y STORAGE PARA SUPABASE (PostgreSQL)
-- Sincronización Confiable, Respaldo en la Nube y RLS por Usuario
-- ==============================================================================
-- Instrucciones:
-- 1. Ve a tu panel de Supabase: https://supabase.com/dashboard
-- 2. Entra a SQL Editor -> New Query.
-- 3. Pega todo este código y haz clic en "Run".
-- ==============================================================================

-- 1. TABLA DE ÁLBUMES EN LA NUBE
CREATE TABLE IF NOT EXISTS public.geocam_albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT geocam_albums_user_name_unique UNIQUE (user_id, name)
);

-- 2. TABLA DE FOTOS EN LA NUBE
CREATE TABLE IF NOT EXISTS public.geocam_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  album_id UUID REFERENCES public.geocam_albums(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  source TEXT DEFAULT 'camera' NOT NULL,
  note TEXT,
  favorite BOOLEAN DEFAULT false NOT NULL,
  client_created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE REGISTROS ELIMINADOS (Para borrado coherente bidireccional)
CREATE TABLE IF NOT EXISTS public.geocam_deleted_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL, -- 'photo' o 'album'
  entity_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- SEGURIDAD A NIVEL DE FILAS (ROW LEVEL SECURITY - RLS)
-- Cada usuario solo puede ver, insertar, actualizar y borrar sus propios datos
-- ==============================================================================

ALTER TABLE public.geocam_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocam_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocam_deleted_records ENABLE ROW LEVEL SECURITY;

-- Políticas para Álbumes
DROP POLICY IF EXISTS "Usuarios ven sus propios álbumes" ON public.geocam_albums;
CREATE POLICY "Usuarios ven sus propios álbumes"
  ON public.geocam_albums FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan sus propios álbumes" ON public.geocam_albums;
CREATE POLICY "Usuarios insertan sus propios álbumes"
  ON public.geocam_albums FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus propios álbumes" ON public.geocam_albums;
CREATE POLICY "Usuarios actualizan sus propios álbumes"
  ON public.geocam_albums FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus propios álbumes" ON public.geocam_albums;
CREATE POLICY "Usuarios eliminan sus propios álbumes"
  ON public.geocam_albums FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para Fotos
DROP POLICY IF EXISTS "Usuarios ven sus propias fotos" ON public.geocam_photos;
CREATE POLICY "Usuarios ven sus propias fotos"
  ON public.geocam_photos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan sus propias fotos" ON public.geocam_photos;
CREATE POLICY "Usuarios insertan sus propias fotos"
  ON public.geocam_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus propias fotos" ON public.geocam_photos;
CREATE POLICY "Usuarios actualizan sus propias fotos"
  ON public.geocam_photos FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus propias fotos" ON public.geocam_photos;
CREATE POLICY "Usuarios eliminan sus propias fotos"
  ON public.geocam_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para Registros Eliminados
DROP POLICY IF EXISTS "Usuarios ven sus eliminaciones" ON public.geocam_deleted_records;
CREATE POLICY "Usuarios ven sus eliminaciones"
  ON public.geocam_deleted_records FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan eliminaciones" ON public.geocam_deleted_records;
CREATE POLICY "Usuarios insertan eliminaciones"
  ON public.geocam_deleted_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- BUCKET DE STORAGE PARA FOTOS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('geocam-photos', 'geocam-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage: los archivos se organizan por carpeta {user_id}/{filename}
DROP POLICY IF EXISTS "Acceso público de lectura a fotos" ON storage.objects;
CREATE POLICY "Acceso público de lectura a fotos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'geocam-photos');

DROP POLICY IF EXISTS "Usuarios suben fotos a su propia carpeta" ON storage.objects;
CREATE POLICY "Usuarios suben fotos a su propia carpeta"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'geocam-photos' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "Usuarios actualizan sus fotos" ON storage.objects;
CREATE POLICY "Usuarios actualizan sus fotos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'geocam-photos' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "Usuarios borran sus fotos de storage" ON storage.objects;
CREATE POLICY "Usuarios borran sus fotos de storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'geocam-photos' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );
