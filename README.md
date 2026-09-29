# GeoCam — Módulos Nativos y Sensores del Dispositivo

Aplicación móvil construida con **React Native** y **Expo** para la captura de fotos geolocalizadas y visualización interactiva en mapa, implementando gestión rigurosa de permisos nativos, degradación elegante y sensores de movimiento.

---

## 🏗️ Arquitectura y Principios de Diseño

1. **Ciclo Completo de Permisos Nativo:**
   - La aplicación implementa una máquina de estados determinista para el hardware:
     $$\text{undetermined} \longrightarrow \text{granted} \mid \text{denied} \longrightarrow \text{blocked} \longrightarrow \text{openSettings()}$$
   - **Solicitud en contexto:** Nunca se solicitan permisos en el arranque inicial. La cámara se solicita al ingresar a la pantalla de captura y la ubicación se explica mediante un banner contextual no bloqueante.

2. **Degradación Elegante (*Graceful Degradation*):**
   - Si el usuario niega o bloquea los permisos de ubicación, la cámara continúa operando con normalidad.
   - Las fotos capturadas o importadas sin GPS se almacenan con `coords: null` y se listan en el drawer **"Sin ubicación"** en la pestaña del Mapa.

3. **Prevención de Fugas de Recursos y Batería:**
   - **Limpieza de suscripciones:** Toda suscripción a `Location.watchPositionAsync` y `Accelerometer.addListener` se cancela de forma determinista en el retorno de `useEffect`.
   - **Condiciones de carrera resueltas:** Se utiliza una bandera booleana `cancelled` para garantizar que si un componente se desmonta antes de que la promesa nativa resuelva, la suscripción se descarte inmediatamente sin quedar huérfana.

---

## 📂 Estructura del Proyecto

```text
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Configuración de pestañas y GeoPhotosProvider
│   │   ├── geocam.tsx           # Pantalla principal de cámara y captura
│   │   ├── mapa.tsx             # Visualización de mapa interactivo y fotos
│   │   └── index.tsx            # Redirección inicial a GeoCam
│   └── _layout.tsx              # Root Layout con Stack
├── components/
│   └── PermissionPrimer.tsx     # Pantalla previa y manejo de estado 'blocked'
├── context/
│   └── GeoPhotosContext.tsx     # Estado global inmutable de fotos
├── hooks/
│   ├── useCamera.ts             # Encapsulación de CameraView y ciclo de permisos
│   ├── useGeoLocation.ts        # GPS con tracking continuo, lectura única y limpieza
│   └── useShake.ts              # Detección de sacudida con acelerómetro y cooldown
├── types/
│   └── geo.ts                   # Interfaces estrictas de TypeScript
├── AI-LOG.md                    # Registro de auditoría de IA
└── app.json                     # Plugins nativos (expo-camera, expo-location, expo-image-picker)
```

---

## 📱 Estados de Permiso

| Estado | Comportamiento en GeoCam | Acción del Usuario |
| :--- | :--- | :--- |
| **1. Concedido (`granted`)** | La cámara se inicializa a pantalla completa. El banner de coordenadas en vivo muestra latitud, longitud y precisión ($\pm\text{m}$). Las fotos se etiquetan con coordenadas y se ubican en el mapa interactivo. | Tomar fotos, alternar cámara o importar desde galería. |
| **2. Rechazado (`denied`)** | La cámara funciona con normalidad. En la parte superior se visualiza un banner informativo: *"Activa la ubicación para etiquetar tus fotos"*. Las fotos se guardan con `coords: null`. | Tocar el banner para solicitar el permiso nuevamente. |
| **3. Bloqueado (`blocked`)** | Ocurre cuando `canAskAgain: false` (el usuario rechazó dos veces en Android o una vez en iOS). El componente `PermissionPrimer` o el banner contextual ofrece el botón **"Abrir Ajustes"**, redirigiendo a la configuración del sistema operativo mediante `Linking.openSettings()`. | Habilitar el permiso manualmente desde los Ajustes del sistema. |

### Espacio para capturas / GIFs de prueba:
- `assets/screenshots/permission-granted.png`: Estado concedido con visor de cámara y coordenadas en vivo.
- `assets/screenshots/permission-denied.png`: Banner de advertencia en contexto con cámara activa.
- `assets/screenshots/permission-blocked.png`: Pantalla previa con botón para abrir ajustes del sistema.

---

## 🪝 Custom Hooks Desarrollados

### `useGeoLocation(options)`
- Maneja la máquina de estados de permisos (`checking`, `undetermined`, `granted`, `denied`, `blocked`).
- Expone `getCurrent()` para lecturas puntuales de alta precisión antes de capturar fotos.
- Implementa seguimiento en tiempo real con `watchPositionAsync` a precisión balanceada (`Accuracy.Balanced`), minimizando el drenado de batería.
- Limpieza segura con bandera `cancelled`.

### `useCamera()`
- Encapsula `CameraView` de Expo y `useCameraPermissions()`.
- Previene capturas simultáneas por doble toque involuntario mediante la bandera de control `isCapturing`.
- Control de cambio de lente (`front` / `back`) y estado de disponibilidad del sensor (`onCameraReady`).

### `useShake(onShake, options)`
- Consulta `Accelerometer.isAvailableAsync()` antes de suscribirse.
- Configura la tasa de refresco a $100\text{ ms}$ (`Accelerometer.setUpdateInterval(100)`).
- Calcula la magnitud tridimensional del vector de aceleración:
  $$\|A\| = \sqrt{x^2 + y^2 + z^2}$$
- Dispara la confirmación para borrar todas las fotos solo cuando supera el umbral ($1.8\text{ g}$) y el tiempo transcurrido desde la última sacudida supera el `cooldownMs` ($1000\text{ ms}$).

---

## 🚀 Ejecución del Proyecto

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor de desarrollo de Expo:**
   ```bash
   npx expo start
   ```

3. **Abrir en dispositivo físico:**
   - Abre la aplicación **Expo Go** en Android o escanea el código QR con la cámara en iOS.
   - *Nota:* Si estás en una red WiFi con aislamiento de clientes, usa el modo túnel:
     ```bash
     npx expo start --tunnel
     ```
