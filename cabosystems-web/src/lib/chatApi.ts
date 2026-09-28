import { supabase } from './supabase';
import type {
  ChatGroup,
  ChatMember,
  ChatMessage,
  ChatMessageType,
} from '../types/chat';
import type { Profile } from '../types/fleet';

/**
 * Sube un archivo multimedia (imagen o video) desde la web al bucket de Supabase Storage
 */
export async function uploadChatMedia(
  file: File | Blob,
  folder: 'messages' | 'groups' | 'stickers' = 'messages',
  customFileName?: string
): Promise<string> {
  try {
    const ext = customFileName
      ? customFileName.split('.').pop()?.toLowerCase() || 'jpg'
      : (file instanceof File && file.name.split('.').pop()?.toLowerCase()) || 'jpg';
    
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file, {
        contentType: file.type || 'image/jpeg',
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

    if (!effectiveUserId) return [];

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
        const { count } = await supabase
          .from('chat_miembros')
          .select('*', { count: 'exact', head: true })
          .eq('grupo_id', g.id);

        const { data: lastMsg } = await supabase
          .from('chat_mensajes')
          .select('*, profiles(nombre, avatar_url, rol)')
          .eq('grupo_id', g.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...g,
          miembros_count: count ?? 1,
          ultimo_mensaje: (lastMsg as ChatMessage) || null,
          mi_rol: (roleMap.get(g.id) || (g.creado_por === effectiveUserId ? 'admin' : 'miembro')) as any,
        };
      })
    );

    // Ordenar grupos por último mensaje o creación
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
    mi_rol: (member?.rol || (group.creado_por === effectiveUserId ? 'admin' : 'miembro')) as any,
  };
}

/**
 * Obtener miembros de un grupo con su perfil completo
 */
export async function getGroupMembers(groupId: string): Promise<ChatMember[]> {
  const { data, error } = await supabase
    .from('chat_miembros')
    .select('*, profiles(*)')
    .eq('grupo_id', groupId)
    .order('rol', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatMember[];
}

/**
 * Obtener mensajes de un grupo con perfiles y reacciones
 */
export async function getGroupMessages(
  groupId: string,
  limit = 80
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_mensajes')
    .select('*, profiles(*), reacciones:chat_reacciones(*, profiles(nombre))')
    .eq('grupo_id', groupId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

/**
 * Crear un nuevo grupo (Admins & Supervisores)
 */
export async function createChatGroup(params: {
  nombre: string;
  descripcion?: string;
  fotoFile?: File | null;
  solo_multimedia: boolean;
  creatorId: string;
  memberIds: string[];
}): Promise<ChatGroup> {
  const { data: authData } = await supabase.auth.getUser();
  const effectiveCreatorId = authData?.user?.id || params.creatorId;

  let foto_url: string | null = null;
  if (params.fotoFile) {
    foto_url = await uploadChatMedia(params.fotoFile, 'groups');
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
 * Actualizar configuración de un grupo
 */
export async function updateChatGroup(
  groupId: string,
  updates: {
    nombre?: string;
    descripcion?: string;
    fotoFile?: File | null;
    solo_multimedia?: boolean;
  }
): Promise<void> {
  const payload: any = {};
  if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim();
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion.trim();
  if (updates.solo_multimedia !== undefined) payload.solo_multimedia = updates.solo_multimedia;

  if (updates.fotoFile) {
    payload.foto_url = await uploadChatMedia(updates.fotoFile, 'groups');
  }

  const { error } = await supabase
    .from('chat_grupos')
    .update(payload)
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Agregar integrantes al grupo
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
 * Expulsar integrante del grupo
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
 * Eliminar grupo por completo
 */
export async function deleteChatGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_grupos')
    .delete()
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Enviar un mensaje (Texto, Imagen o Video)
 */
export async function sendChatMessage(params: {
  grupo_id: string;
  remitente_id: string;
  tipo: ChatMessageType;
  contenido?: string | null;
  mediaFile?: File | Blob | null;
  mediaMeta?: any;
}): Promise<ChatMessage> {
  let media_url: string | null = null;

  if (params.mediaFile && (params.tipo === 'imagen' || params.tipo === 'video')) {
    media_url = await uploadChatMedia(params.mediaFile, 'messages');
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
    })
    .select('*, profiles(*)')
    .single();

  if (error) throw error;
  return data as ChatMessage;
}

/**
 * Eliminar mensaje individual (Admin o Remitente)
 */
export async function deleteChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_mensajes')
    .delete()
    .eq('id', messageId);

  if (error) throw error;
}

/**
 * Reaccionar con emoji a un mensaje
 */
export async function toggleChatReaction(
  mensaje_id: string,
  profile_id: string,
  emoji: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('chat_reacciones')
    .select('id')
    .eq('mensaje_id', mensaje_id)
    .eq('profile_id', profile_id)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('chat_reacciones').delete().eq('id', existing.id);
  } else {
    await supabase.from('chat_reacciones').insert({
      mensaje_id,
      profile_id,
      emoji,
    });
  }
}

/**
 * Obtener todos los perfiles de colaboradores disponibles
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
