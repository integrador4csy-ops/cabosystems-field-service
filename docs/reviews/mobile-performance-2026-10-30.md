# Revisión de optimización móvil — 30 de octubre de 2026

Alcance: lectura del código, prueba reproducible del sincronizador con SQLite local y comprobación del teléfono mediante ADB. No se modificó código de producto ni se enviaron mensajes.

## Evidencia de dispositivo y límites

- Dispositivo ADB: modelo 2602BPC18G; conectado correctamente.
- Paquete instalado com.cabosystems.fieldservice: versión 1.2.0, versionCode 9, DEBUGGABLE. El código del repositorio declara 1.2.2. Por ello la instalación no representa necesariamente el código actual.
- Android informó lanzamiento COLD de la actividad en 813 ms. La pantalla permaneció bloqueada (Dozing/NotificationShade), el proceso de CaboSystems no quedó disponible y no se observó la interfaz. Ese dato NO mide el tiempo hasta una pantalla utilizable ni permite concluir nada sobre el arranque de producción.
- Expo Go estaba residente. Su memoria pertenece al contenedor completo y no es atribuible de forma aislada a CaboSystems; se excluye de las conclusiones.
- Faltan mediciones válidas de FPS, memoria por pantalla, consumo de batería y React Profiler. Requieren desbloquear el teléfono y una compilación de producción del código actual para la referencia final.

## Prioridades

### 1. Chat: evitar la reconciliación completa en cada reanudación

`lib/chatBackgroundSync.ts:40` llama a prepareChatRooms con reconcile=true. El mismo run se ejecuta al volver al primer plano (línea 91), al reconectar y en algunos eventos de datos. `lib/chatRoomSync.ts:23` solo usa la ruta incremental de historiales completos cuando reconcile=false.

Prueba local, ejecutando el sincronizador real mediante tests/chat-test-helpers.cjs y SQLite en memoria, con 1,000 mensajes remotos y sin novedades:

| Ejecución | Consultas de páginas | Consultas de fijados | Mensajes retornados |
|---|---:|---:|---:|
| Descarga inicial completa | 11 | 1 | 1,000 |
| Segunda sincronización actual, reconcile=true | 11 | 1 | 1,000 |
| Ruta incremental existente, reconcile=false | 1 | 1 | 100 |

La preparación también realiza una pasada previa de mensajes recientes; no está incluida en estas cifras del sincronizador de historial.

Propuesta: sincronización incremental al reanudar; reconciliación completa con periodicidad controlada o recuperación explícita. Mantener la detección de borrados y modificaciones antiguas: no basta con sustituir true por false permanentemente. Validar interrupciones, mensajes nuevos mayores a una página y borrados mientras el usuario estaba desconectado.

### 2. Ubicación: reducir trabajo duplicado y peticiones simultáneas

`lib/liveTrackingService.ts:372`: suscripción High con timeInterval=2500 y distanceInterval=0. Incluso en reposo se intenta transmitir aproximadamente cada tres segundos. La línea 422 agrega otro temporizador de tres segundos que pide una ubicación nueva cuando aún no se registró un envío reciente. El timestamp de último envío se actualiza después de completar la petición; no hay una exclusión de envío en curso en transmitLocation.

Cada envío exitoso actualiza ubicación y luego inserta historial (líneas 183–193). A una cadencia sostenida de tres segundos, el orden de magnitud teórico es 1,200 actualizaciones + 1,200 inserciones por hora y usuario; no es tráfico medido en el teléfono. La red lenta puede permitir solapamientos entre los dos productores.

Propuesta inicial: una sola petición de ubicación/transmisión en curso, consolidar el heartbeat con la suscripción y agrupar el historial. Después medir una cadencia adaptativa mayor en reposo sin degradar el requisito de seguimiento. Hay listeners de batería y además polling de dos segundos (línea 354): priorizar eventos y un respaldo menos frecuente. No se modificó el seguimiento de operación.

### 3. Chat abierto: unificar lecturas y agrupar ráfagas

`app/chat/[id].tsx:186–199` mantiene un canal además del canal global. Cada INSERT del grupo llama refresh; las reacciones y fijados de las tablas completas también lo llaman. refresh lee los últimos 100 mensajes y los fijados, escribe en SQLite y vuelve a cargar la ventana visible. El canal general ya realiza trabajo equivalente y notifica a la pantalla mediante subscribeChatRooms.

`lib/chatRoomSync.ts:14` espera una petición en curso, pero luego cada solicitante vuelve a intentar sincronizar; evita parte del solapamiento pero no fusiona una ráfaga en una sola actualización posterior.

Propuesta: un único responsable de sincronización y pantalla consumiendo los datos locales; una petición en curso y una sola actualización pendiente por sala. Agrupar reacciones por mensaje y descartar eventos de grupos ajenos antes de consultar. Validar conteo de peticiones en una ráfaga de mensajes y reacciones, además del tiempo hasta verlos.

### 4. Compilación Android: evaluar R8 y reducción de recursos

`android/app/build.gradle:70,118–120`: minificación y shrinkResources usan false por defecto; gradle.properties no los activa. Evaluar ambos en release, comprobar reglas de conservación y probar cámara, audio, notificaciones, ubicación y WebView. No prometer una reducción concreta sin comparar dos APK/AAB del mismo código.

Hay cuatro arquitecturas configuradas. Los APK universales y AAB con entrega por dispositivo tienen tamaños distintos; no eliminar arquitecturas solo por este dato.

### 5. Recursos del chat: revisar peso sin perder disponibilidad offline

Se encontraron 3,391 archivos bajo assets/emoji, 16.86 MiB de archivos fuente en total. emojiCatalog.ts ocupa 625,709 bytes y fluentEmojiAssets.ts 266,122 bytes. El mapa incluye referencias require estáticas. Esto es inventario de origen, no tamaño comprimido del APK ni memoria decodificada.

Propuesta: analizar el bundle de producción y comprobar si conviene limitar imágenes 3D, reducir su resolución o cargar paquetes opcionales con caché. Mantener emojis estándar y contenido usado disponibles sin conexión. No retirar recursos sin verificar impacto visual y offline.

## Aspectos que ya ayudan

- FlashList 2.3.2 y listas virtualizadas; no corresponde pedir estimatedItemSize como requisito de esta versión.
- Hermes y arquitectura nueva activos.
- Ventanas de chat limitadas en memoria y persistencia SQLite; índice compuesto de mensajes y transacciones locales.
- Precarga con dos trabajadores y preparación de emojis acotada.
- Polling general pausado fuera del primer plano.

## Siguiente medición

Con el teléfono desbloqueado: comprobar versión real, medir arranque hasta contenido utilizable, registrar una navegación Tareas → Agenda → Chat → conversación y retorno, capturar memoria antes/después y tras repetir el recorrido. Medir React commits y peticiones en el chat. Para cambios de ubicación, comparar actividad/red durante reposo y movimiento antes de decidir la cadencia. Comparar APK/AAB release del mismo código con y sin reducción de recursos.

## Segunda fase: mediciones con el teléfono desbloqueado

El usuario desbloqueó el dispositivo y se abrió CSY Field Service desde el servidor visible en Expo Go. Las mediciones siguientes pertenecen al proceso host.exp.exponent (PID 6601), no al APK antiguo de CaboSystems. Se verificaron las pantallas mediante jerarquías de UI. El teléfono estaba configurado con máximo de 120 Hz; esto no demuestra una frecuencia constante durante toda la prueba.

No se enviaron mensajes, se editaron eventos ni se cambiaron datos. Solo se navegaron Tareas → Agenda → Chat → conversación con multimedia, se hicieron cuatro desplazamientos y se volvió a Tareas. Se repitió la apertura y cierre de conversación una segunda vez.

### Dibujo nativo por interacción

Se reiniciaron las estadísticas gfxinfo inmediatamente antes de cada interacción. Estas cifras son de HWUI/Android, NO FPS del hilo JavaScript ni tiempos de React commits.

| Interacción | Cuadros registrados | Fuera de plazo (contador moderno) | P95 / P99 |
|---|---:|---:|---:|
| Abrir Agenda desde Tareas | 268 | 1 (0.37%) | 8 / 9 ms |
| Abrir lista de Chat | 208 | 1 (0.48%) | 6 / 11 ms |
| Abrir conversación con multimedia | 180 | 1 (0.56%) | 22 / 34 ms |
| Cuatro desplazamientos en conversación | 570 | 0 | 6 / 8 ms |

La apertura de conversación tiene la cola de tiempos más alta del recorrido. No se observó un problema sostenido de desplazamiento en esta muestra corta. El contador legacy de conversación fue 30/180 (16.67%); no mezclar ese criterio con el contador moderno ni interpretarlo como FPS. Faltan CPU/React Profiler y una compilación release para atribuir el costo exacto.

### Memoria de proceso y recursos gráficos

MiB calculados desde los valores kB de dumpsys meminfo dividiendo entre 1024. TOTAL PSS incluye memoria compartida proporcional y swap PSS según el desglose de Android; se conserva la métrica tal como la reporta el sistema. El proceso Expo Go también aloja el runtime y sus herramientas de desarrollo: el total absoluto NO representa por sí solo el consumo de la app publicada.

| Punto | TOTAL PSS del proceso | Graphics |
|---|---:|---:|
| Tareas, inicio | 1001.3 MiB | 43.2 MiB |
| Agenda | 955.5 MiB | 44.8 MiB |
| Lista de Chat | 960.0 MiB | 50.8 MiB |
| Conversación, primera apertura | 1123.4 MiB | 118.6 MiB |
| Después de desplazarse | 1105.9 MiB | 128.9 MiB |
| Regreso a Tareas | 1049.2 MiB | 74.3 MiB |
| Conversación, segunda apertura | 1147.8 MiB | 119.9 MiB |
| Segundo regreso a Tareas | 1082.4 MiB | 95.5 MiB |

Dos ciclos no prueban una fuga de memoria; las cachés, carga de recursos, recolección de basura y Expo Go influyen. Sí hay retención parcial de recursos gráficos y un salto repetible al entrar a multimedia que merece aislarse en release.

### Nueva prioridad: posters de video sin reproductores activos

`components/chat/ChatVideoPreview.tsx:34–48` crea un useVideoPlayer y VideoView para obtener el primer cuadro cuando no existe thumbnailUrl. En vez de una imagen estática hay un reproductor nativo en pausa por celda montada. La rama de miniatura usa expo-image y ya está disponible.

Es un candidato respaldado por el crecimiento observado de Graphics, aunque esta prueba no separa el peso de las imágenes del de los videos. Propuesta: generar y persistir una miniatura al adjuntar video; usar poster estático para mensajes antiguos y crear reproductor solo al abrir el video. Comparar exactamente la misma conversación antes/después, comprobar el reciclaje de celdas y verificar reproducción. No se aplicó todavía este cambio.

### Evidencias locales

Capturas textuales de meminfo, gfxinfo y jerarquías se guardaron en cabosystems-mobile/.expo/perf-*.txt y perf-*.xml. Son temporales locales, no artefactos para publicar: las jerarquías pueden contener texto de conversaciones. Los registros de errores revisados al volver a Tareas no mostraron FATAL/OutOfMemory en el filtro consultado; esto no garantiza ausencia de errores fuera de esa ventana.
