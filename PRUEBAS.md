# Pruebas de la Semana 10: GeoCam ve y Asistente IA

Matriz de escenarios con resultados reales del 17 de noviembre de 2026. Las pruebas manuales se hicieron en el emulador de Android (API 37, Expo Go SDK 58) contra el proyecto real de Supabase y Gemini. Las capturas están en [`docs/evidencia/semana10/`](docs/evidencia/semana10/).

Cómo se probó cada fila:

- **Emulador:** a mano en la app, con captura.
- **curl:** petición directa a la Edge Function desplegada.
- **SQL:** consulta en la base de datos de Supabase.
- **Registros:** registros de las Edge Functions en Supabase.
- **Jest:** prueba automática (`npm test`).

## Seguridad de la key (C6)

| # | Escenario | Cómo | Esperado | Resultado |
| --- | --- | --- | --- | --- |
| S1 | Buscar una key de Google en el repositorio, incluidos los archivos sin commit | `git grep -E 'AIza[0-9A-Za-z_-]{35}'` | Ninguna coincidencia | ✅ 0 coincidencias |
| S2 | Lo mismo en todo el historial de git | `git log --all -p \| grep -E -c 'AIza[0-9A-Za-z_-]{35}'` | 0 | ✅ 0 |
| S3 | Buscar `AIza` en el bundle que se instala en el teléfono | `npx expo export --platform android` y `grep -r AIza dist/` | Ninguna coincidencia | ✅ 0 coincidencias en el bundle de Hermes (7,9 MB). Control: en el mismo archivo sí aparecen la URL de Supabase y la ruta `functions/v1/asistente`, así que el texto del bundle se puede buscar |
| S4 | `.env` fuera del repositorio | `git check-ignore -v .env` | Ignorado | ✅ `.gitignore:35` |
| S5 | Las tres funciones sin token | curl sin `Authorization` | 401 | ✅ 401 `UNAUTHORIZED_NO_AUTH_HEADER` |
| S6 | Con la llave pública en lugar de un token de sesión | curl | 401 | ✅ 401 `UNUSABLE_CREDENTIAL` |
| S7 | Con un JWT inventado | curl | 401 | ✅ 401 `UNAUTHORIZED_ASYMMETRIC_JWT` |

Las keys de Google empiezan con `AIza` y siguen 35 caracteres; se busca ese patrón porque la palabra `AIza` sola sí aparece en esta documentación. La key solo existe como secreto `GEMINI_API_KEY` de las Edge Functions. El `.env` de la app tiene únicamente la URL y la llave pública de Supabase.

## Taller "GeoCam ve" (T1 a T6)

| # | Escenario | Cómo | Esperado | Resultado |
| --- | --- | --- | --- | --- |
| T1 | Describir una foto | Emulador | Descripción en español de 1 a 3 oraciones | ✅ "En una sala luminosa con paredes y muebles de madera clara…" en 18 s ([captura](docs/evidencia/semana10/foto-descrita.png)) |
| T2 | La petición pesa menos de 300 KB | Registros (`content_length`) | < 300 KB | ✅ 107 KB y 258 KB en las dos fotos probadas |
| T3 | Botón en modo avión | Emulador | Apagado, con aviso | ✅ "Sin conexión. Describir con IA necesita internet." ([captura](docs/evidencia/semana10/sin-conexion-describir.png)) |
| T4 | Guardar la descripción la sube a Supabase | Emulador y SQL | `ai_description` en `geocam_photos` | ✅ La consulta, hecha justo después de guardar, ya mostraba el texto |
| T5 | Guardar deja la foto pendiente, sube y baja al otro teléfono; la edición más reciente gana; borrarla también viaja | Jest (`semana10.data.test.ts`) | Pasa | ✅ 4 pruebas |
| T6 | Es una sugerencia editable y se avisa qué se envía a Google | Emulador | Campo editable y aviso | ✅ "Sugerencia de la IA: revísala y edítala antes de guardar" y "La foto se envía a Google Gemini… Su ubicación no se envía." |
| T7 | Lista de fotos con las primeras palabras (extra) | Emulador | ✨ y el inicio de la descripción | ✅ ([captura](docs/evidencia/semana10/galeria-con-descripcion.png)) |
| T8 | Gemini saturado | Emulador y registros | Mensaje claro, sin esperar minutos | ✅ Antes del arreglo: 74 s y "La IA no pudo responder". Después: el respaldo respondió en 18 s |

## Retos C1 a C5

| # | Escenario | Cómo | Esperado | Resultado |
| --- | --- | --- | --- | --- |
| C1a | Respuesta por partes, con indicador y botón para detener | Emulador | "Pensando…" y ■ | ✅ |
| C1b | Cerrar Expo Go por completo y volver a abrir | Emulador | La conversación sigue igual | ✅ ([captura](docs/evidencia/semana10/chat.png)) |
| C1c | Foto más pregunta que depende de la respuesta anterior ("cuál de tus 3 ideas") | Emulador | Describe la foto y recuerda las ideas | ✅ ([captura](docs/evidencia/semana10/chat-con-foto.png)) |
| C1d | "Nueva conversación" | Emulador | Chat vacío; la anterior queda guardada | ✅ |
| C1e | Upsert, regenerar, conversación por usuario | Jest | Pasa | ✅ 5 pruebas |
| C2a | Perfil "Valeria", viajes, avanzado | Emulador | Usa el nombre y el nivel | ✅ "Hola, Valeria" y respuesta técnica |
| C2b | Tema inventado, nombre con instrucciones, perfil basura | Jest (esquema real del servidor) | Valores seguros, sin error | ✅ |
| C3 | Tarjetas de repaso de la conversación | Emulador | 3 a 5 tarjetas que se voltean | ✅ 4 tarjetas en 28 s ([captura](docs/evidencia/semana10/tarjetas.png)) |
| C4a | Modo avión en el chat | Emulador | Banner, campo "Sin conexión" y envío apagado; la conversación se puede leer | ✅ ([captura](docs/evidencia/semana10/sin-conexion-chat.png)) |
| C4b | Respuestas 401, 429, 503 y fallas de red | Jest | Mensaje y acción correctos | ✅ |
| C4c | Sesión vencida | Emulador (ver abajo) | Pide iniciar sesión, sin errores en bucle | ✅ ([captura](docs/evidencia/semana10/sesion-vencida.png)) |
| C5a | Llegar al límite en "Describir con IA" | Emulador y SQL | Mensaje de límite, sin Reintentar | ✅ "Llegaste al límite de 20 usos de IA en 24 horas." ([captura](docs/evidencia/semana10/limite-diario.png)) |
| C5b | Llegar al límite en el chat | Emulador | El mismo mensaje | ✅ |
| C5c | Las peticiones bloqueadas no cuentan | SQL | El contador sigue en 20 | ✅ |
| C5d | El usuario intenta borrar o reiniciar su contador | SQL con el rol `authenticated` y su `sub` | 0 filas afectadas | ✅ 0 borradas, 0 actualizadas; solo ve sus 20 filas |

## Cómo se hicieron las pruebas difíciles

**Límite (C5) sin gastar cuota.** En lugar de bajar `LIMITE_DIARIO` y redesplegar, se insertaron 13 filas de prueba en `uso_ia` para el usuario del emulador, que ya tenía 7 usos reales. Con 20, se probó en la foto y en el chat. Después se borraron esas 13 filas.

**Sesión vencida (C4c).** Se borró por SQL solo la sesión del emulador en `auth.sessions`; la del iPhone no se tocó. Después se adelantó 2 horas el reloj del emulador (`cmd alarm set-time`) y se reabrió la app. Con el token vencido, la app intentó renovarlo, Supabase lo rechazó porque la sesión ya no existe, y la app cerró la sesión y mostró "Inicia sesión para conversar con el asistente". Al final se devolvió el reloj automático. La ruta del 401 dentro de una petición de IA se prueba con curl (S5 a S7) y con Jest (C4b).

## Pruebas automáticas

`npm test` corre 116 pruebas en 10 archivos, todas pasan. Las de esta semana están en `__tests__/ai.test.ts` (errores, perfil del servidor, Markdown) y `__tests__/semana10.data.test.ts` (descripción sincronizada e historial del chat, con SQLite real y las migraciones reales). Las funciones de Deno se revisan con `npx deno check`.

## Qué no se probó

- La descripción editada sin red y sincronizada al volver la red se probó con Jest, no en el teléfono: el emulador quedó sin sesión por la prueba de sesión vencida.
- El error 429 de la cuota de Gemini no se provocó de verdad; se probó con Jest.
- Las pruebas manuales se hicieron en Android. En iOS solo se probó la semana anterior.
