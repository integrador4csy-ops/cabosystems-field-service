import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { SectionResources } from '../lib/sectionResources';
export { SectionResources, canSpeculate } from '../lib/sectionResources';

const Context = createContext<SectionResources | null>(null);
export function SectionResourcesProvider({ children }: { children: ReactNode }) {
  const resources = useMemo(() => new SectionResources(), []);
  useEffect(() => resources.retain(), [resources]);
  return <Context value={resources}>{children}</Context>;
}
export function useSectionResources() {
  const resources = useContext(Context);
  // Isolated component previews have their own cache, never a global private cache.
  return useMemo(() => resources ?? new SectionResources(), [resources]);
}
