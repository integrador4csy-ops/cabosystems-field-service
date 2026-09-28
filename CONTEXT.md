# CaboSystems Field Service App

## Tabla de contenido

- [Contexto del proyecto](#contexto-del-proyecto)
- [Stack tecnológico](#stack-tecnológico)
- [Roles de usuario](#roles-de-usuario)
- [Estructura de la base de datos](#estructura-de-la-base-de-datos-supabase-postgresql)
- [Reglas de negocio y funcionales](#reglas-de-negocio-y-funcionales)
- [Resumen ejecutivo](#resumen-ejecutivo)

## Contexto del proyecto

CaboSystems Field Service App es una plataforma móvil y web para la gestión, control operativo y documentación de actividades del personal técnico en campo para la empresa CaboSystems. El objetivo principal es resolver la dispersión de información de los proyectos mediante un MVP funcional que incluya:

- App móvil multiplataforma (Android/iOS): para técnicos e integradores en sitio.
- Dashboard web administrativo: para administradores y supervisores de proyectos.
- Sincronización offline-first: para realizar check-in/check-out con GPS y evidencia fotográfica sin internet, sincronizando automáticamente al recuperar la señal.

## Stack tecnológico

- App móvil: React Native con Expo (TypeScript)
- Dashboard web: Next.js (App Router, Tailwind CSS, TypeScript)
- Backend y base de datos: Supabase (PostgreSQL, Supabase Auth, Supabase Storage)
- Almacenamiento local (offline): MMKV / AsyncStorage para la cola de peticiones en la app móvil
- Control de versiones: Git / GitHub

## Roles de usuario

- **admin**: acceso total para gestión de usuarios, proyectos, tareas, reportes y métricas.
- **supervisor**: gestión de proyectos asignados, revisión de avances, aprobación de evidencias y reportes.
- **tecnico**: visualización de tareas asignadas, registro de check-in/check-out con foto y GPS, y soporte de comentarios/reportes.

## Estructura de la base de datos (Supabase PostgreSQL)

### 1. Tabla `profiles` (perfiles de usuario)

- `id` (UUID, Primary Key, Foreign Key -> `auth.users.id`)
- `nombre` (TEXT, Not Null)
- `rol` (TEXT, Check: `admin`, `supervisor`, `tecnico`)
- `created_at` (TIMESTAMPTZ)

### 2. Tabla `proyectos`

- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `nombre` (TEXT, Not Null)
- `descripcion` (TEXT)
- `estatus` (TEXT, Check: `activo`, `pausado`, `finalizado`)
- `created_at` (TIMESTAMPTZ)

### 3. Tabla `tareas`

- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `proyecto_id` (UUID, Foreign Key -> `proyectos.id`)
- `asignado_a` (UUID, Foreign Key -> `profiles.id`)
- `titulo` (TEXT, Not Null)
- `descripcion` (TEXT)
- `estatus` (TEXT, Check: `pendiente`, `en_proceso`, `completada`)
- `created_at` (TIMESTAMPTZ)

### 4. Tabla `registros_campo` (check-in / check-out)

- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `tarea_id` (UUID, Foreign Key -> `tareas.id`)
- `tecnico_id` (UUID, Foreign Key -> `profiles.id`)
- `tipo` (TEXT, Check: `check_in`, `check_out`)
- `latitud` (DOUBLE PRECISION, Not Null)
- `longitud` (DOUBLE PRECISION, Not Null)
- `foto_url` (TEXT, Not Null)
- `comentarios` (TEXT)
- `fecha_hora` (TIMESTAMPTZ, Default: NOW())

## Reglas de negocio y funcionales

- **Check-in / check-out obligatorio:** requiere coordenadas GPS validadas y al menos 1 fotografía capturada desde la cámara de la app.
- **Funcionamiento offline:** si no hay red, el check-in/check-out se guarda localmente en el dispositivo. La app escucha cambios de conectividad (NetInfo); al detectar internet, envía la cola acumulada a Supabase (Database + Storage).
- **Costo mínimo:** uso del Free Tier de Supabase (PostgreSQL y Storage bucket público `evidencias-campo`).

---

## Resumen ejecutivo

El MVP busca centralizar la operación en campo, reducir errores en la documentación y mejorar la trazabilidad de las actividades del personal técnico.
