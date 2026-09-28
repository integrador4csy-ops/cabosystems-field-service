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
      'Módulo Nativo Requerido',
      'La selección de imágenes requiere compilar una nueva versión de desarrollo (eas build / npx expo run:android) para incluir las librerías nativas de cámara y galería.',
      [{ text: 'Entendido' }]
    );
    return null;
  }

  try {
    const { status } = await picker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se requiere acceso a la galería para seleccionar imágenes.');
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
    Alert.alert('Error', 'No se pudo abrir la galería en este dispositivo.');
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
      'Módulo Nativo Requerido',
      'La captura de fotos con ImagePicker requiere compilar una nueva versión de desarrollo para incluir las dependencias nativas.',
      [{ text: 'Entendido' }]
    );
    return null;
  }

  try {
    const { status } = await picker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos.');
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
    Alert.alert('Error', 'No se pudo activar la cámara.');
    return null;
  }
}

/**
 * Selector seguro de documentos (ej. Stickers WebP)
 */
export async function pickDocumentSafe(options?: {
  type?: string[];
}): Promise<{ uri: string; name: string } | null> {
  const docPicker = getDocumentPicker();
  if (!docPicker) {
    Alert.alert(
      'Módulo Nativo Requerido',
      'La importación de archivos requiere compilar una nueva versión de desarrollo.',
      [{ text: 'Entendido' }]
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
    return { uri: file.uri, name: file.name };
  } catch (err) {
    console.error('Error in pickDocumentSafe:', err);
    return null;
  }
}
