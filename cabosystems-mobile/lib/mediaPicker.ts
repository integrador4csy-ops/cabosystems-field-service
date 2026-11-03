import { translateCurrent } from './localization';
import { Alert } from 'react-native';

let imagePickerModule: any = undefined;
let documentPickerModule: any = undefined;

function getImagePicker() {
  if (imagePickerModule !== undefined) return imagePickerModule;
  try {
    const mod = require('expo-image-picker');
    imagePickerModule = mod;
  } catch (e) {
    console.warn('[mediaPicker] expo-image-picker native module is not installed in this binary build.');
    imagePickerModule = null;
  }
  return imagePickerModule;
}

function getDocumentPicker() {
  if (documentPickerModule !== undefined) return documentPickerModule;
  try {
    const mod = require('expo-document-picker');
    documentPickerModule = mod;
  } catch (e) {
    console.warn('[mediaPicker] expo-document-picker native module is not installed in this binary build.');
    documentPickerModule = null;
  }
  return documentPickerModule;
}

export function isImagePickerAvailable(): boolean {
  return !!getImagePicker();
}

export function isDocumentPickerAvailable(): boolean {
  return !!getDocumentPicker();
}

export interface MediaAssetResult {
  uri: string;
  type: 'imagen' | 'video';
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
}

/**
 * Normaliza la duración de video a segundos
 */
function normalizeDuration(duration?: number | null): number | undefined {
  if (duration == null || isNaN(duration) || duration <= 0) return undefined;
  // Expo ImagePicker reporta ms en versiones modernas si duration > 1000
  return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration);
}

/**
 * Abre la cámara para grabar video de manera segura
 */
export async function captureVideoSafe(options?: {
  maxDuration?: number;
  quality?: number;
}): Promise<MediaAssetResult | null> {
  const picker = getImagePicker();
  if (!picker) {
    Alert.alert(
      translateCurrent("Módulo Nativo Requerido"),
      translateCurrent("La captura de video requiere compilar una nueva versión de desarrollo para incluir las dependencias nativas."),
      [{ text: translateCurrent("Entendido") }]
    );
    return null;
  }

  try {
    const { status } = await picker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(translateCurrent("Permiso requerido"), translateCurrent("Se requiere acceso a la cámara para grabar videos."));
      return null;
    }

    if (typeof picker.requestMicrophonePermissionsAsync === 'function') {
      try {
        await picker.requestMicrophonePermissionsAsync();
      } catch {
        // Ignorar si el entorno no lo expone por separado
      }
    }

    const result = await picker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: options?.maxDuration ?? 120,
      quality: options?.quality ?? 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const duration = normalizeDuration(asset.duration);
      const fileName = asset.fileName || `video_${Date.now()}.mp4`;
      return {
        uri: asset.uri,
        type: 'video',
        duration,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        fileName,
        mimeType: asset.mimeType || 'video/mp4',
      };
    }
    return null;
  } catch (err) {
    console.error('Error in captureVideoSafe:', err);
    Alert.alert(translateCurrent("Error"), translateCurrent("No se pudo activar la cámara para video."));
    return null;
  }
}

/**
 * Selecciona una foto o video de la galería con metadatos completos
 */
export async function pickMediaSafe(options?: {
  mediaTypes?: 'images' | 'videos' | 'all';
  quality?: number;
}): Promise<MediaAssetResult | null> {
  const picker = getImagePicker();
  if (!picker) {
    Alert.alert(
      translateCurrent("Módulo Nativo Requerido"),
      translateCurrent("La selección multimedia requiere compilar una nueva versión de desarrollo para incluir las dependencias nativas."),
      [{ text: translateCurrent("Entendido") }]
    );
    return null;
  }

  try {
    const { status } = await picker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(translateCurrent("Permiso requerido"), translateCurrent("Se requiere acceso a la galería para seleccionar archivos multimedia."));
      return null;
    }

    let mediaTypesParam: any = ['images', 'videos'];
    if (options?.mediaTypes === 'images') mediaTypesParam = ['images'];
    else if (options?.mediaTypes === 'videos') mediaTypesParam = ['videos'];

    const result = await picker.launchImageLibraryAsync({
      mediaTypes: mediaTypesParam,
      quality: options?.quality ?? 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const isVideo =
        asset.type === 'video' ||
        /\.(mp4|mov|m4v|3gp|webm)(?:\?|$)/i.test(asset.uri) ||
        Boolean(asset.mimeType?.startsWith('video/'));
      const duration = isVideo ? normalizeDuration(asset.duration) : undefined;
      const fileName =
        asset.fileName || (isVideo ? `video_${Date.now()}.mp4` : `imagen_${Date.now()}.jpg`);
      return {
        uri: asset.uri,
        type: isVideo ? 'video' : 'imagen',
        duration,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        fileName,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      };
    }
    return null;
  } catch (err) {
    console.error('Error in pickMediaSafe:', err);
    Alert.alert(translateCurrent("Error"), translateCurrent("No se pudo abrir la galería multimedia."));
    return null;
  }
}

/**
 * Abre la galería para seleccionar una imagen de manera segura
 */
export async function pickImageSafe(options?: {
  mediaTypes?: 'images' | 'videos' | 'all';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<string | null> {
  const picker = getImagePicker();
  if (!picker) {
    Alert.alert(
      translateCurrent("Módulo Nativo Requerido"),
      translateCurrent("La selección de imágenes requiere compilar una nueva versión de desarrollo (eas build / npx expo run:android) para incluir las librerías nativas de cámara y galería."),
      [{ text: translateCurrent("Entendido") }]
    );
    return null;
  }

  try {
    const { status } = await picker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(translateCurrent("Permiso requerido"), translateCurrent("Se requiere acceso a la galería para seleccionar imágenes."));
      return null;
    }

    let mediaTypesParam: any = ['images'];
    if (options?.mediaTypes === 'videos') {
      mediaTypesParam = ['videos'];
    } else if (options?.mediaTypes === 'all') {
      mediaTypesParam = ['images', 'videos'];
    }

    const result = await picker.launchImageLibraryAsync({
      mediaTypes: mediaTypesParam,
      allowsEditing: options?.allowsEditing ?? false,
      aspect: options?.aspect,
      quality: options?.quality ?? 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (err) {
    console.error('Error in pickImageSafe:', err);
    Alert.alert(translateCurrent("Error"), translateCurrent("No se pudo abrir la galería en este dispositivo."));
    return null;
  }
}

/**
 * Abre la cámara para capturar foto de manera segura
 */
export async function captureImageSafe(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<string | null> {
  const picker = getImagePicker();
  if (!picker) {
    Alert.alert(
      translateCurrent("Módulo Nativo Requerido"),
      translateCurrent("La captura de fotos con ImagePicker requiere compilar una nueva versión de desarrollo para incluir las dependencias nativas."),
      [{ text: translateCurrent("Entendido") }]
    );
    return null;
  }

  try {
    const { status } = await picker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(translateCurrent("Permiso requerido"), translateCurrent("Se requiere acceso a la cámara para tomar fotos."));
      return null;
    }

    const result = await picker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: options?.allowsEditing ?? false,
      aspect: options?.aspect,
      quality: options?.quality ?? 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (err) {
    console.error('Error in captureImageSafe:', err);
    Alert.alert(translateCurrent("Error"), translateCurrent("No se pudo activar la cámara."));
    return null;
  }
}

/**
 * Selector seguro de documentos (ej. Stickers WebP)
 */
export async function pickDocumentSafe(options?: {
  type?: string[];
}): Promise<{ uri: string; name: string; mimeType?: string; size?: number } | null> {
  const docPicker = getDocumentPicker();
  if (!docPicker) {
    Alert.alert(
      translateCurrent("Módulo Nativo Requerido"),
      translateCurrent("La importación de archivos requiere compilar una nueva versión de desarrollo."),
      [{ text: translateCurrent("Entendido") }]
    );
    return null;
  }

  try {
    const result = await docPicker.getDocumentAsync({
      type: options?.type || ['image/webp', 'image/png'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const file = result.assets[0];
    return { uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size };
  } catch (err) {
    console.error('Error in pickDocumentSafe:', err);
    return null;
  }
}
