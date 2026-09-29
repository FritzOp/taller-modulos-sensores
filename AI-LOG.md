# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Taller Integrador 2
**Semana:** 6
**Proyecto:** GeoCam — Módulos Nativos y Sensores del Dispositivo
**Integrantes:** Deivis Magdaniel, Edgar Zuñiga
---

## 1. Prompts Utilizados

### Prompt 1
> "Genera una pantalla de cámara en React Native con Expo usando `expo-camera` para capturar fotos geolocalizadas y verificar permisos de cámara y ubicación."

### Prompt 2
> "Implementa un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el teléfono usando `expo-sensors`, con umbral configurable y cooldown."

### Prompt 3
> "Crea la pantalla de mapa para GeoCam con `react-native-maps`, mostrando marcadores para fotos con coordenadas y una lista separada para fotos sin ubicación."

### Prompt 4 (Reto Opcional)
> "Implementa un indicador de nivel de cámara en GeoCam con giroscopio / DeviceMotion de expo-sensors que calcule el ángulo de inclinación y pinte un horizonte artificial en verde cuando esté alineado."

---

## 2. Código Generado vs. Código Modificado

### useShake (`hooks/useShake.ts`)
- **¿Qué generó la IA?:**
  Un hook que se suscribía a `Accelerometer` dentro de un `useEffect` básico, sin llamar a `setUpdateInterval(100)` y sin verificar si el sensor estaba disponible mediante `isAvailableAsync()`. Además, ejecutaba el callback en cada render y disparaba múltiples alertas simultáneas en un único movimiento brusco por falta de un umbral temporal (*cooldown*).
- **¿Qué modifiqué/corregí?:**
  1. Se implementó la verificación asíncrona de disponibilidad del acelerómetro con `Accelerometer.isAvailableAsync()`.
  2. Se fijó la frecuencia de muestreo a 100 ms con `Accelerometer.setUpdateInterval(100)` para optimizar el consumo de batería.
  3. Se calculó la magnitud del vector euclidiano $\sqrt{x^2 + y^2 + z^2}$, aplicando un umbral mínimo de aceleración (1.8g).
  4. Se añadió una bandera `cancelled` en el efecto para evitar suscripciones huérfanas ante desmontajes prematuros.
  5. Se encapsuló el callback en un `useRef` (`onShakeRef`) para evitar reconstruir la suscripción en cada render.

### useGeoLocation (`hooks/useGeoLocation.ts`)
- **¿Qué generó la IA?:**
  Un hook que solicitaba permisos inmediatamente al montarse (`requestForegroundPermissionsAsync` directo en `useEffect`), y un `watchPositionAsync` sin función de limpieza ni control de desmontaje asíncrono.
- **¿Qué modifiqué/corregí?:**
  1. Se separó la consulta inicial de permisos (`getForegroundPermissionsAsync`) de la solicitud activa disparada por acción del usuario (`requestForegroundPermissionsAsync`).
  2. Se implementó la máquina de estados completa de permisos (`checking`, `undetermined`, `granted`, `denied`, `blocked`).
  3. Se integró una bandera booleana `cancelled` para limpiar la promesa de `watchPositionAsync` si el componente se desmonta antes de resolverse.

### useCameraLevel (`hooks/useCameraLevel.ts`) - Reto Opcional
- **¿Qué generó la IA?:**
  Un listener directo a `Gyroscope` calculando derivadas manuales sin contemplar la deriva (*drift*) ni la gravedad, haciendo que el nivel perdiera calibración con el movimiento del usuario.
- **¿Qué modifiqué/corregí?:**
  1. Se utilizó `DeviceMotion` de `expo-sensors`, que aprovecha la fusión sensorial de hardware (acelerómetro + giroscopio) mediante el ángulo roll `gamma` en radianes y cálculo trigonométrico $\text{atan2}(x, -y)$ con vector de gravedad como respaldo.
  2. Se configuró `setUpdateInterval(100)` y tolerancia angular ($\le 1.5^\circ$) para feedback visual instantáneo.
  3. Limpieza adecuada de suscripción con bandera `cancelled` al desmontar la vista de cámara.

---

## 3. Alucinaciones o Errores Detectados

1. **Uso de APIs obsoletas de Expo Camera:**
   - *Alucinación detectada:* La IA sugirió `import { Camera } from 'expo-camera'` con `Camera.requestCameraPermissionsAsync()` y colocar elementos hijos dentro del `<Camera>`.
   - *Corrección técnica:* En Expo SDK 51+, la API moderna utiliza `<CameraView />` junto con el hook `useCameraPermissions()`. Además, `<CameraView />` no admite componentes hijos directos; los controles interactivos deben posicionarse como hermanos absolutos.

2. **Propiedad obsoleta en ImagePicker:**
   - *Alucinación detectada:* La IA utilizó `mediaTypes: ImagePicker.MediaTypeOptions.Images`.
   - *Corrección técnica:* Se reemplazó por el formato moderno `mediaTypes: ['images']` requerido en las versiones recientes de `expo-image-picker`.

3. **Invocación indiscriminada de permisos en el arranque:**
   - *Alucinación detectada:* La IA intentó solicitar permisos de cámara y ubicación en el montaje inicial de la aplicación.
   - *Corrección técnica:* Se implementó la pantalla previa explicativa (`PermissionPrimer`) para solicitar acceso en contexto y ofrecer degradación elegante (permitiendo capturar imágenes sin GPS si el usuario niega la ubicación).
