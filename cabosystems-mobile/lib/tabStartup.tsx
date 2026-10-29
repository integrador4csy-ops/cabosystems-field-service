import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const Context = createContext({ mainReady: true, markMainReady: () => {} });

/** Mounted with an account key so one session cannot unlock another's warmup. */
export function TabStartupProvider({ children }: { children: React.ReactNode }) {
  const [mainReady, setMainReady] = useState(false);
  const markMainReady = useCallback(() => setMainReady(true), []);
  const value = useMemo(() => ({ mainReady, markMainReady }), [mainReady, markMainReady]);
  return <Context value={value}>{children}</Context>;
}

export const useTabStartup = () => useContext(Context);
