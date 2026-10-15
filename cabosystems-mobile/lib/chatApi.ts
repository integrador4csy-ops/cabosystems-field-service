import { supabase } from './supabase';
import type {
  ChatGroup,
  ChatMember,
  ChatMessage,
  ChatReaction,
  ChatSticker,
  ChatMessageType,
  ChatPin,
  Profile,
} from '@/types/database';

/**
 * Sube un archivo multimedia (imagen, video o sticker) al bucket de Supabase Storage
 */
export async function uploadChatMedia(
  uri: string,
  folder: 'messages' | 'groups' | 'stickers' = 'messages',
  contentType?: string
): Promise<string> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(fileName, blob, {
        contentType: contentType || blob.type || 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading chat media:', error);
    throw error;
  }
}

/**
 * Obtener todos los grupos en los que participa el usuario
 */
export async function getMyChatGroups(userId: string): Promise<ChatGroup[]> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const effectiveUserId = authData?.user?.id || userId;

    // 1. Obtener membresías del usuario y grupos donde sea creador
    const [memRes, createdRes] = await Promise.all([
      supabase
        .from('chat_miembros')
        .select('grupo_id, rol')
        .eq('profile_id', effectiveUserId),
      supabase
        .from('chat_grupos')
        .select('id')
        .eq('creado_por', effectiveUserId),
    ]);

    const memberships = memRes.data || [];
    const createdGroups = createdRes.data || [];

    const roleMap = new Map<string, string>();
    for (const m of memberships) {
      roleMap.set(m.grupo_id, m.rol);
    }
    for (const c of createdGroups) {
      if (!roleMap.has(c.id)) {
        roleMap.set(c.id, 'admin');
      }
    }

    const allGroupIds = Array.from(
      new Set([...memberships.map((m) => m.grupo_id), ...createdGroups.map((g) => g.id)])
    );

    if (allGroupIds.length === 0) return [];

    // 2. Obtener los grupos
    const { data: groups, error: grpError } = await supabase
      .from('chat_grupos')
      .select('*')
      .in('id', allGroupIds)
      .order('created_at', { ascending: false });

    if (grpError) throw grpError;
    if (!groups) return [];

    // 3. Para cada grupo, buscar miembros_count y último mensaje
    const enhancedGroups: ChatGroup[] = await Promise.all(
      groups.map(async (g) => {
        // Miembros count
        const { count } = await supabase
          .from('chat_miembros')
          .select('*', { count: 'exact', head: true })
          .eq('grupo_id', g.id);

        // Último mensaje
        const { data: lastMsg } = await supabase
          .from('chat_mensajes')
          .select('*, profiles(nombre)')
          .eq('grupo_id', g.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...g,
          miembros_count: count ?? 1,
          ultimo_mensaje: (lastMsg as ChatMessage) || null,
          mi_rol: roleMap.get(g.id) || (g.creado_por === effectiveUserId ? 'admin' : 'miembro'),
        };
      })
    );

    // Ordenar grupos: los que tienen mensaje más reciente van arriba
    enhancedGroups.sort((a, b) => {
      const timeA = a.ultimo_mensaje?.created_at || a.created_at;
      const timeB = b.ultimo_mensaje?.created_at || b.created_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    return enhancedGroups;
  } catch (error) {
    console.error('Error fetching chat groups:', error);
    return [];
  }
}

/**
 * Obtener detalles de un grupo específico
 */
export async function getChatGroupDetails(
  groupId: string,
  userId: string
): Promise<ChatGroup | null> {
  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = authData?.user?.id || userId;

  const { data: group, error: grpError } = await supabase
    .from('chat_grupos')
    .select('*')
    .eq('id', groupId)
    .single();

  if (grpError || !group) return null;

  const { data: member } = await supabase
    .from('chat_miembros')
    .select('rol')
    .eq('grupo_id', groupId)
    .eq('profile_id', effectiveUserId)
    .maybeSingle();

  const { count } = await supabase
    .from('chat_miembros')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_id', groupId);

  return {
    ...group,
    miembros_count: count ?? 1,
    mi_rol: member?.rol || (group.creado_por === effectiveUserId ? 'admin' : 'miembro'),
  };
}

/**
 * Obtener miembros de un grupo con su perfil
 */
export async function getGroupMembers(groupId: string): Promise<ChatMember[]> {
  const { data, error } = await supabase
    .from('chat_miembros')
    .select('*, profiles(*)')
    .eq('grupo_id', groupId)
    .order('rol', { ascending: true }); // 'admin' antes que 'miembro'

  if (error) throw error;
  return (data ?? []) as ChatMember[];
}

/**
 * Obtener mensajes de un grupo con perfiles y reacciones
 */
export async function getGroupMessages(
  groupId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_mensajes')
    .select('*, profiles(*), reacciones:chat_reacciones(*, profiles(nombre))')
    .eq('grupo_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return hydrateChatReplies((data ?? []) as ChatMessage[]);
}

async function hydrateChatReplies(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const ids = [...new Set(messages.flatMap((message) => message.reply_to_id ? [message.reply_to_id] : []))];
  if (!ids.length) return messages;
  const { data, error } = await supabase.from('chat_mensajes').select('*, profiles(*)').in('id', ids);
  if (error) throw error;
  const parents = new Map(((data ?? []) as ChatMessage[]).map((message) => [message.id, message]));
  return messages.map((message) => ({ ...message, reply: message.reply_to_id ? parents.get(message.reply_to_id) ?? null : null }));
}

export async function getChatMessage(id: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase.from('chat_mensajes').select('*, profiles(*), reacciones:chat_reacciones(*, profiles(nombre))').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (await hydrateChatReplies([data as ChatMessage]))[0] : null;
}

export async function getChatPins(groupId: string): Promise<ChatPin[]> {
  const { data, error } = await supabase.from('chat_pins').select('*').eq('grupo_id', groupId).order('created_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) return [];
  const { data: messages, error: messageError } = await supabase.from('chat_mensajes').select('*, profiles(*)').in('id', data.map((pin) => pin.mensaje_id));
  if (messageError) throw messageError;
  const byId = new Map(((messages ?? []) as ChatMessage[]).map((message) => [message.id, message]));
  return data.flatMap((pin) => { const message = byId.get(pin.mensaje_id); return message ? [{ ...pin, message } as ChatPin] : []; });
}

export async function pinChatMessage(message: ChatMessage, userId: string): Promise<void> {
  const { error } = await supabase.from('chat_pins').insert({ mensaje_id: message.id, grupo_id: message.grupo_id, pinned_by: userId });
  if (error && error.code !== '23505') throw error;
}
export async function unpinChatMessage(messageId: string): Promise<void> {
  const { data, error } = await supabase.from('chat_pins').delete().eq('mensaje_id', messageId).select('mensaje_id');
  if (error) throw error;
  if (!data?.length) throw new Error('No permission to unpin this message.');
}
export async function deleteChatMessage(messageId: string): Promise<void> {
  const { data, error } = await supabase.from('chat_mensajes').delete().eq('id', messageId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No permission to delete this message.');
}

/**
 * Crear un nuevo grupo (Solo Admins)
 */
export async function createChatGroup(params: {
  nombre: string;
  descripcion?: string;
  fotoUri?: string | null;
  solo_multimedia: boolean;
  creatorId: string;
  memberIds: string[];
}): Promise<ChatGroup> {
  const { data: authData } = await supabase.auth.getUser();
  const effectiveCreatorId = authData?.user?.id || params.creatorId;

  let foto_url: string | null = null;
  if (params.fotoUri) {
    foto_url = await uploadChatMedia(params.fotoUri, 'groups');
  }

  // 1. Insertar grupo
  const { data: group, error: grpError } = await supabase
    .from('chat_grupos')
    .insert({
      nombre: params.nombre.trim(),
      descripcion: params.descripcion?.trim() || null,
      foto_url,
      creado_por: effectiveCreatorId,
      solo_multimedia: params.solo_multimedia,
    })
    .select()
    .single();

  if (grpError) throw grpError;

  // 2. Insertar miembros (Creador como admin, los demás como miembros)
  const allMembers = [
    { grupo_id: group.id, profile_id: effectiveCreatorId, rol: 'admin' },
    ...params.memberIds
      .filter((id) => id !== effectiveCreatorId)
      .map((id) => ({ grupo_id: group.id, profile_id: id, rol: 'miembro' })),
  ];

  const { error: memError } = await supabase
    .from('chat_miembros')
    .insert(allMembers);

  if (memError) throw memError;

  return {
    ...group,
    mi_rol: 'admin',
    miembros_count: allMembers.length,
  };
}

/**
 * Actualizar configuración de un grupo (Solo Admins)
 */
export async function updateChatGroup(
  groupId: string,
  updates: {
    nombre?: string;
    descripcion?: string;
    fotoUri?: string | null;
    solo_multimedia?: boolean;
  }
): Promise<void> {
  const payload: any = {};
  if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim();
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion.trim();
  if (updates.solo_multimedia !== undefined) payload.solo_multimedia = updates.solo_multimedia;

  if (updates.fotoUri) {
    payload.foto_url = await uploadChatMedia(updates.fotoUri, 'groups');
  }

  const { error } = await supabase
    .from('chat_grupos')
    .update(payload)
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Agregar integrantes al grupo (Solo Admins)
 */
export async function addChatGroupMembers(
  groupId: string,
  profileIds: string[]
): Promise<void> {
  const records = profileIds.map((id) => ({
    grupo_id: groupId,
    profile_id: id,
    rol: 'miembro',
  }));

  const { error } = await supabase
    .from('chat_miembros')
    .insert(records);

  if (error) throw error;
}

/**
 * Expulsar integrante del grupo (Solo Admins)
 */
export async function removeChatGroupMember(
  groupId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from('chat_miembros')
    .delete()
    .eq('grupo_id', groupId)
    .eq('profile_id', profileId);

  if (error) throw error;
}

/**
 * Eliminar grupo por completo (Solo Admins)
 */
export async function deleteChatGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_grupos')
    .delete()
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Enviar un mensaje (Texto, Imagen, Video o Sticker)
 */
export async function sendChatMessage(params: {
  grupo_id: string;
  remitente_id: string;
  tipo: ChatMessageType;
  contenido?: string | null;
  mediaUri?: string | null;
  mediaMeta?: any;
  reply_to_id?: string | null;
}): Promise<ChatMessage> {
  let media_url: string | null = null;

  if (params.mediaUri && (params.tipo === 'imagen' || params.tipo === 'video')) {
    const contentType = params.tipo === 'video' ? 'video/mp4' : 'image/jpeg';
    media_url = await uploadChatMedia(params.mediaUri, 'messages', contentType);
  } else if (params.tipo === 'sticker' && params.mediaUri) {
    media_url = params.mediaUri;
  }

  const { data, error } = await supabase
    .from('chat_mensajes')
    .insert({
      grupo_id: params.grupo_id,
      remitente_id: params.remitente_id,
      tipo: params.tipo,
      contenido: params.contenido || null,
      media_url,
      media_meta: params.mediaMeta || null,
      reply_to_id: params.reply_to_id || null,
    })
    .select('*, profiles(*)')
    .single();

  if (error) throw error;

  // Disparar notificaciones push a los integrantes del grupo (segundo plano, sin bloquear)
  supabase.functions
    .invoke('chat-push-notifications', {
      body: {
        record: {
          id: data.id,
          grupo_id: params.grupo_id,
          remitente_id: params.remitente_id,
          tipo: params.tipo,
          contenido: params.contenido || null,
        },
      },
    })
    .catch((err) => {
      console.warn('Push notification dispatch error:', err);
    });

  return data as ChatMessage;
}

/**
 * Reaccionar con emoji a un mensaje o foto/video
 */
export async function toggleChatReaction(
  mensaje_id: string,
  profile_id: string,
  emoji: string
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('chat_reacciones')
    .select('id')
    .eq('mensaje_id', mensaje_id)
    .eq('profile_id', profile_id)
    .eq('emoji', emoji)
    .maybeSingle();

  if (readError) throw readError;
  const { error } = existing
    ? await supabase.from('chat_reacciones').delete().eq('id', existing.id)
    : await supabase.from('chat_reacciones').insert({
      mensaje_id,
      profile_id,
      emoji,
    });
  if (error) throw error;
}

/**
 * Obtener biblioteca de stickers del usuario
 */
export async function getMyStickers(userId: string): Promise<ChatSticker[]> {
  const { data, error } = await supabase
    .from('chat_stickers')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChatSticker[];
}

/**
 * Importar / Subir un sticker (.webp de WhatsApp o imagen transparente)
 */
export async function uploadSticker(
  userId: string,
  fileUri: string,
  name?: string,
  packName = 'WhatsApp Stickers'
): Promise<ChatSticker> {
  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = authData?.user?.id || userId;

  const url = await uploadChatMedia(fileUri, 'stickers', 'image/webp');

  const { data, error } = await supabase
    .from('chat_stickers')
    .insert({
      profile_id: effectiveUserId,
      url,
      nombre: name || 'Sticker',
      pack_name: packName,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChatSticker;
}

/**
 * Obtener todos los perfiles disponibles para invitar
 */
export async function getAllProfilesForInvite(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Profile[];
}
