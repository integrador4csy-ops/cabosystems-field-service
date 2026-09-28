import type { Profile } from './fleet';

export type ChatMessageType = 'texto' | 'imagen' | 'video' | 'sticker';
export type ChatMemberRole = 'admin' | 'miembro';

export interface ChatReaction {
  id: string;
  mensaje_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
  profiles?: { nombre: string } | null;
}

export interface ChatMessage {
  id: string;
  grupo_id: string;
  remitente_id: string;
  tipo: ChatMessageType;
  contenido: string | null;
  media_url: string | null;
  media_thumbnail_url: string | null;
  media_meta?: {
    width?: number;
    height?: number;
    duration?: number;
    fileName?: string;
    fileSize?: number;
  } | null;
  created_at: string;
  profiles?: Profile | null;
  reacciones?: ChatReaction[];
}

export interface ChatGroup {
  id: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  creado_por: string;
  solo_multimedia: boolean;
  created_at: string;
  // Campos computados / joins
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
