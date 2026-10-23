import { Activity, Suspense, useEffect, useState, type ReactNode } from 'react';

/** Retain a visited view's state while React pauses its hidden effects. */
export function RetainedView({ active, fallback, children }: { active: boolean; fallback: ReactNode; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  return <Activity mode={active ? 'visible' : 'hidden'}>
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  </Activity>;
}
