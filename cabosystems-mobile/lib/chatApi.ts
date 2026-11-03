import { supabase } from './supabase';
import type {
  ChatGroup,
  ChatMember,
  ChatMemberRole,
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
  contentType?: string,
  originalName?: string
): Promise<string> {
  try {
    const suffix = (originalName || uri.split(/[?#]/)[0]).split('.').pop()?.toLowerCase() || '';
    let ext = /^[a-z0-9]{1,12}$/.test(suffix) ? suffix : '';
    if (!ext || ext === 'bin') {
      if (contentType?.includes('mp4')) ext = 'mp4';
      else if (contentType?.includes('quicktime') || contentType?.includes('mov')) ext = 'mov';
      else if (contentType?.includes('video')) ext = 'mp4';
      else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) ext = 'jpg';
      else if (contentType?.includes('png')) ext = 'png';
      else if (contentType?.includes('webp')) ext = 'webp';
      else if (contentType?.includes('pdf')) ext = 'pdf';
      else ext = 'bin';
    }
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const buffer = /^(file|content):/.test(uri)
      ? await new (await import('expo-file-system')).File(uri).arrayBuffer()
      : await (await fetch(uri)).arrayBuffer();
    if (buffer.byteLength > 50 * 1024 * 1024) throw new Error('El archivo supera 50 MB.');

    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(fileName, buffer, {
        contentType: contentType || 'application/octet-stream',
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

const chatGroupsCache: Record<string, { data: ChatGroup[]; timestamp: number }> = {};

export function getCachedMyChatGroups(userId: string, maxAge = Infinity): ChatGroup[] | null {
  const cached = chatGroupsCache[userId];
  return cached && Date.now() - cached.timestamp < maxAge ? cached.data : null;
}

export async function preloadMyChatGroups(userId: string): Promise<ChatGroup[]> {
  const cached = getCachedMyChatGroups(userId, 20_000);
  if (cached) return cached;
  try {
    return await getMyChatGroups(userId);
  } catch {
    return [];
  }
}

async function allChatRows<T>(page: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await page(offset);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) return rows;
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
    const [memberships, createdGroups] = await Promise.all([
      allChatRows<{ grupo_id: string; rol: ChatMemberRole }>(offset => supabase.from('chat_miembros')
        .select('grupo_id, rol').eq('profile_id', effectiveUserId).order('id').range(offset, offset + 499)),
      allChatRows<{ id: string }>(offset => supabase.from('chat_grupos')
        .select('id').eq('creado_por', effectiveUserId).order('id').range(offset, offset + 499)),
    ]);

    const roleMap = new Map<string, ChatMemberRole>();
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

    if (allGroupIds.length === 0) { chatGroupsCache[effectiveUserId] = { data: [], timestamp: Date.now() }; return []; }

    // Query in bounded ID batches so no group's membership is dropped by a server row limit.
    const groups: ChatGroup[] = [];
    for (let offset = 0; offset < allGroupIds.length; offset += 200) {
      const { data, error } = await supabase.from('chat_grupos').select('*, proyecto:proyectos(id, desarrollo, villa)').in('id', allGroupIds.slice(offset, offset + 200)).order('created_at', { ascending: false });
      if (error) throw error;
      groups.push(...(data ?? []));
    }

    // 3. Para cada grupo, buscar miembros_count y último mensaje
    const enhancedGroups: ChatGroup[] = [];
    for (let offset = 0; offset < groups.length; offset += 4) {
      enhancedGroups.push(...await Promise.all(groups.slice(offset, offset + 4).map(async (g) => {
        // Miembros count
        const { count, error: countError } = await supabase
          .from('chat_miembros')
          .select('*', { count: 'exact', head: true })
          .eq('grupo_id', g.id);

        // Último mensaje
        if (countError) throw countError;
        const { data: lastMsg, error: messageError } = await supabase
          .from('chat_mensajes')
          .select('*, profiles(nombre)')
          .eq('grupo_id', g.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (messageError) throw messageError;

        return {
          ...g,
          miembros_count: count ?? 1,
          ultimo_mensaje: (lastMsg as ChatMessage) || null,
          mi_rol: roleMap.get(g.id) || (g.creado_por === effectiveUserId ? 'admin' : 'miembro'),
        };
      })));
    }

    // Ordenar grupos: los que tienen mensaje más reciente van arriba
    enhancedGroups.sort((a, b) => {
      const timeA = a.ultimo_mensaje?.created_at || a.created_at;
      const timeB = b.ultimo_mensaje?.created_at || b.created_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    chatGroupsCache[effectiveUserId] = {
      data: enhancedGroups,
      timestamp: Date.now(),
    };

    return enhancedGroups;
  } catch (error) {
    console.error('Error fetching chat groups:', error);
    throw error;
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
    .select('*, proyecto:proyectos(id, desarrollo, villa)')
    .eq('id', groupId)
    .single();

  if (grpError && grpError.code !== 'PGRST116') throw grpError;
  if (!group) return null;

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
 * Obtener todos los archivos adjuntos y multimedia de un grupo
 */
export async function getGroupAttachments(groupId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_mensajes')
    .select('*, profiles(*)')
    .eq('grupo_id', groupId)
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
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

/** Stable keyset pagination keeps inserts from shifting the history being downloaded. */
export async function getGroupMessagePage(
  groupId: string,
  before?: { created_at: string; id: string },
  limit = 100,
): Promise<ChatMessage[]> {
  let query = supabase.from('chat_mensajes')
    .select('*, profiles(*), reacciones:chat_reacciones(*, profiles(nombre))')
    .eq('grupo_id', groupId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  const { data, error } = await query;
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
  proyecto_id?: string | null;
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
      proyecto_id: params.proyecto_id || null,
    })
    .select('*, proyecto:proyectos(id, desarrollo, villa)')
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
    proyecto_id?: string | null;
  }
): Promise<void> {
  const payload: any = {};
  if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim();
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion.trim();
  if (updates.solo_multimedia !== undefined) payload.solo_multimedia = updates.solo_multimedia;
  if (updates.proyecto_id !== undefined) payload.proyecto_id = updates.proyecto_id || null;

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
  mediaMeta?: ChatMessage['media_meta'];
  reply_to_id?: string | null;
}): Promise<ChatMessage> {
  let media_url: string | null = null;
  let media_thumbnail_url: string | undefined;

  if (params.mediaUri && ['imagen', 'video', 'archivo', 'audio'].includes(params.tipo)) {
    const contentType = params.mediaMeta?.mimeType || (params.tipo === 'video' ? 'video/mp4' : params.tipo === 'audio' ? 'audio/mp4' : params.tipo === 'imagen' ? 'image/jpeg' : 'application/octet-stream');
    media_url = await uploadChatMedia(params.mediaUri, 'messages', contentType, params.mediaMeta?.fileName);
  } else if (params.tipo === 'sticker' && params.mediaUri) {
    media_url = params.mediaUri;
  }

  if (params.tipo === 'video' && params.mediaUri) {
    let poster: string | undefined;
    try {
      const { createChatVideoPoster } = await import('./chatVideoPoster');
      poster = await createChatVideoPoster(params.mediaUri);
      media_thumbnail_url = await uploadChatMedia(poster, 'messages', 'image/jpeg', 'poster.jpg');
    } catch {
      console.warn('No se pudo crear la miniatura del video.');
    } finally {
      if (poster) {
        try { const { File } = await import('expo-file-system'); new File(poster).delete(); } catch { /* Best-effort cache cleanup. */ }
      }
    }
  }

  const { data, error } = await supabase
    .from('chat_mensajes')
    .insert({
      grupo_id: params.grupo_id,
      remitente_id: params.remitente_id,
      tipo: params.tipo,
      contenido: params.contenido || null,
      media_url,
      ...(media_thumbnail_url ? { media_thumbnail_url } : {}),
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

export interface ChatGroupTaskActivityItem {
  id: number;
  request_id: string;
  actor_name: string;
  tarea_id: string;
  tarea_titulo: string;
  subtarea_id: string | null;
  subtarea_titulo: string | null;
  accion: 'estado' | 'subtarea';
  anterior: string | null;
  siguiente: string;
  estado_registrado: string;
  comentario: string | null;
  evidencia_path: string | null;
  evidence_url?: string | null;
  captured_at: string;
  accepted_at: string;
}

/**
 * Obtener avances y tareas realizadas de la villa vinculada al grupo
 */
export async function getChatGroupTaskActivity(
  groupId: string,
  limit = 20,
  offset = 0
): Promise<ChatGroupTaskActivityItem[]> {
  const { data, error } = await supabase.rpc('get_chat_group_task_activity', {
    p_group_id: groupId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('Error fetching chat group task activity:', error);
    throw error;
  }

  const items = (data || []) as ChatGroupTaskActivityItem[];
  return Promise.all(
    items.map(async (item) => {
      if (!item.evidencia_path) return { ...item, evidence_url: null };
      try {
        const signed = await supabase.storage
          .from('task-evidence')
          .createSignedUrl(item.evidencia_path, 3600);
        return {
          ...item,
          evidence_url: signed.error ? null : signed.data.signedUrl,
        };
      } catch {
        return { ...item, evidence_url: null };
      }
    })
  );
}
