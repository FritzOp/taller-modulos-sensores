# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Taller Integrador 2
**Proyecto:** GeoCam — Módulos Nativos, SQLite Offline-First y Respaldo Confiable en Supabase
**Integrantes:** Deivis Magdaniel, Edgar Zuñiga

---

# Extensión: Respaldo Confiable y Sincronización en la Nube con Supabase

## 1. Prompts Utilizados

### Prompt 1
> "Convierte la subida manual del taller en un respaldo confiable: sincronización de pendientes, borrado coherente, consulta de la nube y datos locales separados por usuario. Esto para Supabase como hicimos con el otro proyecto."

### Prompt 2
> "Diseña una migración con Drizzle ORM que agregue partición por usuario (userId), columnas de sincronización con la nube (remoteId, remoteUrl, syncStatus, lastSyncedAt) y una tabla sync_queue para borrado coherente en estado desconectado."

### Prompt 3
> "Implementa en TypeScript un syncManager que maneje subida de archivos binarios a Supabase Storage con fetch(uri).blob(), upsert en PostgreSQL y descarga persistente al sistema de archivos local mediante expo-file-system."

---

## 2. Código Generado vs. Código Modificado

### Manejo de Sesión y Partición Multi-usuario (`context/AuthContext.tsx` y `db/repositories/`)
- **¿Qué generó la IA?:**
  Un cliente de Supabase estándar sin persistencia en AsyncStorage que ejecutaba consultas globales sin filtrar por usuario en la base de datos local SQLite.
- **¿Qué modifiqué/corregí?:**
  - Se configuró el cliente Supabase con `auth.storage = AsyncStorage` y `autoRefreshToken: true` para retener la sesión tras recargas.
  - Se diseñó un esquema híbrido con `userId` por defecto en `'local_guest'`, permitiendo navegación completa sin login.
  - Todas las consultas del repositorio local (`photosRepo`, `albumsRepo`) se aislaron agregando cláusulas `eq(photos.userId, userId)` para que las fotos de distintos usuarios y del invitado nunca se mezclen.

### Borrado Coherente Offline (`db/schema.ts` y `services/syncManager.ts`)
- **¿Qué generó la IA?:**
  Una eliminación que solo ejecutaba `supabase.from('geocam_photos').delete()`. Si el usuario borraba una foto sin conexión a internet, el registro local se eliminaba pero la foto permanecía para siempre en Supabase Storage y en PostgreSQL.
- **¿Qué modifiqué/corregí?:**
  - Se introdujo una tabla local `sync_queue` (tombstone de borrado). Al eliminar un elemento sincronizado, se encola con su `remoteId` y `storagePath`.
  - El `syncManager` procesa la cola de borrados al recuperar conectividad, eliminando el binario del Storage, borrando el registro de PostgreSQL e insertando un evento en `geocam_deleted_records` para propagar el borrado a otros dispositivos del usuario.

### Carga de Binarios a Supabase Storage (`services/syncManager.ts` y `services/photoFiles.ts`)
- **¿Qué generó la IA?:**
  Llamadas usando `fs.readFileSync` (módulo exclusivo de Node.js que falla en React Native) o `FormData` incompatible con el cliente de Supabase Storage.
- **¿Qué modifiqué/corregí?:**
  Se adoptó la técnica nativa compatible con React Native y Supabase:
  ```ts
  const fileResponse = await fetch(photo.uri);
  const fileBlob = await fileResponse.blob();
  await supabase.storage.from('geocam-photos').upload(storagePath, fileBlob, { contentType: 'image/jpeg', upsert: true });
  ```
  Para la descarga se utilizó la API moderna `File.downloadFileAsync(remoteUrl, localFile)` de Expo SDK 57.

---

## 3. Alucinaciones o Errores Detectados

1. **Uso de Node.js Buffer / FileSystem de Node:**
   - *Alucinación:* La IA intentó importar `Buffer` y `fs` para manipular los binarios de fotos hacia Supabase Storage.
   - *Corrección técnica:* En React Native se debe utilizar el API Web estándar `fetch(uri).blob()` o `expo-file-system`.

2. **Acceso a Refs durante el Render en React 19 / Expo 57 (`react-hooks/refs`):**
   - *Alucinación / Error de Linter:* Al retornar `{ cameraRef, ... }` desde `useCamera`, el nuevo linter de React Compiler detectó acceso a propiedades del objeto devuelto durante el render de JSX.
   - *Corrección técnica:* Se desestructuraron las propiedades del hook en el componente (`const { cameraRef, facing, isCapturing... } = useCamera()`) y se enlazaron limpiamente sin tics en el render.

3. **Incompatibilidad de políticas RLS en Supabase Storage:**
   - *Alucinación:* La IA generó políticas de Storage usando `auth.uid() = owner`, ignorando que en el bucket `storage.objects` el dueño no siempre coincide con el UID si el archivo se subió con tokens públicos.
   - *Corrección técnica:* Se diseñó la política basada en carpetas organizadas por usuario: `(storage.foldername(name))[1] = auth.uid()::text`, garantizando aislamiento estricto y compatible.

---

# Semana 7: Base de Datos Local Offline-First con Drizzle ORM y SQLite

## 1. Prompts Utilizados

### Prompt 1
> "Crea con Drizzle ORM y expo-sqlite un esquema con una tabla albums relacionada con photos, de forma que al borrar un álbum las fotos no se eliminen, sino que su albumId quede en null."

### Prompt 2
> "Configura el entorno de Drizzle Kit para Expo con soporte a archivos de migración .sql en Metro y Babel, y genera las migraciones versionadas sin alterar la base de producción."

### Prompt 3
> "Implementa la capa de repositorios desacoplada con useLiveQuery para reactividad automática ante inserciones y eliminaciones, filtrando por búsqueda de nota, álbum y favoritas."

### Prompt 4
> "Crea un servicio en TypeScript con expo-file-system que copie fotos de caché al directorio permanente de documentos y las elimine del almacenamiento físico cuando se borre el registro en SQLite."

---

## 2. Código Generado vs. Código Modificado

### Esquema y Relaciones (`db/schema.ts`)
- **¿Qué generó la IA?:**
  Un esquema con `onDelete: 'cascade'` que eliminaba las fotos asociadas al borrar un álbum, y usando tipos de clave foránea no anulables.
- **¿Qué modifiqué/corregí?:**
  Cambié a `onDelete: 'set null'` en `albumId`, dejándolo como columna opcional (`integer('album_id').references(() => albums.id, { onDelete: 'set null' })`). Así, si un usuario borra un álbum organizador, sus fotos se conservan intactas en estado "Sin álbum". Además, se agregó `PRAGMA foreign_keys = ON;` explícitamente en `db/client.ts`, ya que por defecto SQLite ignora restricciones foráneas si no se activan por conexión.

### Consultas Reactivas (`db/repositories/photos.ts` y `hooks/usePhotos.ts`)
- **¿Qué generó la IA?:**
  Consultas ejecutadas dentro de un `useEffect` tradicional con un estado local `photos`, lo que requería recargar manualmente los datos tras cada inserción, actualización o eliminación.
- **¿Qué modifiqué/corregí?:**
  Separé las consultas en funciones de repositorio (`listQuery`, `withLocationQuery`) que retornan la query sin ejecutar, permitiendo que el hook las pase a `useLiveQuery` de Drizzle junto con `enableChangeListener: true` en `openDatabaseSync`. De esta forma, la UI se actualiza reactivamente sin re-renders manuales.

### Persistencia de Archivos (`services/photoFiles.ts`)
- **¿Qué generó la IA?:**
  Un script que utilizaba `FileSystem.copyAsync` y `FileSystem.deleteAsync` mezclado de forma errónea con la nueva clase `File`.
- **¿Qué modifiqué/corregí?:**
  Adopté unificadamente la API moderna de Expo SDK 57 con las clases `Directory`, `File` y `Paths` (`new Directory(Paths.document, 'photos')`), encapsulando el copiado con nombres únicos basados en timestamp y el borrado seguro verificado con `.exists`.

---

## 3. Alucinaciones o Errores Detectados

1. **Driver incorrecto de Drizzle:**
   - *Alucinación detectada:* La IA configuró `import { drizzle } from 'drizzle-orm/better-sqlite3'`, que es un driver nativo de C++ para Node.js y no funciona en el entorno móvil.
   - *Corrección técnica:* Se reemplazó por el driver oficial `drizzle-orm/expo-sqlite` junto con `useMigrations` de `drizzle-orm/expo-sqlite/migrator`.

2. **Uso de `drizzle-kit push` en lugar de migraciones locales:**
   - *Alucinación detectada:* La IA sugirió `npx drizzle-kit push` para aplicar los cambios a SQLite.
   - *Corrección técnica:* `push` está diseñado para servidores remotos y rompe bases existentes en clientes móviles. Se generaron las migraciones versionadas en `drizzle/` mediante `npx drizzle-kit generate` y se ejecutaron en el dispositivo mediante el hook `useMigrations`.

3. **Olvido de `enableChangeListener: true` y `driver: 'expo'`:**
   - *Alucinación detectada:* La IA omitió `driver: 'expo'` en `drizzle.config.ts` (lo que impedía generar `migrations.js`) y omitió `enableChangeListener` al abrir la base con `openDatabaseSync`.
   - *Corrección técnica:* Se añadió `driver: 'expo'` en la configuración y `enableChangeListener: true` en `openDatabaseSync('geocam.db', { enableChangeListener: true })` para garantizar la reactividad de `useLiveQuery`.

---

# Semana 6: Módulos Nativos y Sensores del Dispositivo

## 1. Prompts Utilizados
- "Genera una pantalla de cámara en React Native con Expo usando expo-camera para capturar fotos geolocalizadas y verificar permisos de cámara y ubicación."
- "Implementa un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el teléfono usando expo-sensors, con umbral configurable y cooldown."
- "Crea la pantalla de mapa para GeoCam con react-native-maps, mostrando marcadores para fotos con coordenadas y una lista separada para fotos sin ubicación."
- "Implementa un indicador de nivel de cámara en GeoCam con giroscopio / DeviceMotion de expo-sensors que calcule el ángulo de inclinación y pinte un horizonte artificial en verde cuando esté alineado."

## 2. Código Generado vs. Código Modificado
- **useShake:** Se corrigió suscripción continua agregando `setUpdateInterval(100)`, verificación `isAvailableAsync`, cálculo de vector euclidiano $\sqrt{x^2+y^2+z^2}$, cooldown de 1000 ms y bandera `cancelled`.
- **useGeoLocation:** Se separó consulta inicial (`getForegroundPermissionsAsync`) de petición en contexto (`requestForegroundPermissionsAsync`), implementando máquina de estados determinista y limpieza con `cancelled`.
- **useCameraLevel:** Se adoptó `DeviceMotion` para evitar la deriva acumulativa del giroscopio crudo y se añadió umbral $\le 1.5^\circ$.

## 3. Alucinaciones Detectadas
- Reemplazo de API obsoleta `Camera` por `CameraView` + `useCameraPermissions()`.
- Reemplazo de `expo-permissions` retirado por permisos directos de cada módulo nativo.
- Reemplazo de `MediaTypeOptions.Images` por `mediaTypes: ['images']`.
- Controles de cámara como hermanos absolutos en lugar de hijos directos de `<CameraView>`.
