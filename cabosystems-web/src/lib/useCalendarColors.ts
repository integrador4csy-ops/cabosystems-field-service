import { useCallback, useEffect, useRef, useState } from 'react';
import { getCalendarColors, saveCalendarColor, type CalendarColors } from './calendarColorPreferences';

export function useCalendarColors(owner: string) {
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const version = useRef(0);
  const inFlight = useRef<{ owner: string; promise: Promise<void> } | undefined>(undefined);
  const [snapshot, setSnapshot] = useState({ owner: '', colors: {} as CalendarColors, loading: true, failed: false });
  const reload = useCallback((): Promise<void> => {
    if (inFlight.current?.owner === owner) return inFlight.current.promise;
    const request = ++version.current;
    setSnapshot(previous => ({ owner, colors: previous.owner === owner ? previous.colors : {}, loading: true, failed: false }));
    const promise = getCalendarColors(owner).then(colors => {
      if (version.current === request && ownerRef.current === owner) setSnapshot({ owner, colors, loading: false, failed: false });
    }).catch(() => {
      if (version.current === request && ownerRef.current === owner) setSnapshot(previous => ({ ...previous, owner, loading: false, failed: true }));
    }).finally(() => { if (inFlight.current?.promise === promise) inFlight.current = undefined; });
    inFlight.current = { owner, promise };
    return promise;
  }, [owner]);
  useEffect(() => {
    void reload();
    return () => { version.current++; inFlight.current = undefined; };
  }, [reload]);
  const save = useCallback(async (calendarId: string, color: string | null) => {
    await saveCalendarColor(owner, calendarId, color);
    if (ownerRef.current !== owner) throw new Error('La sesión cambió. Vuelve a abrir el selector de color.');
    version.current++;
    setSnapshot(previous => {
      const colors = { ...(previous.owner === owner ? previous.colors : {}) };
      if (color === null) delete colors[calendarId];
      else Object.defineProperty(colors, calendarId, { value: color.toLowerCase(), enumerable: true, configurable: true, writable: true });
      return { owner, colors, loading: false, failed: false };
    });
  }, [owner]);
  return { colors: snapshot.owner === owner ? snapshot.colors : {}, loading: snapshot.owner !== owner || snapshot.loading, failed: snapshot.owner === owner && snapshot.failed, reload, save };
}

