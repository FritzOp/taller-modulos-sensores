# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Taller Integrador 2
**Proyecto:** GeoCam — Módulos Nativos, SQLite Offline-First, Respaldo en Supabase e IA Generativa
**Integrantes:** Deivis Magdaniel, Edgar Zuñiga

---

# Semana 10: IA Generativa Multimodal y Edge AI

**Estudiante(s):** Deivis Magdaniel, Edgar Zuñiga
**Semana:** 10
**Proyecto:** GeoCam ve y Asistente IA, Taller Integrador 2 (tag v2.0.0)
**Herramienta:** Claude Code (Claude Opus 5.5)

## 1. Prompts Utilizados

- "toca realizar ahora esto, ahí tienes el pdf, ahí te adjunté un zip que es una guía que dio el profe, mira y busca lo que te sirva y la guía para realizar" (con la Guía de la Semana 10 y el ejemplo `s10-tutor-ia.zip` del profesor: taller "GeoCam ve" y retos C1 a C6)
- "ya se anda despausando, ya puse la api de gemini" (la key la puso el estudiante como secreto en Supabase; nunca se pegó en el chat ni en un archivo)

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** las tres Edge Functions (`asistente`, `describir-foto`, `tarjetas`) y su código compartido en `supabase/functions/_shared/`, `supabase/semana10.sql`, la migración `drizzle/0005`, `services/vision.ts`, `services/ai/`, los hooks `useConversacion` y `usePerfil`, `db/repositories/chat.ts`, las pantallas Asistente, Perfil y Tarjetas, la tarjeta de descripción del detalle, las pruebas y este registro.
- **¿Qué tomó del ejemplo del profesor?:** `polyfills.ts`, el uso de `expo/fetch` en el transporte, `withSupabase({ auth: 'user' })` y la forma de `toUIMessageStream`.
- **¿Qué cambió frente al ejemplo?:**
  - El ejemplo no guarda el historial; aquí se guarda en SQLite con upsert por id (C1).
  - El perfil se valida en el servidor con zod y `.catch()`: un tema inventado o un nombre con instrucciones se reemplazan por valores seguros (C2).
  - El límite diario se cuenta en `uso_ia` con el cliente del usuario y RLS sin política de borrado, para que la base de datos lo haga cumplir y no solo el código (C5).
  - Ningún error crudo de Gemini llega a la pantalla: el servidor lo traduce a un mensaje y la app decide si ofrece Reintentar o cierra la sesión (C4).
  - Se agregó un modelo de respaldo y un tiempo máximo por intento, que el ejemplo no tiene (ver errores 1 y 2).

## 3. Alucinaciones o Errores Detectados

Errores reales, con la prueba que los reveló:

1. **Gemini saturado y una espera de más de un minuto.** La primera prueba real de "Describir con IA" tardó 74 s y terminó en "La IA no pudo responder". Los registros de la función mostraron `503 This model is currently experiencing high demand` en `gemini-3.8-flash`: el primer intento tardó 63 s en fallar y el reintento automático, 8 s más. La primera versión no tenía tiempo máximo ni plan B. Se agregó un tiempo máximo de 25 s por intento, el respaldo `gemini-3.5-flash-lite` y un mensaje propio para la saturación (`supabase/functions/_shared/ia.ts`). Repetida la prueba, el modelo principal seguía saturado y la descripción llegó en 18 s desde el respaldo; los registros muestran `Modelo gemini-3.8-flash saturado, se intenta con el siguiente`.
2. **El chat no podía cambiar de modelo a mitad de respuesta.** Con streaming, la respuesta ya empezó cuando llega el error. La solución fue esperar el primer evento del modelo: si es un error de saturación o no llega a tiempo, se cancela y se intenta con el siguiente antes de que la persona vea nada (`streamConRespaldo`). Al revisarlo apareció un caso que la primera versión no cubría: al abortar, el stream puede cerrarse sin lanzar error, y se habría entregado una respuesta vacía. Se marca como saturado si la señal se abortó.
3. **Inventó un lugar pese a la instrucción.** Con el perfil "viajes y lugares", nivel avanzado, a la pregunta "¿qué sitio me recomiendas fotografiar este fin de semana?" respondió con un barrio concreto de una ciudad que nadie mencionó, aunque las instrucciones decían "no inventes lugares". Se agregó: "No sabes en qué ciudad está la persona: si pide un sitio, sugiere tipos de lugares o pregúntale la ciudad". Con la misma pregunta, ahora pide la ciudad. Capturas: `docs/evidencia/semana10/perfil-antes-lugar-inventado.png` y `perfil-despues-pregunta-ciudad.png`.
4. **Asteriscos en el chat.** Gemini responde con Markdown y la burbuja mostraba `**Las luces de los coches:**` tal cual. Se agregó un intérprete mínimo de negritas, viñetas y títulos (`services/ai/markdown.ts`) con pruebas, sin una librería. La primera versión dejó pasar `*hora dorada*`, que se vio en otra respuesta, y se corrigió.
5. **`tsc` revisaba el código de Deno.** Las funciones importan `npm:ai@7` y `Deno.env`, que el TypeScript de la app no entiende. Se excluyó `supabase/functions` de `tsconfig.json` y las funciones se revisan con `deno check`. Como una prueba de Jest importa `_shared/perfil.ts`, también se mapeó `npm:zod@4` al zod instalado.
6. **Lint en Tarjetas.** La primera versión llamaba a la función dentro de un `useEffect` con `setState`, y falló con `react-hooks/set-state-in-effect`. Se cambió a `useQuery` sin reintentos automáticos, para no gastar cuota.
7. **Rutas tipadas.** `router.push('/tarjetas')` falló en `tsc` hasta que Metro regeneró los tipos de Expo Router.
8. **Migraciones con la base pausada.** El proyecto de Supabase estaba pausado; la primera migración falló con "database system is shutting down" mientras se restauraba. Se esperó a que el proyecto estuviera sano y se aplicó.
9. **Errores que solo se vieron en el emulador.** Al volver de Perfil se veía un destello blanco: faltaba `contentStyle` en el `Stack`. Las tarjetas tardaron 28 s en aparecer y la pantalla solo mostraba rectángulos vacíos: ahora dice "Creando tarjetas con IA".
10. **Un error de la propia herramienta.** Al escribir una prueba con un script de Python, los `\n` del texto se convirtieron en saltos de línea reales y Jest falló con "Unterminated string constant". Se corrigió a mano.

---

# Semana 9: TanStack Query y Sincronización Offline-First

**Estudiante(s):** Deivis Magdaniel, Edgar Zuñiga
**Semana:** 9
**Proyecto:** GeoCam sincronizada, Taller Integrador 2
**Herramienta:** Claude Code (Claude Opus 5.5)

## 1. Prompts Utilizados

- "completa la sincronización con los borrados, agrega el feed paginado de la nube y documenta con pruebas que el diseño funciona. Entrega el enlace a tu repositorio de GitHub con el feed de la nube consumido con TanStack Query, con manejadores de UI completos, más la sincronización en dos sentidos entre SQLite y Supabase." (junto con la Guía de la Semana 9 y los dos proyectos de ejemplo del profesor)
- "y despues mejoras el diseño de la app con animaciones y mejor UI"
- "y despues revisa como se ve en celular con el emulador de android"
- "actualiza" (la IA lo interpretó como actualizar el proyecto al SDK 58, después de que Expo Go rechazó el SDK 57)

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** La migración de Supabase y de SQLite, `services/sync.ts`, `services/syncRules.ts`, `services/cloudPhotos.ts`, los hooks `useSync`, `useCloudFeed` y `usePhoto`, las pantallas Nube y Sincronización, el rediseño de todas las pantallas, las pruebas automáticas y este registro.
- **¿Qué cambió frente al ejemplo del profesor?:**
  - Conservó los nombres de este proyecto (`geocam_photos`, bucket `geocam-photos`) y la separación por usuario, que el ejemplo no tiene.
  - Reemplazó `syncManager.ts`, que subía antes de bajar, usaba `new Date()` como marca de sincronización y sobrescribía siempre la nota local con la de la nube.
  - Reemplazó la cola `sync_queue` y la tabla `geocam_deleted_records` por borrado lógico con `deletedAt`.
  - Pasó el bucket de público a privado con URLs firmadas.
- **Revisión pendiente por parte de los estudiantes:** las pruebas en dos teléfonos reales y el GIF no los puede hacer la IA. La columna correspondiente del README está marcada como pendiente.

## 3. Alucinaciones o Errores Detectados

Errores reales encontrados durante la sesión, con el comando o la prueba que los reveló:

- **`$defaultFn` con `expo-crypto` en `db/schema.ts`.** Es lo que trae el ejemplo, pero en este proyecto `drizzle-kit generate` falló al cargar el esquema con un `TransformError`. El UUID se genera ahora en `photosRepo.create`.
- **Lista que desaparecía al fallar una recarga.** El patrón de la guía muestra la lista solo con `status === 'success'`, pero en la versión 5 `status` pasa a `error` también cuando falla una recarga o la página siguiente, aunque ya haya datos. La pantalla decide por `feed.data !== undefined`.
- **Hueco en el diseño al revivir una foto.** Con foto borrada en A y editada después en B, gana la edición, pero el archivo ya salió del bucket y B tiene `remotePath`, así que no lo volvería a subir. Se agregó la decisión `revive`.
- **`react-test-renderer` no se pudo instalar con `expo install`.** Resolvió la versión 19.3.1, que exige React 19.3, y el proyecto usa 19.2.3. Se fijó `19.2.3`.
- **Typecheck de las pruebas.** Con TypeScript 6, `types` ya no incluye todo por defecto y no encontraba `jest` ni `node`. Se declararon en `tsconfig.json`.
- **Lint con Reanimated.** Asignar `sharedValue.value` falló con `react-hooks/immutability`. Se cambió a `.set()` y `.get()`.
- **Lint en el detalle.** `setState` dentro de un `useEffect` para sincronizar la nota falló con `react-hooks/set-state-in-effect`. Se reemplazó por un borrador derivado (`noteDraft ?? photo.note`).
- **Primera versión de la prueba 7.** Usaba `jest.resetModules()`, que creaba una segunda copia del servidor en memoria, y la prueba falló. Se cambió por una base en disco que se cierra y se vuelve a abrir.
- **Primera prueba contra PostgreSQL.** El reporte salió vacío porque, con el rol `authenticated`, RLS oculta `storage.buckets` y concatenar `NULL` borra el texto. El valor se lee antes de cambiar de rol.
- **Expo Go incompatible.** El Expo Go del emulador solo abre SDK 58 y el proyecto estaba en 57. Se actualizó a SDK 58: React Native 0.88, React 19.3 y Expo Router 58.
- **La actualización rompió cosas que las pruebas o `tsc` revelaron.** `npm` falló con `ERESOLVE` por el lock anterior, y se regeneró. `Tabs` ya no acepta `initialRouteName`. `unstable_settings.initialRouteName` pasó a `anchor`. `Themed.tsx` y `useColorScheme.ts` tenían tipos antiguos. El mock oficial de Reanimated dejó de funcionar en Jest, y se escribió uno propio.
- **Errores que solo se vieron en el emulador.** El botón "mi ubicación" del mapa quedaba debajo de la barra de estado, y se corrigió con `mapPadding`. El aviso de borrado le decía al invitado que la foto se borraría de la nube, y ahora depende de la cuenta.
- **Herramienta de revisión desfasada.** Al manejar el emulador, el árbol de accesibilidad seguía mostrando la pantalla anterior y tardaba unos 10 s, así que algunos toques cayeron donde no era: en una prueba desaparecieron dos fotos en lugar de una. Con coordenadas fijas y capturas reales el borrado quitó exactamente una, y se agregó una prueba automática para ese caso.
- **"Cuenta creada" falso.** La app mostraba éxito siempre que `signUp` no devolviera error. Con un correo ya registrado, Supabase responde sin error para no revelar qué correos existen, y no crea nada ni cambia la contraseña; el inicio de sesión posterior fallaba con "credenciales incorrectas". Lo detectó un estudiante al probar, y los registros de Auth mostraron `user_repeated_signup`. Ahora la app distingue los tres casos (`services/authMessages.ts`).
- **Pruebas con teléfonos reales.** Un iPhone y el emulador revelaron errores que las pruebas automáticas no veían: sin botón para cerrar sesión, porque el rediseño dejó esa pantalla sin acceso; el mapa sin moverse hacia una foto nueva; y el texto "1 pendientes". Se corrigieron y se documentaron en `docs/evidencia/pruebas-con-telefonos.md`.
- **Dos errores de la IA durante esas pruebas.** Agregó `presentation: 'card'` a Sincronización y la dejó oculta detrás de Tu cuenta; Metro lo advirtió y se revirtió. Su primer corte de red del escenario 6 ocurrió antes de empezar la subida, y se descartó como evidencia aunque el resultado era correcto.
- **Comando demasiado largo.** Un solo script enorme falló con `ENAMETOOLONG` en Windows sin ejecutar nada. Se dividió en archivos.

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
