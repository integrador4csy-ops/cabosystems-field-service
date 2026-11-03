import type { Profile } from './fleet';

export type ChatMessageType = 'texto' | 'imagen' | 'video' | 'sticker' | 'archivo' | 'audio' | 'sistema';
export type ChatMemberRole = 'admin' | 'miembro';

export interface ChatReaction {
  id: string;
  mensaje_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
  profiles?: { nombre: string } | null;
}

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

export interface ChatSticker {
  id: string;
  profile_id: string;
  nombre: string | null;
  url: string;
  pack_name: string;
  created_at: string;
}
