export interface Proyecto {
  id: string;
  desarrollo: string;
  desarrollo_id?: string | null;
  villa: string;
  integrador_id?: string | null;
  tecnico_id?: string | null;
  numero_proyecto?: string | null;
  cliente?: string | null;
  descripcion: string | null;
  estatus: 'activo' | 'pausado' | 'en_conciliacion' | 'finalizado';
  latitud?: number | null;
  longitud?: number | null;
  radio_geocerca_m?: number | null;
  created_at?: string;
}

export interface Subtarea {
  orden_plantilla?: number | null;
  id: string;
  tarea_id: string;
  titulo: string;
  completada: boolean;
  created_at?: string;
}

export interface Tarea {
  orden_plantilla?: number | null;
  id: string;
  proyecto_id: string;
  asignado_a: string | null;
  titulo: string;
  descripcion: string | null;
  estatus: 'pendiente' | 'en_proceso' | 'completada';
  prioridad: 'baja' | 'media' | 'alta';
  prioridad_orden?: number;
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
