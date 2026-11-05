# Pruebas con teléfonos y Supabase real

Fecha: 5 de noviembre de 2026 (horas en UTC). Se usaron un iPhone físico y un emulador Android con Expo Go para SDK 58, la misma cuenta y el proyecto real de Supabase.

Los resultados salen de las capturas del emulador, de lo observado en el iPhone y de consultas a la tabla, al bucket y a los registros de Supabase. Los identificadores son los primeros caracteres del `client_id` de cada foto. Se omiten los correos y las coordenadas porque el repositorio es público.

## Resultados

| # | Escenario | Qué se hizo | Resultado |
| --- | --- | --- | --- |
| 1 | Foto sin conexión | Emulador: 2 fotos en modo avión. La red volvió a las 03:47:59 | ✅ Subieron solas a las 03:48:06 y 03:48:07, sin tocar nada |
| 1a | Foto sin conexión en el iPhone | Foto `5185aed0` tomada a las 04:06:03, sin red, y modo avión quitado durante la grabación del GIF | ✅ Llegó a la nube a las 04:10:10, sin tocar nada |
| 1b | Nota sin conexión | iPhone: nota escrita sin red, confirmado por quien la hizo | ✅ Llegó 18 s después, al reconectar |
| 2 | De un teléfono a otro | iPhone: foto `632e67d9`. Emulador: enviado a segundo plano y de vuelta | ✅ Apareció con imagen, ubicación y pin; "Bajaron 1". También se vio en la pestaña Nube |
| 3 | Conflicto de notas | Emulador sin red: nota a las 03:41. iPhone: nota a las 03:42, **con red** | ✅ Quedó la del iPhone en los dos y en la nube; el emulador no subió nada. No cubre el caso con los dos sin red |
| 4 | Borrado | Emulador: borró `0860e538` | ✅ Fila marcada a las 03:46:52 y archivo fuera del bucket a las 03:46:53. El video del iPhone muestra después solo 2 fotos, sin ella |
| 4b | Borrado sin conexión | iPhone: borró `0f62f2bc` a las 03:56:43, sin red | ✅ Al reconectar, la marca llegó a las 03:57:10 y el archivo salió del bucket |
| 5 | Editada y borrada después | Emulador sin red: editó `b7d25389` a las 03:55. iPhone: la borró a las 03:57:52 | ✅ Al reconectar: de 14 a 12 fotos, "Subieron 0". La edición nunca llegó a la nube |
| 6 | Corte a mitad | Emulador: 5 fotos sin red. Red cortada a las 03:51:32, durante la subida | ✅ 5 filas y 5 archivos, sin duplicados (detalle abajo) |
| 7 | Cerrar y abrir | Emulador: foto sin red, app cerrada, red de vuelta, app abierta | ✅ Sesión conservada; la foto subió a las 03:53:16 y quedó "Al día" |

## Detalle del escenario 6

El corte dejó la foto `0ec95720` a medias: el archivo ya estaba en el bucket, pero su fila no existía.

| Foto | Archivo subido | Fila creada |
| --- | --- | --- |
| `1a91cc1a` | 03:51:29 | 03:51:30 |
| `0ec95720` | **03:51:31** | **03:51:54** (después de reconectar) |
| `3bd1c568` | 03:51:56 | 03:51:57 |
| `8642968f` | 03:51:57 | 03:52:01 |
| `9e65b703` | 03:52:01 | 03:52:03 |

Al reconectar, el archivo existente no causó error ni duplicado.

Un primer intento quedó descartado como evidencia: el corte ocurrió antes de que subiera el primer archivo.

## Estado final de la cuenta

Después de borrar las fotos de prueba: 15 filas, 15 `client_id` distintos, 1 foto viva y 1 archivo en el bucket. Las otras 14 filas se conservan como marcas de borrado.

## Errores que encontraron estas pruebas

| Error | Corrección |
| --- | --- |
| Registrarse con un correo existente decía "cuenta creada" | La app distingue correo existente, cuenta por confirmar y sesión activa |
| Con sesión iniciada no había cómo cerrarla | Botón "Cerrar sesión" en la pantalla de Sincronización |
| El mapa no se movía hacia una foto nueva y su pin quedaba fuera de vista | El mapa va hacia la foto más reciente |
| El indicador decía "1 pendientes" | Singular y plural correctos |

## Qué no cubre

- **Dos teléfonos físicos:** uno de los dos era un emulador.
- **Escenario 3 con los dos sin red:** el iPhone tenía conexión al escribir su nota. Sí está cubierto, en ambos órdenes, en las pruebas automáticas.
- **Android físico:** solo se usó el emulador.
