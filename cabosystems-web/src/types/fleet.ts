export interface Profile {
  id: string;
  email?: string | null;
  nombre?: string | null;
  full_name?: string | null;
  rol?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  activo?: boolean;
}

export interface UserLocation {
  usuario_id: string;
  latitud: number;
  longitud: number;
  precision: number | null;
  velocidad: number | null;
  rumbo: number | null;
  bateria: number | null;
  esta_cargando: boolean;
  actividad?: 'detenido' | 'caminando' | 'conduciendo' | string | null;
  en_linea: boolean;
  updated_at: string;
}

export interface LiveWorker {
  profile: Profile;
  location: UserLocation;
  // Dynamic display fields
  isOffline: boolean;
  relativeTime: string;
  // Current animated position for smooth lerp movement
  displayLat: number;
  displayLng: number;
  targetLat: number;
  targetLng: number;
}
