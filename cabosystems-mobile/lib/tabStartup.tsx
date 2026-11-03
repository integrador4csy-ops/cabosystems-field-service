import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const Context = createContext({ mainReady: true, markMainReady: () => {} });

/** Reset account readiness without remounting the navigator and its registry. */
export function TabStartupProvider({ children, owner = 'anonymous' }: { children: React.ReactNode; owner?: string }) {
  const [startup, setStartup] = useState({ owner, ready: false });
  if (startup.owner !== owner) setStartup({ owner, ready: false });
  const mainReady = startup.owner === owner && startup.ready;
  const markMainReady = useCallback(() => {
    setStartup(current => current.owner === owner && !current.ready ? { owner, ready: true } : current);
  }, [owner]);
  const value = useMemo(() => ({ mainReady, markMainReady }), [mainReady, markMainReady]);
  return <Context value={value}>{children}</Context>;
}

export const useTabStartup = () => useContext(Context);
