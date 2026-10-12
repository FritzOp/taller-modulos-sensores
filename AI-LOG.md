# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Taller Integrador 2
**Proyecto:** GeoCam — Módulos Nativos y Base de Datos Local Offline-First
**Integrantes:** Deivis Magdaniel, Edgar Zuñiga

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
