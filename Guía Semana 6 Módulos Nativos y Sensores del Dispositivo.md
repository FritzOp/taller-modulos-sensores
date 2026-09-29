||Guía Semana 6: Módulos Nativos y Sensores del Dispositivo|||
|---|---|---|---|
|Sep 28, 2026 tipados. Antes de clase|Guía Semana 6: Módulos Nativos y Sensores del Dispositivo · @AntonioJGL Esta semana construirás GeoCam, una cámara que etiqueta cada foto con coordenadas GPS y reacciona al movimiento del teléfono, encapsulando el hardware en Custom Hooks Objetivos y preparación Al terminar esta guía podrás: 1. Explicar cómo JavaScript llega al hardware a través de los módulos nativos de Expo y cuándo Expo Go deja de ser suficiente. 2. Implementar el ciclo completo de permisos: verificar, explicar, solicitar, degradar y redirigir a Ajustes. 3. Encapsular cámara, ubicación y sensores en Custom Hooks con limpieza correcta de suscripciones. 4. Auditar código generado por IA para detectar APIs obsoletas de Expo.|Tener Expo Go instalado en un teléfono físico (la cámara no funciona en el simulador de||
|iOS).|Tener clonado el repositorio del Taller Integrador 2. Conectar el teléfono a la misma red que el computador, o usar npx|expo start|--|
|tunnel.|Leer la documentación de Expo Camera y Expo Location (enlaces al final). Preguntas de repaso Intenta responderlas antes de clase; las discutiremos al inicio. 1. ¿Qué diferencia hay entre un permiso denied y uno con canAskAgain: 2. ¿Por qué un useEffect que se suscribe a un sensor necesita función de limpieza? 3. ¿Dónde se declaran los textos que iOS muestra al pedir un permiso? 4. Si una librería nativa no está incluida en Expo Go, ¿qué alternativa existe?|false ?|Page 1 of 17|

Guía Semana 6: Módulos Nativos y Sensores del Dispositivo

# Conceptos clave

La idea central: el hardware se usa a través de módulos nativos, siempre con permiso explícito del usuario y siempre liberando lo que se suscribe.

## Cómo llega JavaScript al hardware

Cuando llamas a Location.getCurrentPositionAsync(), TypeScript no toca el GPS. En la New Architecture la llamada pasa por JSI hacia código nativo en Kotlin (Android) o Swift (iOS). Las librerías expo-* están construidas sobre la Expo Modules API, que da una interfaz uniforme a esos módulos.

Expo Go es una app ya compilada con un conjunto fijo de módulos nativos. expo-camera, expo-location, expo-sensors, expo-image-picker y react-native-maps ya vienen incluidos. Una librería nativa que Expo Go no trae requiere un development build ( expo- dev-client + EAS Build, Semana 14).

Los config plugins de app.json modifican automáticamente Info.plist y AndroidManifest.xml al compilar, sin tocar código nativo.

Los textos de permisos definidos en app.json solo se ven en builds propios. En Expo Go verás los textos genéricos de Expo Go; no es un error de tu código.

## El modelo de permisos

|Aspecto|iOS|Android|
|---|---|---|
|Texto de justificación|Obligatorio (NSCameraUsageDescription, etc.); sin él la app se cierra|Opcional; el sistema muestra su propio diálogo|
|Oportunidades de preguntar|Una sola; tras rechazar, solo queda Ajustes|Desde Android 11, tras dos rechazos el diálogo deja de aparecer|
|Ubicación aproximada|Desde iOS 14|Desde Android 12|

Expo unifica ambas plataformas en una respuesta con tres campos:

|1. 2. 3. 4. 5.|interface status:} checking blocked blocked|granted: canAskAgain: coordenadas. hace nada.|-> -> Pedir en contexto.|Degradar con elegancia. Pedir solo lo necesario.||PermissionResponse {'granted' | 'denied' | boolean; boolean; // false = hay De ahí sale la máquina de estados que usarás en todos los hooks: undetermined -> (acepta) -> -> (rechaza) Linking.openSettings() -> (lo Buenas prácticas de UX de autorización: Pantalla previa de explicación. diálogo del sistema aumenta la aceptación. Manejar el estado bloqueado. justificación ante las tiendas (Semana 12). Cámara, galería, ubicación y sensores|'undetermined'; que enviar granted -> denied -> activa en La cámara se pide al tocar "Tomar foto", no al abrir la app. Ubicación en primer plano basta; la de segundo plano exige|al usuario a Ajustes (rechaza de nuevo) -> Ajustes) -> granted Como iOS da una sola oportunidad, explicar antes del Sin ubicación, la cámara sigue funcionando; la foto queda sin Ofrecer "Abrir Ajustes" en lugar de un botón que no|
|---|---|---|---|---|---|---|---|---|
||Módulo expo- camera picker expo- location|expo-image-||||API clave CameraView, useCameraPermissions(), ref.takePictureAsync() launchImageLibraryAsync({ mediaTypes: ['images']}) getForegroundPermissionsAsync, getCurrentPositionAsync, watchPositionAsync||Detalle que causa errores Esperar onCameraReady; CameraView no admite hijos, los controles van como hermanos absolutos El selector del sistema moderno no requiere pedir permiso de galería para elegir una imagen La suscripción de debe watchPositionAsync eliminarse con .remove()|

||Módulo||API clave|||Detalle que causa errores|
|---|---|---|---|---|---|---|
||react- native-maps expo- sensors||MapView, isAvailableAsync, setUpdateInterval,|Marker addListener||Funciona en Expo Go; en producción Android requiere API key de Google Maps Toda suscripción se limpia; la frecuencia afecta la batería|
||BestForNavigation|||Precisión de ubicación: Accuracy.Balanced sirve para etiquetar fotos; es para apps de navegación.|||
||Sensor||Mide|Unidad||Uso típico|
|//},|Accelerometer Gyroscope Magnetometer Barometer Pedometer juegos. respuesta. Incorrecto useEffect(() []); consume batería.|y, z =>|Aceleración en x, Velocidad de rotación Campo magnético Presión atmosférica Pasos La regla de oro: toda suscripción se limpia {Location.watchPositionAsync({},|cercana a 1) rad/s μT hPa conteo Un intervalo de 100 ms basta para detectar un agitado; 16 ms (60 Hz) solo se justifica en Ejercicio: encuentra los dos errores de este código, típico de la IA, antes de leer la (loc) => 1. La suscripción nunca se elimina: el GPS sigue encendido al salir de la pantalla y|g (en reposo la magnitud es setCoords(loc.coords));|Detectar agitado, pasos, caídas Juegos, gestos de giro Brújula Altitud relativa Apps de salud|

2. Como watchPositionAsync es asíncrono, si el componente se desmonta antes de que la promesa se resuelva, la suscripción queda huérfana. La solución es una bandera cancelled, que verás en useGeoLocation.
# Práctica guiada: GeoCam paso a paso

Construirás dos hooks, un componente de permisos y la pantalla GeoCam, probando cada estado de permiso en tu teléfono.

## Paso 1. Instalación y configuración

```
npx expo install expo-camera expo-location expo-image-picker expo-sensors
react-native-maps
```
Usa npx expo install y no npm install : Expo resuelve la versión compatible con el SDK de tu proyecto.

### Agrega los plugins en app.json :

```
{
"expo": {
"plugins": [
["expo-camera", {
"cameraPermission": "GeoCam usa la cámara para tomar fotos
geolocalizadas.",
"recordAudioAndroid": false
}],
["expo-location", {
"locationWhenInUsePermission": "GeoCam usa tu ubicación para
registrar dónde tomaste cada foto."
}],
["expo-image-picker", {
"photosPermission": "GeoCam accede a tu galería para importar fotos."
}]
]
}
}
```
### Estructura de carpetas objetivo:

```
app/(tabs)/_layout.tsx
app/(tabs)/geocam.tsx
app/(tabs)/mapa.tsx
components/PermissionPrimer.tsx
hooks/useGeoLocation.ts
hooks/useCamera.ts
hooks/useShake.ts
context/GeoPhotosContext.tsx
types/geo.ts
```
## Paso 2. Tipos compartidos

```
// types/geo.ts
export type PermissionState =
|'checking'
|'undetermined'
|'granted'
|'denied'
|'blocked';
interface
```

|export||Coords|{|
|---|---|---|---|
|latitude:|number;|||
|longitude:|number;|||
|accuracy: timestamp:|number number;|| null;||

source:'camera' |'gallery';

```
}
export interface GeoPhoto {
id: string;
uri: string;
coords: Coords | null; // null si el usuario negó la ubicación
createdAt: number;
}
```
coords: Coords | null lleva al sistema de tipos la regla de degradar con elegancia: TypeScript te obliga a manejar la foto sin ubicación.

## Paso 3. Custom Hook useGeoLocation

```
// hooks/useGeoLocation.ts
import { useCallback, useEffect, useState} from'react';
import { Linking} from'react-native';
import * as Location from'expo-location';
import type { Coords, PermissionState} from'@/types/geo';
```
Page 6 of 17

```
interface Options {
watch?: boolean;
}
interface GeoLocationState {
permission: PermissionState;
coords: Coords | null;
error: string | null;
}
function mapPermission(res: Location.LocationPermissionResponse):
PermissionState {
if (res.granted) return'granted';
if (!res.canAskAgain) return'blocked';
if (res.status ==='undetermined') return'undetermined';
return'denied';
}
function toCoords(loc: Location.LocationObject): Coords {
return {
latitude: loc.coords.latitude,
longitude: loc.coords.longitude,
accuracy: loc.coords.accuracy,
timestamp: loc.timestamp,
};
}
export function useGeoLocation({ watch = false}: Options = {}) {
const [state, setState] = useState<GeoLocationState>({
permission:'checking',
coords: null,
error: null,
});
// 1. Al montar: solo CONSULTAR el permiso, nunca pedirlo
useEffect(() => {
let cancelled = false;
Location.getForegroundPermissionsAsync()
.then((res) => {
if (!cancelled) setState((s) => ({...s, permission:
mapPermission(res)}));
})
.catch(() => {
if (!cancelled) setState((s) => ({...s, permission:'denied'}));
});
```
Page 7 of 17

```
return () => {
cancelled = true;
};
}, []);
// 2. Solicitar permiso por acción explícita del usuario
const requestPermission = useCallback(async (): Promise<boolean> => {
const res = await Location.requestForegroundPermissionsAsync();
setState((s) => ({...s, permission: mapPermission(res)}));
return res.granted;
}, []);
// 3. Lectura única, útil justo antes de tomar la foto
const getCurrent = useCallback(async (): Promise<Coords | null> => {
try {
const loc = await Location.getCurrentPositionAsync({
accuracy: Location.Accuracy.Balanced,
});
const coords = toCoords(loc);
setState((s) => ({...s, coords, error: null}));
return coords;
} catch (e) {
const message = e instanceof Error? e.message :'No se pudo obtener la
ubicación';
setState((s) => ({...s, error: message}));
return null;
}
}, []);
// 4. Seguimiento continuo con limpieza segura ante desmontaje temprano
useEffect(() => {
if (!watch || state.permission!=='granted') return;
let cancelled = false;
let subscription: Location.LocationSubscription | null = null;
Location.watchPositionAsync(
{ accuracy: Location.Accuracy.Balanced, timeInterval: 5000,
distanceInterval: 10},
(loc) => setState((s) => ({...s, coords: toCoords(loc), error: null
}))
)
.then((sub) => {
if (cancelled) sub.remove(); // se desmontó antes de resolver
else subscription = sub;
})
```
Page 8 of 17

```
.catch((e) =>
setState((s) => ({...s, error: e instanceof Error? e.message :
'Error de GPS'}))
);
return () => {
cancelled = true;
subscription?.remove();
};
}, [watch, state.permission]);
const openSettings = useCallback(() => Linking.openSettings(), []);
return {...state, requestPermission, getCurrent, openSettings};
}
```
Fíjate en tres cosas: la bandera cancelled resuelve la condición de carrera; el efecto de seguimiento depende de state.permission y arranca solo cuando el usuario concede el permiso; y los errores se exponen como estado para la UI, no como console.log.

## Paso 4. Componente PermissionPrimer

```
// components/PermissionPrimer.tsx
import { View, Text, Pressable} from'react-native';
import type { PermissionState} from'@/types/geo';
interface Props {
title: string;
description: string;
state: PermissionState;
onRequest: () => void;
onOpenSettings: () => void;
}
export function PermissionPrimer({ title, description, state, onRequest,
onOpenSettings}: Props) {
const isBlocked = state ==='blocked';
return (
<View className="flex-1 items-center justify-center gap-4 bg-neutral-950
px-8">
<Text className="text-center text-2xl font-bold text-white">{title}
</Text>
<Text className="text-center text-base text-neutral-300">
{isBlocked
?'Desactivaste este permiso. Puedes habilitarlo desde los Ajustes
```
Page 9 of 17

```
del sistema.'
: description}
</Text>
<Pressable
onPress={isBlocked? onOpenSettings : onRequest}
className="rounded-full bg-emerald-500 px-6 py-3 active:opacity-80"
accessibilityRole="button"
>
<Text className="font-semibold text-neutral-950">
{isBlocked?'Abrir Ajustes' :'Permitir acceso'}
</Text>
</Pressable>
</View>
);
}
```
## Paso 5. Custom Hook useCamera

```
// hooks/useCamera.ts
import { useCallback, useRef, useState} from'react';
import { Linking} from'react-native';
import { CameraView, useCameraPermissions, type CameraType} from'expo-
camera';
import type { PermissionState} from'@/types/geo';
export function useCamera() {
const cameraRef = useRef<CameraView>(null);
const [permission, requestPermission] = useCameraPermissions();
const [facing, setFacing] = useState<CameraType>('back');
const [isReady, setIsReady] = useState(false);
const [isCapturing, setIsCapturing] = useState(false);
const permissionState: PermissionState =!permission
?'checking'
: permission.granted
?'granted'
:!permission.canAskAgain
?'blocked'
: permission.status ==='undetermined'
?'undetermined'
:'denied';
const toggleFacing = useCallback(() => {
setFacing((f) => (f ==='back'?'front' :'back'));
}, []);
```
Page 10 of 17

```
const takePhoto = useCallback(async () => {
if (!cameraRef.current ||!isReady || isCapturing) return null;
setIsCapturing(true);
try {
const photo = await cameraRef.current.takePictureAsync({ quality: 0.7
});
return photo?? null;
} finally {
setIsCapturing(false);
}
}, [isReady, isCapturing]);
return {
cameraRef,
permissionState,
requestPermission,
openSettings: () => Linking.openSettings(),
facing,
toggleFacing,
onCameraReady: () => setIsReady(true),
takePhoto,
isCapturing,
};
}
```
La guarda isCapturing evita dos capturas simultáneas por doble toque, que en algunos Android hacen fallar la cámara.

## Paso 6. Pantalla GeoCam

```
// app/(tabs)/geocam.tsx
import { useState} from'react';
import { View, Text, Pressable, Image, StyleSheet} from'react-native';
import { CameraView} from'expo-camera';
import { useCamera} from'@/hooks/useCamera';
import { useGeoLocation} from'@/hooks/useGeoLocation';
import { PermissionPrimer} from'@/components/PermissionPrimer';
import type { GeoPhoto} from'@/types/geo';
export default function GeoCamScreen() {
const cam = useCamera();
const geo = useGeoLocation({ watch: true});
const [lastPhoto, setLastPhoto] = useState<GeoPhoto | null>(null);
if (cam.permissionState ==='checking') {
return <View className="flex-1 bg-neutral-950" />;
```
Page 11 of 17

source:'camera',

```
}
if (cam.permissionState!=='granted') {
return (
<PermissionPrimer
title="GeoCam necesita tu cámara"
description="La usamos solo para tomar fotos que tú decidas guardar."
state={cam.permissionState}
onRequest={cam.requestPermission}
onOpenSettings={cam.openSettings}
/>
);
}
const handleCapture = async () => {
const photo = await cam.takePhoto();
if (!photo) return;
// Degradación elegante: sin permiso de ubicación, coords queda en null
const coords =
geo.permission ==='granted'? geo.coords?? (await geo.getCurrent()) :
null;
setLastPhoto({
id: String(Date.now()),
uri: photo.uri,
coords,
createdAt: Date.now(),
});
};
return (
<View className="flex-1 bg-black">
{/* CameraView sin hijos: los controles van como hermanos absolutos */}
<CameraView
ref={cam.cameraRef}
style={StyleSheet.absoluteFill}
facing={cam.facing}
onCameraReady={cam.onCameraReady}
/>
{/* Banner de ubicación: pedir en contexto sin bloquear la cámara */}
{geo.permission!=='granted' && geo.permission!=='checking' && (
<Pressable
onPress={geo.permission ==='blocked'? geo.openSettings :
geo.requestPermission}
```
Page 12 of 17

```
className="absolute left-4 right-4 top-14 rounded-xl bg-amber-
400/90 p-3"
>
<Text className="text-center font-medium text-neutral-900">
Activa la ubicación para etiquetar tus fotos
</Text>
</Pressable>
)}
{/* Coordenadas en vivo */}
{geo.coords && (
<View className="absolute left-4 top-14 rounded-lg bg-black/60 px-3
py-2">
<Text className="font-mono text-xs text-emerald-300">
{geo.coords.latitude.toFixed(5)},
{geo.coords.longitude.toFixed(5)}
</Text>
<Text className="font-mono text-xs text-neutral-400">
±{Math.round(geo.coords.accuracy?? 0)} m
</Text>
</View>
)}
{/* Controles inferiores */}
<View className="absolute bottom-10 left-0 right-0 flex-row items-
center justify-around">
{lastPhoto? (
<Image source={{ uri: lastPhoto.uri}} className="h-14 w-14
rounded-lg border-2 border-white" />
) : (
<View className="h-14 w-14" />
)}
<Pressable
onPress={handleCapture}
disabled={cam.isCapturing}
className="h-20 w-20 items-center justify-center rounded-full
border-4 border-white active:opacity-70"
accessibilityLabel="Tomar foto"
>
<View className={`h-16 w-16 rounded-full ${cam.isCapturing?'bg-
neutral-400' :'bg-white'}`} />
</Pressable>
<Pressable
onPress={cam.toggleFacing}
```
Page 13 of 17

|||Guía Semana 6: Módulos Nativos y Sensores del Dispositivo|||
|---|---|---|---|---|
|);}||className="h-14 > <Text </Pressable> </View> </View> Paso 7. Verifica en tu teléfono aparece "Abrir Ajustes".|w-14 accessibilityLabel="Cambiar className="text-3xl">↻</Text> Niega la ubicación y verifica que la cámara sigue funcionando.|items-center justify-center" cámara" Niega la cámara dos veces en Android hasta llegar a blocked y comprueba que Sal de la pestaña y confirma con un log temporal en el cleanup que el GPS se detiene.|
|LOG.md.|Requisitos source:|R1. Estado global de fotos. clearAll, con Provider en el R2. Importar desde galería. visualmente de las de cámara. R3. Pestaña Mapa. R4. Custom Hook useShake. todas las fotos.|que será el primer esquema de SQLite en la Semana 7. Taller en clase: GeoCam completa 'gallery', con las coordenadas actuales o app/(tabs)/mapa.tsx|Escribir coordenadas dentro del EXIF del JPG requiere librerías nativas fuera de Expo Go. Por eso la foto y sus coordenadas se guardan como un objeto GeoPhoto, En parejas, extiende la GeoCam de la práctica guiada a una app de dos pestañas sobre el repositorio del Taller Integrador 2. Puedes usar IA libremente, registrando todo en AI- Crea GeoPhotosContext con addPhoto, removePhoto y _layout.tsx de tabs y actualizaciones inmutables (Semana 4). GeoCam usa addPhoto en lugar del estado local lastPhoto. Botón con expo-image-picker; las fotos se guardan con coords: null, y se distinguen con un Marker por foto con coordenadas; al tocarlo se ve la miniatura. Las fotos sin coordenadas se listan aparte como "Sin ubicación". El mapa se centra en tu ubicación o, sin permiso, en la última foto. Al agitar el teléfono, un Alert pregunta si se borran Page 14 of 17|

**R5. AI-LOG.** Al menos un prompt, una corrección y una alucinación detectada.

### Código base para R2:

```
const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ['images'],
quality: 0.7,
});
if (!result.canceled) {
// result.assets[0].uri-> crear GeoPhoto con source:'gallery'
}
```
### Requisitos técnicos de R4:

1. Verificar Accelerometer.isAvailableAsync() antes de suscribirse.
2. Fijar Accelerometer.setUpdateInterval(100).
3. Aplicar un umbral sobre la magnitud del vector: √(x² + y² + z²), que en reposo vale cerca de 1 g.
4. Incluir un tiempo de enfriamiento para no disparar varias veces por un solo agitado.
5. Limpiar la suscripción con la bandera cancelled, igual que en useGeoLocation. export function useShake( onShake: () => void, options?: { threshold?: number; cooldownMs?: number} ): { isAvailable: boolean | null};
## Retos opcionales

**Nivel con giroscopio:** en GeoCam, un indicador de nivel que ayude a tomar la foto derecha, con Gyroscope o DeviceMotion.

**EXIF de galería:** con exif: true en el picker, lee las coordenadas originales de fotos importadas. Las claves y el formato GPS difieren entre Android e iOS; documenta en el AI-LOG qué devolvió cada plataforma.

**Ubicación aproximada:** si la precisión supera 1 km, avisa al usuario que concedió ubicación aproximada.

## Errores de IA que debes detectar

Las APIs de Expo cambiaron mucho entre SDKs y los modelos mezclan versiones. Si aparece alguno de estos casos, repórtalo en tu AI-LOG:

|La IA genera|Problema|Corrección|
|---|---|---|
|import { Camera } from 'expo-camera' con Camera.requestCameraPermissionsAsync()|API antigua, reemplazada|CameraView + useCameraPermissions()|
|import * as Permissions from 'expo- permissions'|Paquete obsoleto y retirado|Permisos desde cada módulo, p. ej. Location.requestForegroundPermissionsAsync()|
|mediaTypes: ImagePicker.MediaTypeOptions.Images|Opción obsoleta|mediaTypes: ['images']|
|Controles como hijos de <CameraView>|No soportado, comportamiento inconsistente|Hermanos con posición absoluta|
|watchPositionAsync o addListener sin .remove()|Fuga de batería y memoria|Cleanup en useEffect con bandera cancelled|
|Pedir todos los permisos al iniciar la app|Mala UX; en iOS se pierde la única oportunidad|Pedir en contexto con pantalla previa|
|npm install expo-camera|Posible versión incompatible con el SDK|npx expo install expo-camera|
|requestBackgroundPermissionsAsync para etiquetar fotos|Permiso excesivo, rechazo en tiendas|Solo foreground|

# Entregable semanal

Entrega el enlace a tu repositorio de GitHub con al menos un Custom Hook nativo con manejo de permisos funcional.

## Qué debe contener tu repositorio

### hooks/useGeoLocation.ts o hooks/useCamera.ts (idealmente ambos) y

```
hooks/useShake.ts.
```
README.md con capturas o GIF de los tres estados de permiso: concedido, rechazado y bloqueado.

### AI-LOG.md de la Semana 6 en la raíz.

## Antes de entregar, verifica

La app pide permisos en contexto, nunca al abrirse.

Si niegas la ubicación, la cámara sigue funcionando y la app lo comunica.

Existe un botón "Abrir Ajustes" cuando el permiso está bloqueado.

Todas las suscripciones (GPS, acelerómetro) se limpian al salir de la pantalla.

Los hooks están tipados, sin any, y los errores llegan a la UI como estado.

## Ejemplo de AI-LOG.md

```
# Registro de Auditoría de IA (AI-LOG)
**Estudiante(s):** Nombre Apellido, Nombre Apellido
**Semana:** 6
**Proyecto:** GeoCam – Taller Integrador 2
## 1. Prompts Utilizados
-"Escribe un Custom Hook en React Native con TypeScript que detecte cuando
el usuario agita el teléfono usando expo-sensors, con umbral configurable."
## 2. Código Generado vs. Código Modificado
-**¿Qué generó la IA?:** Un hook que se suscribía a Accelerometer dentro de
useEffect, sin setUpdateInterval y disparando el callback decenas de veces
por cada agitado.
-**¿Qué modifiqué/corregí?:** Agregué setUpdateInterval(100), un cooldown de
1000 ms y la verificación con isAvailableAsync. Guardé el callback en una
ref
para no reiniciar la suscripción en cada render.
## 3. Alucinaciones o Errores Detectados
-La IA usó `import { Camera} from'expo-camera'` y
`Camera.requestCameraPermissionsAsync()`, una API antigua. La reemplacé por
`CameraView` y el hook `useCameraPermissions()` según la documentación
oficial del SDK actual.
```
## Documentación de referencia

### <u>Expo Camera</u>

### <u>Expo Location</u>

### <u>Expo ImagePicker</u>

### <u>Expo Sensors</u>

### <u>Guía de permisos en Expo</u>

### <u>React Native Maps</u>

Consejo: revisa la versión del SDK de Expo de tu proyecto (campo expo en package.json ) y consulta la documentación de esa versión. Si la IA te propone un nombre que no aparece ahí, probablemente es una alucinación.