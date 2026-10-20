import { useEffect, useState } from 'react';
import { readSessionPreference, writeSessionPreference } from '../lib/sessionPreferences';

/** Keep the current tab's view when the browser reloads. Keys must stay stable. */
export function useSessionPreference<T>(key: string, fallback: T, validate: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => readSessionPreference(key, fallback, validate));
  useEffect(() => { writeSessionPreference(key, value); }, [key, value]);
  return [value, setValue] as const;
}
