import { useEffect, useState } from 'react';

/**
 * Returns the current time and re-renders every second and whenever the tab
 * becomes visible again. This only triggers re-renders; elapsed time is always
 * derived from timestamps (SPEC rule 1), never counted.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);

  return now;
}
