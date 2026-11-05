Guía Semana 9: TanStack Query y Sincronización Offline-First

# Guía Semana 9: TanStack Query y Sincronización Offline-First

Oct 6, 2026 · @AntonioJGL

Esta semana unirás lo local de la Semana 7 con la nube de la Semana 8: tu app trabajará normal sin conexión y, cuando vuelva la red, subirá lo pendiente y bajará lo nuevo hasta quedar sincronizada. TanStack Query es la herramienta que ejecuta, reintenta y dispara esa sincronización.

## Objetivos y preparación

#### Al terminar esta guía podrás:

1. Diferenciar estado de cliente y estado de servidor, y explicar qué problemas resuelve TanStack Query.
2. Consumir datos remotos con useQuery y useInfiniteQuery, con caché, reintentos, paginación e infinite scroll en FlatList.
3. Manejar los estados de UI: carga, error, vacío y sin conexión.
4. Diseñar una sincronización en dos sentidos entre SQLite y Supabase: subir pendientes, bajar cambios y resolver conflictos con una regla explícita.
5. Disparar la sincronización automáticamente al abrir la app, al recuperar la red y al volver a primer plano.
### Antes de clase

Leer la visión general de TanStack Query (enlace al final).

Tener el taller de la Semana 8 funcionando: login, sesión en SecureStore y subida manual de fotos.

Confirmar que tu tabla local photos tiene las columnas clientId, updatedAt, remotePath y syncedAt, y que la tabla remota tiene client_id y updated_at.

Tener a la mano un segundo teléfono (el de tu pareja) para las pruebas con dos dispositivos.

### Preguntas de repaso

Intenta responderlas antes de clase; las discutiremos al inicio.

1. En GeoCam, ¿cuál es la fuente de verdad: SQLite o Supabase?
2. ¿Cómo sabe la app qué fotos faltan por subir?
Page 1 of 23

3. ¿Por qué cada foto lleva un UUID creado en el teléfono y no se usa el id autoincremental?
4. Si dos teléfonos editan la nota de la misma foto sin conexión, ¿cuál debería quedar?
5. ¿Qué problema tiene el muro de la Semana 8 cuando hay 5.000 publicaciones?
## Conceptos clave

La idea central: TanStack Query no sincroniza bases de datos por sí solo. Es un administrador de peticiones y caché. La sincronización es un diseño propio (qué se sube, qué se baja y quién gana), y TanStack Query es quien lo ejecuta, lo reintenta y lo dispara en el momento correcto.

### Estado de cliente y estado de servidor

||Estado de cliente|Estado de servidor|
|---|---|---|
|Ejemplos|Tema, texto de un formulario, pestaña activa|Publicaciones del muro, fotos en Supabase|
|Dueño|La app|El servidor; la app solo tiene una copia|
|Puede quedar desactualizado|No|Sí: otra persona lo cambia sin avisar|
|Herramienta|useState, Context|TanStack Query|

El usePosts de la Semana 8 manejaba a mano isLoading, error, recarga y limpieza. Con estado de servidor siempre aparecen las mismas necesidades: caché, evitar peticiones repetidas, reintentos, paginación y refresco. TanStack Query las resuelve con una sola API.

### Conceptos de TanStack Query

```
const { data, status, fetchStatus, error, refetch} = useQuery({
queryKey: ['posts', { search}], // identidad de la consulta en la
caché
queryFn: () => listPosts(search), // función asíncrona que trae los
datos
});
```
Page 2 of 23

|Concepto|Qué es|Valor por defecto|
|---|---|---|
|queryKey|Identifica la consulta; si cambia, es otra consulta|—|
|staleTime|Tiempo durante el cual el dato se considera fresco y no se vuelve a pedir|0|
|gcTime|Tiempo que un dato sin uso permanece en caché|5 minutos|
|retry|Reintentos automáticos ante error, con espera creciente|3|
|refetchOnReconnect|Vuelve a pedir al recuperar la red|Activo|
|refetchOnWindowFocus|Vuelve a pedir cuando la app regresa a primer plano|Activo|

Dos estados distintos que no debes confundir:

status habla del dato: pending (aún no hay), error o success.

fetchStatus habla de la petición: fetching (en curso), paused (quiere pedir pero no hay red) o idle.

Una consulta puede estar en success con datos de caché y a la vez en paused porque no hay conexión. Ese es el caso que la UI debe mostrar como "sin conexión, mostrando datos guardados".

Para escribir se usa useMutation, y después se invalida la consulta afectada para que se vuelva a pedir:

```
const queryClient = useQueryClient();
const mutation = useMutation({
mutationFn: createPost,
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts']}),
});
```
### Conexión y foco en React Native

En el navegador, TanStack Query detecta solo la red y el foco de la ventana. En React Native hay que conectárselos:

onlineManager recibe el estado de la red desde expo-network. Con eso pausa las peticiones sin conexión y las reanuda al volver.

focusManager recibe los cambios de AppState. Con eso refresca al volver a primer plano.

Estas dos conexiones son las que más adelante disparan la sincronización sin escribir lógica propia.

### Paginación e infinite scroll

useInfiniteQuery guarda una lista de páginas. Cada página dice cómo pedir la siguiente:

```
useInfiniteQuery({
queryKey: ['posts', { search}],
queryFn: ({ pageParam}) => listPostsPage({ cursor: pageParam, search}),
initialPageParam: null as string | null,
getNextPageParam: (lastPage) => lastPage.nextCursor, // null o undefined =
no hay más
});
```
#### Tipo de paginación Cómo pide Problema

Por posición ( range(10, "Dame de la 10 a la 19" Si entra una publicación nueva, todo

19) ) se corre y aparecen repetidas Por cursor ( created_at < "Dame las 10 Ninguno para un feed; es la que último ) anteriores a esta" usamos
En FlatList, onEndReached llama a fetchNextPage() cuando hasNextPage es verdadero y no hay otra página cargándose.

### Diseño de la sincronización

#### Cinco decisiones que definen el diseño:

1. **SQLite es la fuente de verdad.** La app siempre lee y escribe en local, con o sin red. La UI nunca espera a la nube.
2. **Identidad compartida.** Cada foto tiene un clientId (UUID creado en el teléfono). El id autoincremental solo vale dentro de un dispositivo.
3. **Marca de pendiente.** Una foto está pendiente si syncedAt está vacío o es anterior a updatedAt.
4. **Cursor de bajada.** El teléfono guarda la fecha del último cambio que bajó y pide solo lo posterior.
5. **Regla de conflicto: gana el último cambio.** Si la misma foto cambió en dos lados, queda la versión con updatedAt más reciente.
Page 4 of 23

Cada ciclo de sincronización hace dos pasos, siempre en este orden:

1. **Bajar.** Pedir a Supabase las filas modificadas después del cursor. Por cada una: si no existe en local, se crea (y se descarga su archivo); si existe y la versión remota es más nueva, se actualiza; si la local es más nueva, se deja como está. Al final se avanza el cursor.
2. **Subir.** Enviar todas las fotos pendientes con upsert por client_id, y marcarlas como sincronizadas. Se baja primero porque, si se subiera primero, un cambio local viejo podría pisar un cambio remoto más nuevo antes de compararlos. Dos relojes distintos, y por qué hacen falta los dos:

|Columna remota|Quién la escribe|Para qué sirve|
|---|---|---|
|updated_at|El teléfono, con la hora en que el usuario editó|Decidir quién gana un conflicto|
|server_updated_at|PostgreSQL, con un trigger|Cursor de bajada: "dame lo que llegó al servidor después de X"|

Una foto editada sin conexión el lunes y subida el miércoles tiene updated_at de lunes. Si el cursor usara esa columna, un teléfono que sincronizó el martes nunca la bajaría.

Por qué es seguro reintentar: subir con upsert por client_id produce el mismo resultado una vez o diez. A esa propiedad se le llama idempotencia, y es lo que permite que TanStack Query reintente sin crear duplicados.

Cuándo se dispara: al iniciar sesión, al recuperar la red, al volver a primer plano y después de cada cambio local. Los tres primeros los da TanStack Query al tratar la sincronización como una consulta.

#### Límites de este diseño:

"Gana el último cambio" pierde la edición más antigua. Es aceptable para notas personales; no lo sería para un saldo bancario.

Depende de que la hora de los teléfonos sea razonable.

Los borrados no se sincronizan todavía: una fila borrada no deja rastro que bajar. Lo resolverás en el trabajo para la casa con borrado lógico.

## Ejemplo de clase: Muro de Clase con TanStack Query

Tomarás el Muro de Clase de la Semana 8 y reemplazarás el usePosts hecho a mano por TanStack Query. El resultado es un feed infinito con búsqueda en vivo, todos los estados de UI y aviso de falta de conexión.

Este ejemplo cubre el consumo de API. La sincronización se construye después, en el taller.

### Paso 1. Dependencias

```
npx expo install @tanstack/react-query expo-network
```
### Paso 2. Cliente de consultas, red y foco

```
// lib/queryClient.ts
import { useEffect, useSyncExternalStore} from'react';
import { AppState, Platform} from'react-native';
import * as Network from'expo-network';
import { QueryClient, focusManager, onlineManager} from'@tanstack/react-
query';
export const queryClient = new QueryClient({
defaultOptions: {
queries: {
staleTime: 30_000, // durante 30 s no se repite una consulta que ya
está en caché
retry: 2,
},
},
});
// 1. TanStack Query se entera del estado de la red
onlineManager.setEventListener((setOnline) => {
let initialised = false;
const subscription = Network.addNetworkStateListener((state) => {
initialised = true;
setOnline(!!state.isConnected);
});
Network.getNetworkStateAsync()
.then((state) => {
if (!initialised) setOnline(!!state.isConnected);
})
.catch(() => {});
return () => subscription.remove();
```
Page 6 of 23

```
});
// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
useEffect(() => {
const subscription = AppState.addEventListener('change', (status) => {
if (Platform.OS!=='web') focusManager.setFocused(status ===
'active');
});
return () => subscription.remove();
}, []);
}
// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
return useSyncExternalStore(
(onChange) => onlineManager.subscribe(onChange),
() => onlineManager.isOnline()
);
}
```
### Paso 3. Proveedor en el layout raíz

```
// app/_layout.tsx (solo cambia el componente exportado)
import { QueryClientProvider} from'@tanstack/react-query';
import { queryClient, useAppFocusManager} from'@/lib/queryClient';
export default function RootLayout() {
useAppFocusManager();
return (
<QueryClientProvider client={queryClient}>
<AuthProvider>
<RootNavigator />
</AuthProvider>
</QueryClientProvider>
);
}
```
### Paso 4. Servicio paginado con búsqueda

```
// services/posts.ts (función nueva; createPost y deletePost quedan igual)
const PAGE_SIZE = 10;
export interface PostsPage {
items: Post[];
```
Page 7 of 23

```
nextCursor: string | null;
}
export async function listPostsPage(params: {
cursor: string | null;
search: string;
}): Promise<PostsPage> {
let query = supabase
.from('posts')
.select('*')
.order('created_at', { ascending: false})
.limit(PAGE_SIZE);
// Paginación por cursor: "las 10 anteriores a la última que ya tengo"
if (params.cursor) query = query.lt('created_at', params.cursor);
const term = params.search.trim();
if (term) query = query.ilike('content', `%${term}%`);
const { data, error} = await query;
if (error) throw error;
const items = data as Post[];
return {
items,
nextCursor: items.length === PAGE_SIZE? items[items.length-
1].created_at : null,
};
}
```
### Paso 5. Hooks de consulta, mutación y tiempo real

```
// hooks/usePostsFeed.ts
import { useEffect, useMemo} from'react';
import {
keepPreviousData,
useInfiniteQuery,
useMutation,
useQueryClient,
} from'@tanstack/react-query';
import { supabase} from'@/lib/supabase';
import { createPost, listPostsPage} from'@/services/posts';
export function usePostsFeed(search: string) {
const query = useInfiniteQuery({
queryKey: ['posts', { search}], // cada búsqueda tiene su propia caché
```
Page 8 of 23

```
queryFn: ({ pageParam}) => listPostsPage({ cursor: pageParam, search}),
initialPageParam: null as string | null,
getNextPageParam: (lastPage) => lastPage.nextCursor,
placeholderData: keepPreviousData, // al escribir, se conserva la lista
anterior en vez de parpadear
});
// Las páginas se aplanan en una sola lista para FlatList
const posts = useMemo(() => query.data?.pages.flatMap((p) => p.items)??
[], [query.data]);
return {...query, posts};
}
export function useCreatePost() {
const queryClient = useQueryClient();
return useMutation({
mutationFn: createPost,
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts']}),
});
}
/** Tiempo real: ya no recarga a mano, solo le avisa a la caché que quedó
desactualizada. */
export function usePostsRealtime() {
const queryClient = useQueryClient();
useEffect(() => {
const channel = supabase
.channel('muro-posts')
.on('postgres_changes', { event:'*', schema:'public', table:'posts'
}, () => {
queryClient.invalidateQueries({ queryKey: ['posts']});
})
.subscribe();
return () => {
supabase.removeChannel(channel);
};
}, [queryClient]);
}
```
Page 9 of 23

```
// hooks/useDebouncedValue.ts
// Búsqueda en vivo sin una petición por cada tecla: espera a que el usuario
deje de escribir.
import { useEffect, useState} from'react';
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
const [debounced, setDebounced] = useState(value);
useEffect(() => {
const timer = setTimeout(() => setDebounced(value), delayMs);
return () => clearTimeout(timer);
}, [value, delayMs]);
return debounced;
}
```
### Paso 6. Pantalla con todos los estados de UI

Se muestran solo las partes que cambian frente a la Semana 8. El formulario de publicar queda igual, pero usa la mutación.

```
// app/index.tsx (fragmentos)
const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search);
const isOnline = useIsOnline();
const feed = usePostsFeed(debouncedSearch);
const createPostMutation = useCreatePost();
usePostsRealtime();
const publish = () => {
if (!content.trim()) return;
createPostMutation.mutate(
{ userId: user.id, email: user.email??'anónimo', content, imageUri},
{
onSuccess: () => {
setContent('');
setImageUri(null);
},
onError: (e) => Alert.alert('No se pudo publicar', e.message),
}
);
};
return (
<View style={styles.container}>
{/* Estado: sin conexión */}
```
Page 10 of 23

```
{!isOnline && (
<Text style={styles.offline}>Sin conexión. Se muestran los datos
guardados.</Text>
)}
<TextInput
style={styles.input}
placeholder="Buscar en el muro"
value={search}
onChangeText={setSearch}
/>
{/* Estado: primera carga */}
{feed.status ==='pending' && feed.fetchStatus ==='fetching' && (
<ActivityIndicator style={{ marginTop: 40}} />
)}
{/* Estado: sin datos y sin red (nunca se pudo cargar) */}
{feed.status ==='pending' && feed.fetchStatus ==='paused' && (
<Text style={styles.empty}>Conéctate a internet para cargar el muro.
</Text>
)}
{/* Estado: error, con opción de reintentar */}
{feed.status ==='error' && (
<View style={styles.center}>
<Text style={styles.error}>{feed.error.message}</Text>
<Pressable onPress={() => feed.refetch()}>
<Text>Reintentar</Text>
</Pressable>
</View>
)}
{feed.status ==='success' && (
<FlatList
data={feed.posts}
keyExtractor={(p) => String(p.id)}
renderItem={renderPost}
// Estado: vacío (distinto según haya búsqueda o no)
ListEmptyComponent={
<Text style={styles.empty}>
{debouncedSearch?'Ninguna publicación coincide.' :'Aún no hay
publicaciones.'}
</Text>
}
// Deslizar hacia abajo para refrescar
```
Page 11 of 23

```
refreshing={feed.isRefetching &&!feed.isFetchingNextPage}
onRefresh={() => feed.refetch()}
// Infinite scroll
onEndReachedThreshold={0.4}
onEndReached={() => {
if (feed.hasNextPage &&!feed.isFetchingNextPage)
feed.fetchNextPage();
}}
ListFooterComponent={
feed.isFetchingNextPage? <ActivityIndicator style={{ margin: 16}}
/> : null
}
/>
)}
</View>
);
```
### Paso 7. Verifica en tu teléfono

Con más de 10 publicaciones, baja en la lista: se cargan páginas de a 10.

Escribe en el buscador: solo sale una petición al dejar de escribir, y la lista anterior no parpadea.

Borra la búsqueda: el feed completo vuelve al instante, desde la caché.

Activa modo avión: aparece el aviso y el feed sigue visible. Desactívalo: se refresca solo.

Sal de la app y vuelve: el feed se actualiza sin tocar nada.

Compara con hooks/usePosts.ts de la Semana 8: cuántas líneas de estado manual desaparecieron.

## Taller en clase: GeoCam sincronizada

En parejas, reemplaza la subida manual de la Semana 8 por una sincronización automática en dos sentidos. Al terminar, una foto tomada sin conexión se sube sola cuando vuelve la red, y una foto creada en otro teléfono con la misma cuenta aparece en el tuyo.

Alcance de hoy: crear y editar (nota y favorita). Los borrados sincronizados quedan para el trabajo en casa.

### Requisitos

**T1. Backend.** Ejecuta el SQL de abajo: columna server_updated_at con trigger, índice y política de update.

**T2. TanStack Query.** Instala @tanstack/react-query y expo-network, copia lib/queryClient.ts del ejemplo y envuelve la app con QueryClientProvider.

**T3. Soporte local.** Crea con una migración la tabla sync_meta ( key texto como llave primaria, value texto). Agrega al repositorio de fotos: pendingQuery, listPending, findByClientId, insertFromRemote, applyRemote y ajusta markSynced.

**T4. Bajar.** Implementa pull(userId) en services/sync.ts con el cursor guardado en sync_meta y la regla "gana el último cambio".

**T5. Subir.** Implementa push(userId) : sube el archivo si falta, hace upsert por client_id y marca la foto como sincronizada.

**T6. Disparo automático y estado.** Crea hooks/useSync.ts con useQuery, pide sincronización después de cada cambio local y muestra un indicador: sin conexión, N pendientes, sincronizando o al día.

**T7. Verificación.** Ejecuta las tres pruebas del final de esta sección.

### SQL para T1

```
--Reloj del servidor: cuándo llegó cada cambio a Supabase (cursor de bajada)
alter table public.photos
add column server_updated_at timestamptz not null default now();
create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
new.server_updated_at = now();
return new;
end;
$$;
create trigger photos_touch_server_updated_at
before insert or update on public.photos
for each row execute function public.touch_server_updated_at();
create index photos_user_server_updated_idx
on public.photos (user_id, server_updated_at);
--upsert necesita permiso de actualizar, además de insertar y leer
create policy "editar las mías" on public.photos
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```
Page 13 of 23

### Código de apoyo

La regla de conflicto es una función pura, sin base de datos ni red. Así se puede razonar y probar por separado:

source:'camera' |'gallery';

0); }
```
// services/sync.ts
import { supabase} from'@/lib/supabase';
import { photosRepo} from'@/db/repositories/photos';
import { syncMetaRepo} from'@/db/repositories/syncMeta';
import { downloadPhotoFile} from'@/services/photoFiles';
const BUCKET ='geocam';
interface RemotePhoto {
client_id: string;
storage_path: string;
latitude: number | null;
longitude: number | null;
note: string | null;
favorite: boolean;
taken_at: string;
updated_at: string; // reloj del teléfono: decide conflictos
server_updated_at: string; // reloj del servidor: cursor de bajada
}
/** Gana el último cambio. Con fechas iguales no gana nadie: ya están
sincronizados. */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt:
string): boolean {
return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime()??
```
Bajar: solo lo que llegó al servidor después del cursor.

```
async function pull(userId: string): Promise<number> {
const cursorKey = `lastPulledAt:${userId}`;
const since = (await syncMetaRepo.get(cursorKey))??'1970-01-
01T00:00:00Z';
const { data, error} = await supabase
.from('photos')
.select('*')
.gt('server_updated_at', since)
.order('server_updated_at', { ascending: true})
```
Page 14 of 23

source: remote.source,

```
.limit(200);
if (error) throw error;
let applied = 0;
for (const remote of data as RemotePhoto[]) {
const local = await photosRepo.findByClientId(remote.client_id);
const remoteUpdatedAt = new Date(remote.updated_at);
if (!local) {
// Foto creada en otro teléfono: se descarga el archivo y se crea la
fila local
const uri = await downloadPhotoFile(remote.storage_path,
remote.client_id);
await photosRepo.insertFromRemote({
clientId: remote.client_id,
uri,
latitude: remote.latitude,
longitude: remote.longitude,
note: remote.note,
favorite: remote.favorite,
createdAt: new Date(remote.taken_at),
updatedAt: remoteUpdatedAt,
remotePath: remote.storage_path,
syncedAt: remoteUpdatedAt, // nace sincronizada
});
applied++;
} else if (remoteWins(local.updatedAt, remote.updated_at)) {
// La versión de la nube es más nueva: se aplica en local
await photosRepo.applyRemote(local.id, {
note: remote.note,
favorite: remote.favorite,
updatedAt: remoteUpdatedAt,
syncedAt: remoteUpdatedAt,
});
applied++;
}
// Si la versión local es más nueva no se toca: push la subirá enseguida
// El cursor avanza fila por fila: si algo falla, el siguiente intento
continúa desde aquí
await syncMetaRepo.set(cursorKey, remote.server_updated_at);
}
return applied;
}
```
Page 15 of 23

Subir: todo lo pendiente, de forma que repetirlo no duplique nada.

source: photo.source,

```
async function push(userId: string): Promise<number> {
const pending = await photosRepo.listPending();
for (const photo of pending) {
if (!photo.clientId) continue; // ensureSyncFields() debió rellenarlo
const path = photo.remotePath?? `${userId}/${photo.clientId}.jpg`;
const updatedAt = photo.updatedAt?? photo.createdAt;
// 1. El archivo solo se sube la primera vez
if (!photo.remotePath) {
const arrayBuffer = await fetch(photo.uri).then((res) =>
res.arrayBuffer());
const { error} = await supabase.storage
.from(BUCKET)
.upload(path, arrayBuffer, { contentType:'image/jpeg'});
// "ya existe": un intento anterior subió el archivo pero no alcanzó a
guardar la fila
if (error &&!/exists/i.test(error.message)) throw error;
}
// 2. upsert por client_id: crea la fila o la actualiza, nunca la duplica
const { error} = await supabase.from('photos').upsert(
{
client_id: photo.clientId,
storage_path: path,
latitude: photo.latitude,
longitude: photo.longitude,
note: photo.note,
favorite: photo.favorite,
taken_at: photo.createdAt.toISOString(),
updated_at: updatedAt.toISOString(),
},
{ onConflict:'client_id'}
);
if (error) throw error;
// 3. syncedAt = la versión que se subió, no "ahora"
await photosRepo.markSynced(photo.id, path, updatedAt);
}
return pending.length;
}
/** Un ciclo completo. Primero bajar, después subir. */
```
Page 16 of 23

```
export async function syncAll(userId: string) {
const pulled = await pull(userId);
const pushed = await push(userId);
return { pulled, pushed, finishedAt: Date.now()};
}
```
Por qué markSynced recibe updatedAt y no usa la hora actual: si el usuario edita la foto mientras se está subiendo, esa edición tiene un updatedAt posterior al que se subió. Con syncedAt igual a la versión subida, la foto sigue pendiente y el cambio no se pierde.

Descarga del archivo de una foto que vino de la nube:

```
// services/photoFiles.ts (función nueva)
export async function downloadPhotoFile(storagePath: string, clientId:
string): Promise<string> {
ensureDir();
const destination = new File(photosDir, `${clientId}.jpg`);
if (destination.exists) return destination.uri;
const url = await signedUrl(storagePath); // el bucket es privado
const file = await File.downloadFileAsync(url, destination);
return file.uri;
}
```
La sincronización como consulta: TanStack Query la dispara al recuperar la red y al volver a primer plano, y la reintenta si falla.

```
// hooks/useSync.ts
import { useQuery} from'@tanstack/react-query';
import { useLiveQuery} from'drizzle-orm/expo-sqlite';
import { useAuth} from'@/context/AuthContext';
import { useIsOnline} from'@/lib/queryClient';
import { photosRepo} from'@/db/repositories/photos';
import { syncAll} from'@/services/sync';
export function useSync() {
const { session} = useAuth();
const userId = session?.user.id;
const isOnline = useIsOnline();
const { data: pending} = useLiveQuery(photosRepo.pendingQuery());
const sync = useQuery({
queryKey: ['sync', userId],
queryFn: () => syncAll(userId!),
enabled:!!userId,
staleTime: 0,
retry: 2,
```
Page 17 of 23

```
refetchOnReconnect:'always', // volvió la red
refetchOnWindowFocus:'always', // la app volvió a primer plano
});
return {
isOnline,
pendingCount: pending.length,
isSyncing: sync.fetchStatus ==='fetching',
lastResult: sync.data,
error: sync.error,
syncNow: () => sync.refetch(),
};
}
```
Después de cada cambio local (foto nueva, nota, favorita) se pide sincronizar:

```
queryClient.invalidateQueries({ queryKey: ['sync']});
```
Si hay red, se ejecuta de inmediato. Si no hay, la consulta queda en pausa y TanStack Query la reanuda sola al reconectar.

### Pruebas de verificación (T7)

**Sin conexión.** Activa modo avión, toma dos fotos y edita una nota. El indicador muestra las pendientes. Desactiva modo avión: se suben solas y el indicador pasa a "al día".

**Dos teléfonos.** Inicia sesión con la misma cuenta en el teléfono de tu pareja. Las fotos del primero aparecen en el segundo, con imagen y ubicación en el mapa.

**Conflicto.** Con ambos teléfonos en modo avión, editen la nota de la misma foto con textos distintos, primero en A y un minuto después en B. Reconecten ambos: en los dos debe quedar la nota de B.

### Pistas

Condición de pendiente en Drizzle: or(isNull(photos.syncedAt), gt(photos.updatedAt, photos.syncedAt)).

```
photosRepo.update, la que usa la UI, debe escribir siempre updatedAt: new Date().
```
#### applyRemote y markSynced nunca usan la hora actual.

Si upsert responde "new row violates row-level security policy", falta la política de update del T1.

Si las fotos bajadas no muestran imagen, falta la política de select del bucket o la URL firmada venció antes de descargar.

Si la sincronización no se dispara al quitar el modo avión, falta el onlineManager.setEventListener de lib/queryClient.ts.

Si hiciste la tarea C5 de la Semana 8, insertFromRemote también debe guardar ownerId y listPending debe filtrar por el usuario de la sesión.

Con más de 200 cambios, pull trae solo los primeros 200 y el resto llega en el siguiente ciclo.

## Trabajo para la casa

En parejas, completa la sincronización con los borrados, agrega el feed paginado de la nube y documenta con pruebas que el diseño funciona. Entrega antes del examen de la Semana 10.

### Tareas

**C1. Borrados sincronizados.** Agrega deletedAt (opcional) en SQLite y deleted_at en Supabase. Borrar una foto pasa a ser marcarla: se pone deletedAt y updatedAt con la hora actual, y la UI filtra las marcadas. push sube la marca y pull la aplica en los demás teléfonos. El archivo local y el del bucket se eliminan cuando la marca ya está sincronizada.

**C2. Feed de la nube.** Pestaña Nube con useInfiniteQuery sobre la tabla remota: paginación por cursor, infinite scroll en FlatList, búsqueda en vivo por nota con espera al escribir, y los cuatro estados de UI (carga, error con reintento, vacío y sin conexión).

**C3. Caché que sobrevive al cierre.** Persiste la caché de TanStack Query con @tanstack/react-query-persist-client para que la pestaña Nube muestre los últimos datos al abrir la app sin conexión.

**C4. Pantalla de estado de sincronización.** Muestra fotos pendientes, fecha de la última sincronización, resultado (cuántas subieron y bajaron), el último error si lo hubo y un botón "Sincronizar ahora".

**C5. Errores por foto.** Si una foto falla al subir, las demás continúan. La que falló queda pendiente y se reintenta en el siguiente ciclo.

**C6. Matriz de pruebas.** Ejecuta y documenta en el README los escenarios de la tabla de abajo, con el resultado esperado y el obtenido.

**C7. Documentación.** README con el diagrama del ciclo de sincronización, la regla de conflicto explicada con un ejemplo, un GIF de la prueba sin conexión y el AI-LOG.md de la semana.

### Matriz de pruebas para C6

|#|Escenario|Resultado esperado|
|---|---|---|
|1|Foto tomada sin conexión; luego se reconecta|Se sube sola; pendientes vuelve a 0|
|2|Foto creada en el teléfono A|Aparece en B con imagen y ubicación|
|3|Nota editada en A y después en B, ambos sin conexión|En los dos queda la nota de B|
|4|Foto borrada en A|Desaparece en B y del bucket|
|5|Foto editada en A y borrada después en B, ambos sin conexión|Queda borrada en los dos (el borrado es el último cambio)|
|6|Se corta la red a mitad de una sincronización de 5 fotos|Al reconectar termina sin duplicar filas ni archivos|
|7|Se cierra la app con fotos pendientes y se abre con red|Se sincroniza al abrir|

### Reto opcional

Cambia la regla de conflicto para la nota: en lugar de perder la edición más antigua, conserva las dos versiones cuando ambas cambiaron (por ejemplo, uniendo los textos con un separador). Explica en el README en qué casos esa regla es mejor y en cuáles peor que "gana el último cambio".

### Preguntas para sustentar

1. ¿Por qué se baja antes de subir?
2. ¿Para qué sirven dos columnas de fecha en la tabla remota y qué fallaría con una sola?
3. ¿Qué significa que la subida sea idempotente y por qué eso permite reintentar?
4. ¿Por qué un borrado no puede ser un DELETE directo en un sistema sincronizado?
5. ¿Qué parte del trabajo hace TanStack Query y qué parte es diseño propio?
## Entregable semanal

Entrega el enlace a tu repositorio de GitHub con el feed de la nube consumido con TanStack Query, con manejadores de UI completos, más la sincronización en dos sentidos entre SQLite y Supabase.

### Antes de entregar, verifica

La pestaña Nube pagina por cursor, tiene infinite scroll y búsqueda en vivo.

Están los cuatro estados de UI: carga, error con reintento, vacío y sin conexión.

La app es totalmente usable en modo avión e informa cuántas fotos están pendientes.

Al recuperar la red, las pendientes se suben sin tocar ningún botón.

Una foto creada en otro teléfono aparece en el tuyo con imagen y ubicación.

Repetir la sincronización no duplica filas ni archivos.

En un conflicto queda el cambio más reciente, y los borrados llegan a los demás teléfonos.

La lógica de sincronización vive en services/ y la regla de conflicto es una función pura. Las pantallas no importan Supabase ni Drizzle.

El README incluye la matriz de pruebas con resultados reales, y AI-LOG.md está en la raíz.

### Errores de IA que debes detectar

|La IA genera|Problema|Corrección|
|---|---|---|
|useQuery(['posts'], fetchPosts)|Firma de la versión 3 o 4; en la 5 solo existe la forma con objeto|useQuery({ queryKey, queryFn })|
|cacheTime, status === 'loading', dentro de useQuery onSuccess|Nombres y opciones retirados en la versión 5|gcTime, status === 'pending'; efectos en useMutation o en un useEffect|
|sin useInfiniteQuery initialPageParam|Es obligatorio en la versión 5|Declararlo y tipar el cursor|
|Paginación con range() en un feed con tiempo real|Publicaciones repetidas o saltadas al llegar una nueva|Paginación por cursor|
|"TanStack Query sincroniza tu base de datos offline"|Solo maneja peticiones y caché|La sincronización es diseño propio|
|Falta onlineManager o usa window.addEventListener('online')|En React Native no existe ese evento; nunca detecta la red|onlineManager.setEventListener con expo-network|
|Subir primero y bajar después|Un cambio local viejo pisa uno remoto más nuevo|Bajar, comparar y luego subir|

La IA genera Problema Corrección

insert en lugar de upsert al reintentar Error de llave upsert con onConflict: duplicada o filas'client_id' repetidas

|Usar el id autoincremental para||El id 5 de un teléfono|UUID en clientId|
|---|---|---|---|
|emparejar con la nube||no es el id 5 de otro Pierde ediciones||
|subir||hechas durante la subida|subió|
|Cursor de bajada con updated_at del teléfono||Se saltan cambios hechos sin conexión y subidos tarde|Cursor con server_updated_at|
||directo para borrar|Los demás teléfonos nunca se enteran|Borrado lógico con deletedAt|
|Consulta con fetch dentro de|"porque es más simple"|Sin caché, sin reintentos, con||

syncedAt: new Date() al terminar de syncedAt igual al updatedAt que se

```
DELETE
useQuery
useEffect
```
condiciones de carrera

### Ejemplo de AI-LOG.md

```
# Registro de Auditoría de IA (AI-LOG)
**Estudiante(s):** Nombre Apellido, Nombre Apellido
**Semana:** 9
**Proyecto:** GeoCam sincronizada – Taller Integrador 2
## 1. Prompts Utilizados
-"Escribe una función que sincronice mi tabla photos de SQLite (Drizzle)
con Supabase en ambos sentidos usando TanStack Query."
## 2. Código Generado vs. Código Modificado
-**¿Qué generó la IA?:** Un useMutation que primero subía todas las filas
locales con insert y luego reemplazaba la tabla local con un select de la
remota.
-**¿Qué modifiqué/corregí?:** Invertí el orden (bajar y luego subir), cambié
insert por upsert con onConflict en client_id, y reemplacé el "borrar y
volver a llenar" por una comparación fila por fila con remoteWins(), porque
la versión de la IA borraba las fotos tomadas sin conexión.
## 3. Alucinaciones o Errores Detectados
-La IA usó useQuery(['sync'], syncAll, { cacheTime: 0}), que es la firma de
```
Page 22 of 23

```
la versión 4. En la versión 5 instalada el proyecto no compilaba. Lo
corregí
a useQuery({ queryKey: ['sync'], queryFn, gcTime: 0}) según la guía de
migración oficial.
```
### Documentación de referencia

<u>TanStack Query: visión general</u>

<u>TanStack Query en React Native</u>

<u>Consultas infinitas</u>

<u>Modos de red</u>

<u>Expo Network</u>

<u>Expo FileSystem</u>

Para la próxima semana (examen del Segundo Corte): debes poder explicar con tus palabras las capas de tu app (pantalla, hook, repositorio o servicio, base local, nube) y el ciclo de sincronización. Consigue además una API key de Gemini u OpenAI y guárdala en .env, con las mismas reglas de la Semana 8.