export function readSessionPreference<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return validate(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionPreference(key: string, value: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

export const isNavigationItem = (value: unknown): value is string => typeof value === 'string' && ['radar', 'agenda', 'proyectos', 'directorio-proyectos', 'chat', 'colaboradores', 'invitaciones'].includes(value);
export const isStringPreference = (value: unknown): value is string => typeof value === 'string';
