export type UserRole =
  | 'admin'
  | 'supervisor_instalacion'
  | 'instalador'
  | 'aux_instalacion'
  | 'integrador'
  | 'aux_integracion'
  | 'infraestructura'
  | 'aux_infraestructura'
  | 'servicios'
  | 'aux_servicios'
  | 'aux_operaciones';

export type TaskStatus = 'pendiente' | 'en_proceso' | 'completada';
export type ProjectStatus = 'activo' | 'pausado' | 'finalizado';
export type CheckInType = 'check_in' | 'check_out';
export type Prioridad = 'baja' | 'media' | 'alta';
export type PendienteStatus = 'pendiente' | 'en_proceso' | 'resuelta';

export interface Profile {
  id: string;
  nombre: string;
  rol: UserRole;
  activo: boolean;
  avatar_url?: string | null;
  fecha_nacimiento?: string | null;
  created_at: string;
}

export interface UbicacionUsuario {
  usuario_id: string;
  latitud: number;
  longitud: number;
  precision?: number | null;
  velocidad?: number | null;
  rumbo?: number | null;
  bateria?: number | null;
  esta_cargando?: boolean;
  en_linea?: boolean;
  updated_at: string;
}

export interface WorkerWithLocation extends Profile {
  ubicacion?: UbicacionUsuario | null;
}

export interface Project {
  id: string;
  desarrollo: string;
  villa: string;
  unidad?: string;
  descripcion: string | null;
  estatus: ProjectStatus;
  created_at: string;
}

export interface Task {
  id: string;
  proyecto_id: string;
  asignado_a: string | null;
  titulo: string;
  descripcion: string | null;
  estatus: TaskStatus;
  prioridad: Prioridad;
  prioridad_orden?: number;
  fecha_programada?: string | null;
  created_at: string;
}

export interface Subtarea {
  id: string;
  tarea_id: string;
  titulo: string;
  completada: boolean;
  created_at: string;
}

export interface FieldRecord {
  id: string;
  tarea_id: string;
  tecnico_id: string;
  tipo: CheckInType;
  latitud: number;
  longitud: number;
  foto_url: string;
  comentarios: string | null;
  fecha_hora: string;
}

export interface Pendiente {
  id: string;
  proyecto_id: string;
  tecnico_id: string | null;
  descripcion: string;
  prioridad: Prioridad;
  estatus: PendienteStatus;
  created_at: string;
}

export type ChatMessageType = 'texto' | 'imagen' | 'video' | 'sticker' | 'archivo' | 'audio' | 'sistema';
export type ChatMemberRole = 'admin' | 'miembro';

export interface ChatMessageMediaMeta {
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  system_type?: string;
  task_activity_id?: string;
  request_id?: string;
  task_id?: string;
  task_title?: string;
  project_id?: string;
  desarrollo?: string;
  villa?: string;
  subtask_id?: string;
  subtask_title?: string;
  action?: string;
  anterior?: string;
  siguiente?: string;
  estado?: string;
  comentario?: string;
  evidencia_path?: string;
}

export interface ChatGroup {
  id: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  creado_por: string;
  solo_multimedia: boolean;
  proyecto_id?: string | null;
  created_at: string;
  // Campos computados / joins
  proyecto?: {
    id: string;
    desarrollo: string;
    villa: string;
  } | null;
  miembros_count?: number;
  ultimo_mensaje?: ChatMessage | null;
  mi_rol?: ChatMemberRole;
}

export interface ChatMember {
  id: string;
  grupo_id: string;
  profile_id: string;
  rol: ChatMemberRole;
  unido_en: string;
  profiles?: Profile | null;
}

export interface ChatMessage {
  id: string;
  grupo_id: string;
  remitente_id: string;
  tipo: ChatMessageType;
  contenido: string | null;
  media_url: string | null;
  media_thumbnail_url: string | null;
  media_meta?: ChatMessageMediaMeta | null;
  created_at: string;
  profiles?: Profile | null;
  reacciones?: ChatReaction[];
  reply_to_id?: string | null;
  reply?: ChatMessage | null;
}

export interface ChatPin {
  mensaje_id: string;
  grupo_id: string;
  pinned_by: string;
  created_at: string;
  message: ChatMessage;
}

export interface ChatReaction {
  id: string;
  mensaje_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
  profiles?: { nombre: string } | null;
}

export interface ChatSticker {
  id: string;
  profile_id: string;
  nombre: string | null;
  url: string;
  pack_name: string;
  created_at: string;
}

