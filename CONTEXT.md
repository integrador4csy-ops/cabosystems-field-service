# 🌐 CaboSystems Field Service — Documento de Contexto Maestro (`CONTEXT.md`)

Este documento contiene la información completa, arquitectura, modelo de base de datos, decisiones de diseño y estado actual del proyecto para cualquier agente de Inteligencia Artificial o desarrollador que continúe el trabajo en el repositorio.

---

## 1. Resumen Ejecutivo del Proyecto

**CaboSystems Field Service** es una plataforma integral para la supervisión, logística técnica, control de obra y seguimiento operativo en campo de instalaciones residenciales de lujo (domótica, audio, video, redes, control de iluminación Savant/Lutron, CCTV) en Los Cabos, B.C.S., México.

### Componentes de la Plataforma:
1. **`cabosystems-web` (Dashboard Administrativo Web):**
   - Monitoreo de colaboradores en mapa GPS en tiempo real.
   - Chat grupal técnico con intercambio de fotos, videos y notas de voz.
   - Administración de obras: **Desarrollos** (e.g. Cabo del Sol, Chileno Bay, El Dorado), **Villas**, **Tareas** operativas y **Subtareas** (checklists de verificación en campo).
   - Gestión de personal, roles e invitaciones de acceso.
2. **`cabosystems-mobile` (App Móvil para Técnicos):**
   - React Native + Expo.
   - Envío de telemetría GPS en segundo plano (`ubicaciones`).
   - Consulta de tareas asignadas y checklist interactivo de subtareas.
   - Chat técnico con evidencia fotográfica.

---

## 2. Stack Tecnológico Real

| Capa | Tecnologías | Notas |
| :--- | :--- | :--- |
| **Frontend Web** | React 19, TypeScript, Vite | Estructura SPA montada sobre `App.tsx`. |
| **Estilos & UI** | Tailwind CSS v4, Vanilla CSS | Sistema de diseño **TailAdmin** (tema claro predominante, acento naranja corporativo `#f78c26`, bordes `slate-200`, sombras sutiles `shadow-2xs`/`shadow-xs`). |
| **Iconografía** | `lucide-react` | Íconos semánticos coherentes en toda la suite. |
| **Mapas & Telemetría** | Leaflet, React Leaflet | Visualización de vehículos/técnicos, geocercas y marcadores de estado. |
| **Backend & DB** | Supabase (PostgreSQL 15) | Autenticación, Row Level Security (RLS), Supabase Realtime, Storage Buckets, Edge Functions. |
| **App Móvil** | React Native, Expo, TypeScript | Background Geolocation, sincronización local y push notifications. |

---

## 3. Estructura de Directorios Clave

```text
c:\cabosystems-field-service\
├── cabosystems-web\                  # Dashboard Administrativo Web
│   ├── src\
│   │   ├── components\
│   │   │   ├── chat\                 # Chat técnico grupal (ChatView, ChatConversation, GroupList...)
│   │   │   ├── fleet\                # Mapa de rastreo en vivo (LiveMap)
│   │   │   ├── layout\               # Barra lateral (AppSidebar) y cabecera (AppHeader)
│   │   │   ├── modals\               # Gestión de colaboradores e invitaciones
│   │   │   └── projects\             # GESTIÓN DE OBRAS Y TAREAS (Nuevo módulo)
│   │   │       ├── ProjectsManagementView.tsx  # Vista split principal (Villas y Tareas)
│   │   │       ├── TaskCard.tsx                # Tarjeta acordeón compacta con checklist
│   │   │       ├── CreateProjectModal.tsx      # Modal crear/editar villa y desarrollo
│   │   │       └── CreateTaskModal.tsx         # Modal crear tarea y selector estilizado
│   │   ├── context\                  # AdminAuthContext, SidebarContext, LanguageContext
│   │   ├── lib\                      # supabase.ts, projectsApi.ts, chatApi.ts, fleetApi.ts
│   │   ├── types\                    # projects.ts, chat.ts, fleet.ts
│   │   └── App.tsx                   # Ruteo principal por estado activo (chat, mapa, proyectos)
├── cabosystems-mobile\               # Aplicación móvil Expo React Native
├── supabase\
│   ├── migrations\                   # Migraciones SQL numeradas (001 a 012)
│   └── functions\                    # Edge Functions (notificaciones push, invitaciones)
└── CONTEXT.md                        # Este documento maestro
```

---

## 4. Esquema de Base de Datos (Supabase PostgreSQL)

### Tablas Principales:

#### 1. `profiles`
Perfiles vinculados a `auth.users`:
- `id` (UUID, PK -> `auth.users.id`)
- `nombre` / `full_name` (TEXT)
- `email` (TEXT)
- `rol` (TEXT: `'admin'`, `'supervisor_instalacion'`, `'aux_instalacion'`, `'aux_integracion'`, `'tecnico'`)
- `avatar_url` (TEXT)
- `is_active` (BOOLEAN)

#### 2. `proyectos` (Desarrollos y Villas)
Estructura jerárquica de obras:
- `id` (UUID, PK, Default: `gen_random_uuid()`)
- `desarrollo` (TEXT: e.g. "Cabo del Sol", "Chileno Bay", "El Dorado")
- `villa` (TEXT: e.g. "Villa 01", "GE51", "PH 21")
- `descripcion` (TEXT, nullable)
- `estatus` (TEXT: `'activo'`, `'pausado'`, `'finalizado'`)
- `latitud`, `longitud` (DOUBLE PRECISION, opcionales para georreferenciación)
- `created_at` (TIMESTAMPTZ)

#### 3. `tareas` (Órdenes de Trabajo)
- `id` (UUID, PK)
- `proyecto_id` (UUID, FK -> `proyectos.id` ON DELETE CASCADE)
- `asignado_a` (UUID, NULLABLE, FK -> `profiles.id` ON DELETE SET NULL)
  *(Nota: Se eliminó el `NOT NULL` en la migración 012 para permitir tareas "No asignadas").*
- `titulo` (TEXT)
- `descripcion` (TEXT, nullable)
- `estatus` (TEXT: `'pendiente'`, `'en_proceso'`, `'completada'`)
- `created_at` (TIMESTAMPTZ)

#### 4. `subtareas` (Checklist de Verificación)
- `id` (UUID, PK)
- `tarea_id` (UUID, FK -> `tareas.id` ON DELETE CASCADE)
- `titulo` (TEXT)
- `completada` (BOOLEAN, default `false`)
- `created_at` (TIMESTAMPTZ)

#### 5. `ubicaciones` (Telemetría de Flota)
- `id`, `usuario_id`, `latitud`, `longitud`, `velocidad`, `bateria`, `rumbo`, `fecha_hora`

#### 6. `chat_grupos`, `chat_miembros`, `chat_mensajes`, `invitaciones`
- Sistema de mensajería técnica en tiempo real con evidencia multimedia y control de personal.

---

## 5. Migraciones Recientes Críticas

### `011_proyectos_tareas_subtareas_enhancements.sql`:
- Agrega `latitud` y `longitud` a `proyectos`.
- Reconfigura políticas RLS para lectura pública/autenticada y gestión completa a usuarios autenticados.
- Añade `proyectos`, `tareas` y `subtareas` a la publicación `supabase_realtime`.

### `012_tareas_asignado_opcional.sql`:
```sql
ALTER TABLE public.tareas ALTER COLUMN asignado_a DROP NOT NULL;
```
*(Permite crear y registrar tareas con `asignado_a = null` cuando aún no se ha definido el técnico).*

---

## 6. Módulo de Obras y Tareas (`cabosystems-web`) — Decisiones de Diseño

La vista de proyectos ([ProjectsManagementView.tsx](file:///c:/cabosystems-field-service/cabosystems-web/src/components/projects/ProjectsManagementView.tsx)) fue diseñada siguiendo las solicitudes exactas del cliente:

1. **Diseño Split View Permanente:**
   - La pantalla se divide perpetuamente en **dos tarjetas independientes flotantes**:
     - **Panel Izquierdo (`w-80` a `w-96`):** Catálogo de Desarrollos (chips horizontales), buscador en tiempo real, recarga y botón secundario `+ Nueva Villa`. Lista scrollable de villas activas.
     - **Panel Derecho (`flex-1`):** Vista de la Villa seleccionada, filtros por estatus (Todas, Pendientes, En Proceso, Completadas) y botón principal naranja `+ Nueva Tarea`.
   - **Sin marcos dobles:** Se eliminó el cuadro envolvente exterior redundante en `App.tsx` para que ambas tarjetas floten limpias sobre el lienzo, igual que en `ChatView.tsx`.
   - **Desktop Split Firme:** En desktop no hay botones `X` ni flechas hacia atrás para evitar salir accidentalmente del modo dividido.
   - **Auto-selección:** Al cargar o recargar datos, selecciona automáticamente la primera villa disponible (`projs[0]`).

2. **Acordeón Ultra-Compacto de Tareas ([TaskCard.tsx](file:///c:/cabosystems-field-service/cabosystems-web/src/components/projects/TaskCard.tsx)):**
   - **Estado cerrado:** Una sola línea compacta: Pill de estado clickeable (Pendiente / En Proceso / Completada), título de la tarea, contador discreto de pasos (`0/1`), y botones de acción (`+` subtarea, editar, eliminar).
   - **Estado expandido (al hacer clic):** Despliega descripción con tipografía legible (`text-sm text-slate-600`), barra de progreso porcentual dinámica y lista de subtareas interactivas con custom checkboxes TailAdmin.
   - **Persistencia Reactiva:** Marcar una subtarea actualiza Supabase en segundo plano sin cerrar el acordeón ni parpadear (`expandedTaskIds` en memoria).

3. **Selector Personalizado de Técnicos con Opción "No asignado" ([CreateTaskModal.tsx](file:///c:/cabosystems-field-service/cabosystems-web/src/components/projects/CreateTaskModal.tsx)):**
   - Sustituye el `<select>` nativo del navegador por un selector elegante con avatares de iniciales y badges de rol.
   - Incluye como primera opción: **"No asignado"** con icono `UserX` y leyenda *"Disponible para cualquier técnico en campo"*.

---

## 7. Roadmap y Tareas Pendientes (Semana 13 - 16 de Octubre)

El plan de trabajo semanal contempla 3 frentes principales:

- [x] **Frente 1: Módulo de Desarrollos, Villas, Tareas y Subtareas:** 100% implementado, adaptado a TailAdmin y validado con `npm run build` sin errores.
- [ ] **Frente 2: Telemetría y Barra de Tiempo GPS (GPS Playback / Scrubber):**
  - Implementar una barra de reproducción temporal interactiva en el mapa de rastreo (`LiveMap.tsx`).
  - Capacidad de seleccionar fecha/rango horario, reproducir el recorrido del técnico paso a paso con controles Play/Pausa, velocidad ($1\times, 2\times, 5\times$) y barra de scrubber para auditoría de traslados.
- [ ] **Frente 3: Detección Automática de Estadías (Lugares Visitados $\ge 5$ min):**
  - Algoritmo para agrupar puntos de telemetría continuos con velocidad $\approx 0$ durante $\ge 5$ minutos.
  - Ventana o modal lateral que liste los lugares y villas donde el personal estuvo detenido, hora de entrada, hora de salida y tiempo total de permanencia en obra.

---

## Referencia de diseño web confirmada por el cliente

- La estructura y el diseño de `cabosystems-web` deben basarse en TailAdmin: https://github.com/TailAdmin/free-react-tailwind-admin-dashboard.
- Usar esta referencia para la navegación, barra lateral, cabecera, distribución del dashboard, componentes y comportamiento responsive.
- Adaptar la base a la identidad de CaboSystems: marca y logotipo propios, acento naranja corporativo `#f78c26` y coherencia con el tema claro y los módulos existentes.
- Las skills de diseño deben apoyar esta dirección y respetar la referencia elegida por el cliente.
- La captura compartida identifica el repositorio de referencia; no constituye una solicitud de ejecutar sus comandos de instalación ni de reemplazar la aplicación existente.

### Refinamiento de la web (13 de octubre de 2026)

La guía de diseño vigente está en `cabosystems-web/DESIGN.md`. Se refinó la cabecera adaptable por módulo, la navegación de escritorio y móvil, la distribución del chat y de obras, el contraste de acciones y los estilos compartidos de formularios. Se añadió manejo de foco y Escape en los diálogos principales, desplazamiento horizontal en tablas de personal y reajuste del mapa al cambiar el tamaño de su contenedor. Mapa, chat y obras cargan sus módulos cuando se necesitan. Estos cambios conservan las funciones existentes y la base TailAdmin.

## 8. Guía de Ejecución Rápida

- **Iniciar entorno web de desarrollo:**
  ```bash
  cd cabosystems-web
  npm run dev
  ```
- **Validar TypeScript y Build de Producción:**
  ```bash
  cd cabosystems-web
  npm run build
  ```
- **Variables de Entorno (`cabosystems-web/.env`):**
  - `VITE_SUPABASE_URL=https://nyqlfgnblkmijxspkvpi.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=...`

---

*Documento actualizado al 13 de Octubre de 2026.*

### Gestión de equipo como página

Colaboradores e Invitaciones pendientes ahora forman una página con secciones (`components/team/TeamManagementView.tsx`), accesibles desde la barra lateral y navegación interna. Las opciones ya no abren modales. «Nueva invitación» abre un modal minimalista desde Invitaciones. La barra lateral muestra solo «Equipo» para este módulo; Colaboradores e Invitaciones se eligen dentro de la página. Las invitaciones aceptadas no se muestran; los encabezados de su tabla siguen ocultos visualmente. El formulario conserva su contenido al cambiar de sección dentro de esta página.

### Chat móvil con paridad de funciones y gestos (14 de octubre de 2026)

La pantalla móvil `app/chat/[id].tsx` también usa respuestas `reply_to_id` y `chat_pins` con el mismo contrato que la web. Pulsación larga o botón de opciones selecciona el mensaje; la cabecera muestra responder, fijar/desfijar, copiar y eliminar con confirmación. Debajo aparecen seis reacciones rápidas y el selector completo. Deslizar hacia la derecha responde (activación horizontal >14 px, respuesta ≥60 px, sin tomar desplazamientos verticales); volver/cancelar termina la selección. Los mensajes fijados se consultan desde la barra bajo la cabecera y las citas llevan al original, incluso fuera de la ventana de mensajes cargados. FlashList virtualiza mensajes y emojis. Se empaquetan localmente los WebP/licencias Fluent y el catálogo Unicode 17/CLDR 48, generados por `scripts/sync-mobile-chat-emoji.py`. Recientes se almacenan localmente; los mensajes siguen siendo Unicode. `expo-clipboard` 57.0.2 habilita copiar; para un binario instalado se requiere nueva compilación nativa. `npm run test:chat` cubre gestos, Unicode, assets y contratos de API. No se alteraron las migraciones ni los permisos del backend en esta adaptación.

### Ajuste de interacción del chat móvil (15 de octubre de 2026)

Precarga y biblioteca local: al entrar al chat se consulta la biblioteca en segundo plano y se preparan, durante un turno libre de la interfaz, las primeras 32 caras y las seis reacciones (sin duplicados). `chatMediaWarmup.ts` limita a cuatro decodificaciones simultáneas y conserva imágenes de hasta 128 px para el selector; los emojis grandes del mensaje usan el recurso original. Los primeros 24 stickers se precargan con caché de imágenes en memoria y disco, con cuatro descargas simultáneas. No se precarga el catálogo entero.

`stickerLibraryCache.ts` comparte la colección en memoria por cuenta y persiste hasta 500 entradas de metadatos en un JSON privado de la app (adaptador `stickerLibrary.ts`, `expo-file-system` 57.0.6 ya incluido en dependencias transitivas, ahora declarado directamente). Se lee el archivo antes de esperar la red, se agrupan consultas simultáneas y se limita la actualización a una por minuto. El selector reutiliza esa colección al reabrir o cambiar de pestaña. Las importaciones se agregan inmediatamente y no se pierden ante respuestas atrasadas. Un fallo de consulta conserva la caché; `getMyStickers` propaga errores en vez de convertirlos en una colección vacía. Datos corruptos o de otra cuenta se descartan. Las doce pruebas del chat cubren precarga limitada, reintentos, lectura sin conexión, persistencia entre sesiones y carreras entre importación y actualización.

La exportación Android con esta precarga y caché terminó correctamente. Se verificó en el Android físico que aparecen las caras y la colección de dos stickers y que existe el JSON privado por cuenta. Los stickers ya estaban visibles en una captura completada 1.114 s después del toque (incluye ejecución ADB y captura; no es latencia de render ni una medición de release). La reapertura inicial reveló un montaje repetido con filas transitoriamente vacías: ahora se prepara el panel tras cargar el grupo, se conserva montado al cerrarlo y ambas pestañas conservan sus listas y estado. Las zonas ocultas no aceptan toques ni se exponen a accesibilidad; cerrar el panel también oculta el teclado. Tras el ajuste se capturaron completas las primeras filas al abrir. TypeScript, doce pruebas y la exportación Android final pasan. La última repetición de reapertura se interrumpió cuando el teléfono cambió a otra app; no se enviaron mensajes ni se alteró contenido del chat. Capturas de CaboSystems: `.expo/phone-emoji-prepared.png`, `.expo/phone-stickers-prepared.png` y `.expo/phone-panel-retained.png`.

Rendimiento de primera apertura: los registros de desarrollo mostraron compilaciones bajo demanda de ~9,3 s para `EmojiPicker` y ~3,9 s para `StickerPicker`. Se sustituyeron los imports dinámicos de `ComposerMediaPanel` y `ChatToolsModal` por imports estáticos: ambos selectores forman parte de la carga del chat, sin pedir un bundle adicional al pulsar sus pestañas. Se conserva FlashList para virtualizar emojis/stickers. La colección de stickers sigue usando su consulta remota y caché de imágenes. TypeScript y siete pruebas del chat pasan; estas cifras son del problema anterior en desarrollo, no una medición del tiempo final ni de una versión release.

En Windows, `cabosystems-mobile/metro.config.js` limita a 32 las operaciones simultáneas de caché de Metro: los paquetes bajo demanda del catálogo completo superaban el límite de archivos abiertos (`EMFILE`) en el teléfono de desarrollo. La cola conserva los errores y libera su turno tanto al completar como al fallar. El servidor de revisión se limita a localhost IPv4 y se accede mediante el túnel USB de ADB.

La revisión física confirmó el catálogo Fluent, la colección de stickers y la búsqueda de «sol» (22 resultados). Se adaptó la altura del panel al teclado Android para mantener visibles el campo de búsqueda y los resultados; `KeyboardAvoidingView` usa `height` en Android. El contenedor del gesto horizontal envuelve la zona de pulsación larga para evitar conflictos entre ambos reconocedores. No se enviaron mensajes, reacciones ni se modificaron fijados durante esta revisión.

Validación final: TypeScript y las siete pruebas del chat pasan; exportación Android final completada. Tras reconectar el Android físico, se confirmó que deslizar a la derecha abre la respuesta citando el mensaje correcto y enfoca el teclado. Se canceló la respuesta sin enviarla. También se confirmó la pulsación larga en el espacio libre de la fila, fuera de la burbuja: mantiene las acciones superiores y las reacciones justo sobre el mensaje seleccionado. El chat quedó sin borrador, respuesta ni selección pendientes. Capturas de comprobación en `.expo/phone-reply-verified.png` y `.expo/phone-longpress-verified.png` (archivos locales ignorados).

El botón de emojis abre un panel integrado debajo del compositor con pestañas **Emojis / Stickers**, búsqueda y categorías de emojis en la barra inferior. La selección de emojis conserva abierto el panel; los stickers permiten buscar e importar la colección personal. Se retiraron los accesos separados del compositor y los tres puntos de cada mensaje. La pulsación larga funciona en toda la fila, incluidas citas y medios, y mantiene las acciones en la cabecera. Las seis reacciones rápidas ahora se posicionan sobre la burbuja seleccionada, con medición nativa y seguimiento del desplazamiento de FlashList. La selección de una fila y la ubicación de las reacciones se verificaron en el Android físico conectado; las pruebas automatizadas del chat incluyen límites de posición, gestos y Unicode. Esta sección sustituye la ubicación anterior de las reacciones bajo la cabecera.

### Fluent Emoji y funciones del chat web (14 de octubre de 2026)

Chat web ampliado con menú de mensaje y reacciones rápidas, selector completo Unicode 17/CLDR 48 (3,953 emojis, búsqueda ES/EN, categorías y recientes), respuestas citadas y mensajes fijados compartidos. Esquema: `chat_mensajes.reply_to_id` usa FK compuesta para impedir citas entre grupos; al borrar el original se conserva la respuesta y se limpia su referencia. `chat_pins` tiene RLS por pertenencia, solo SELECT/INSERT/DELETE para authenticated y eliminación del fijado permitida al autor o administrador. FKs eliminan fijados huérfanos. Migraciones `20261014234557_chat_replies_and_pins.sql` y `20261014235815_restrict_chat_pin_grants.sql` aplicadas al proyecto vinculado. Pruebas transaccionales en `supabase/tests/chat_replies_and_pins.sql` revierten todas las escrituras. El cliente obtiene citas por lotes, sin depender de inferencia de relaciones compuestas de PostgREST. Esta primera implementación visual se hizo en el frontend web; la adaptación móvil se detalla arriba.

Se integró Fluent Emoji 3D en mensajes, selector y reacciones. Las imágenes se alojan con la web, conservando licencias y atribución; los datos enviados y guardados siguen siendo Unicode. Los mensajes de solo emojis se muestran grandes y sin burbuja. Los emojis no cubiertos conservan su representación nativa.

### Agenda móvil adaptada a la web (15 de octubre de 2026)

La pestaña Agenda usa `tareas.fecha_programada` y ofrece calendario mensual laboral, día, semana de lunes a viernes y tareas sin fecha. El calendario compacto muestra cantidades por fecha; las tareas aparecen debajo en tarjetas que abren el detalle existente. Conserva el alcance de tareas asignadas al usuario y añade búsqueda combinada con villa y estado, opción Todas las villas, actualización al volver a la pantalla, refresco manual y cambios en tiempo real. Las fechas se procesan como fechas locales sin desplazamiento UTC. La vista diaria permite consultar fines de semana.

Se aplicaron las skills frontend-design, React Native y uncodixfy. Por indicación expresa del usuario, la cabecera de Agenda es blanca con logotipo oscuro, como Tareas; esto prevalece sobre la recomendación anterior de cabecera negra del AGENTS móvil. Se mantienen el naranja corporativo #f78c26 y las tareas completadas negras. Las pestañas permiten desplazamiento horizontal para evitar palabras partidas con texto ampliado. La lista está virtualizada y los calendarios y tarjetas memorizados. Incluye estados vacíos, error y carga, y textos ES/EN.

Validación automatizada: TypeScript y seis pruebas de fechas, equivalencia del calendario laboral con la web, filtros, tareas sin fecha y alcance por usuario pasan. No se modificó el esquema ni se crearon tareas para las pruebas.

La exportación Android final completó correctamente. En el teléfono físico se verificaron las vistas Día, Calendario mensual, Semana y Sin fecha, la cabecera blanca con barra de estado oscura y las pestañas sin palabras partidas. La cuenta de prueba no tenía tareas asignadas; las tarjetas con datos se cubren con pruebas de lógica, no con una comprobación visual de tareas reales.
