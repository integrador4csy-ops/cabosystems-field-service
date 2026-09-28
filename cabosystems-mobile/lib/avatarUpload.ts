import { supabase } from './supabase';

/**
 * Sube una imagen de perfil a Supabase Storage en el bucket 'avatars'
 * y retorna la URL pública permanente.
 */
export async function uploadAvatarImage(uri: string, userId: string): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}_${Date.now()}.${ext}`;
    const filePath = `profiles/${fileName}`;

    // Obtener los datos binarios del archivo local
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading avatar image:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error('Exception during avatar upload:', err);
    return null;
  }
}
