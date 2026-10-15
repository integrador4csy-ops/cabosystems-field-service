import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getMyStickers } from './chatApi';
import { createStickerLibraryCache } from './stickerLibraryCache';
import { warmStickerImages } from './chatMediaWarmup';

const key = (userId: string) => `csy-stickers-v1-${encodeURIComponent(userId)}`;
export const stickerLibrary = createStickerLibraryCache({
  async read(userId) {
    if (Platform.OS === 'web') return localStorage.getItem(key(userId));
    if (!FileSystem.documentDirectory) return null;
    const path = `${FileSystem.documentDirectory}${key(userId)}.json`;
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && !info.isDirectory && info.size < 2_000_000 ? FileSystem.readAsStringAsync(path) : null;
  },
  async write(userId, value) {
    if (Platform.OS === 'web') localStorage.setItem(key(userId), value);
    else if (FileSystem.documentDirectory) await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${key(userId)}.json`, value);
  },
  fetch: getMyStickers,
  warm: warmStickerImages,
});

export function useStickerLibrary(userId: string) {
  const subscribe = useCallback((listener: () => void) => stickerLibrary.subscribe(userId, listener), [userId]);
  const snapshot = useCallback(() => stickerLibrary.snapshot(userId), [userId]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void stickerLibrary.prepare(userId); }, [userId]);
  return state;
}
