# CaboSystems Field Service — App móvil (Expo / React Native)

## Estado del proyecto

App de campo para técnicos de CaboSystems. Expo Router + TypeScript + Supabase (Auth + Postgres + Storage), Montserrat, lucide-react-native, expo-blur, FlashList, glass navbar estilo CSY con selección de proyecto/unidad.

### 1. Paleta estricta de 4 colores — SIEMPRE

En este proyecto **solo se usan estos 4 colores**. Prohibido introducir cualquier otro
(verdes de éxito, rojos de error, azules, grises tipo `#9ca3af`, semáforos, google-blue, etc.)
a menos que el usuario lo pida explícitamente.

| Color | Uso |
|---|---|
| `negro` `#000000` (y alphas `rgba(0,0,0,..)`) | texto principal, superficies oscuras, sombras, dropdown/check-in, navbar glass |
| `blanco` `#FFFFFF` | fondos de pantalla/cards sobre blanco, texto sobre oscuro, acentos neutrales |
| `#343e48` (gris pizarra) | fondo oscuro de navbar/header, texto secundario, bordes, estado "pendiente" |
| `#f78c26` (naranja CSY) | acento de marca/CTA, en_proceso |

Reglas de estados (solo con la paleta):
- `pendiente` → `#343e48`
- `en_proceso` → `#f78c26`
- `completada` → **negro** `#000000` (con tilde `blanco` o fondo oscuro), nunca verde.

Navbar/header = negro glass: `BlurView tint="dark"` + overlay `rgba(0,0,0,...alpha)` translúcido
(negro transparente), NO un gris sólido `#343e48` de fondo.

### 2. Estructura

- `app/(tabs)/index.tsx` — dashboard (saludo, stats, tareas, selector de proyecto)
- `app/(tabs)/schedule.tsx` — horario
- `app/(tabs)/chat.tsx`, `users.tsx`, `profile.tsx`
- `app/task/[id].tsx` — detalle de tarea
- `app/checkin/[id].tsx` — check-in/out con GPS + foto
- `app/(auth)/index.tsx`, `signup.tsx` — login/registro
- `components/HeaderCaboSystems.tsx` — header glass con selector de unidad
- `constants/Theme.ts` — **la** fuente de colores (solo 4 + alphas) y spacing
- `types/database.ts` — tipos de Supabase
- Base de datos en `supabase/` (migraciones SQL)

### 3. Reglas de negocio

- Check-in/out obligatorio: GPS validado + ≥1 foto desde cámara.
- Offline-first: cola local (colas en AsyncStorage/MMKV), sincroniza con Supabase al recuperar red (NetInfo).
