export interface Proyecto {
  id: string;
  desarrollo: string;
  villa: string;
  descripcion: string | null;
  estatus: 'activo' | 'pausado' | 'finalizado';
  latitud?: number | null;
  longitud?: number | null;
  created_at?: string;
}

export interface Subtarea {
  id: string;
  tarea_id: string;
  titulo: string;
  completada: boolean;
  created_at?: string;
}

export interface Tarea {
  id: string;
  proyecto_id: string;
  asignado_a: string | null;
  titulo: string;
  descripcion: string | null;
  estatus: 'pendiente' | 'en_proceso' | 'completada';
  fecha_programada?: string | null;
  created_at?: string;
  profiles?: {
    id: string;
    nombre: string;
    avatar_url?: string | null;
    rol?: string;
  } | null;
  subtareas?: Subtarea[];
}

export interface DesarrolloGroup {
  nombre: string;
  villasCount: number;
  activeCount: number;
  villas: Proyecto[];
}
