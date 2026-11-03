import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const key = (userId: string) => `csy-chat-rooms-v1-${encodeURIComponent(userId)}`;
export const chatRoomStorage = {
  async read(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key(userId));
    if (!FileSystem.documentDirectory) return null;
    const path = `${FileSystem.documentDirectory}${key(userId)}.json`;
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && !info.isDirectory && info.size < 8_000_000 ? FileSystem.readAsStringAsync(path) : null;
  },
  async write(userId: string, value: string) {
    if (Platform.OS === 'web') localStorage.setItem(key(userId), value);
    else if (FileSystem.documentDirectory) await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${key(userId)}.json`, value);
  },
};
