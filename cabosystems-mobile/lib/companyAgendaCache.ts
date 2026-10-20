import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { CompanyEvent } from '../types/companyAgenda';

function cacheKey(owner: string) { return `company-agenda-${owner.replace(/[^a-zA-Z0-9-]/g, '')}`; }
export async function cacheCompanyAgenda(owner: string, from: string, to: string, items: CompanyEvent[]) {
  if (!owner) return;
  try {
    const value = JSON.stringify({ owner, from, to, items });
    if (Platform.OS === 'web') { sessionStorage.setItem(cacheKey(owner), value); }
    else if (FileSystem.cacheDirectory) await FileSystem.writeAsStringAsync(`${FileSystem.cacheDirectory}${cacheKey(owner)}.json`, value);
  } catch { /* Cache failures must not turn a successful read into an error. */ }
}
export async function readCompanyAgendaCache(owner: string, from: string, to: string): Promise<CompanyEvent[] | null> {
  if (!owner) return null;
  try {
    const raw = Platform.OS === 'web' ? sessionStorage.getItem(cacheKey(owner)) : FileSystem.cacheDirectory ? await FileSystem.readAsStringAsync(`${FileSystem.cacheDirectory}${cacheKey(owner)}.json`) : null;
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved.owner === owner && saved.from === from && saved.to === to && Array.isArray(saved.items) ? saved.items : null;
  } catch { return null; }
}
