'use client';

import { useEffect, useState } from 'react';
import { useGenealogyStore } from './genealogyStore';

/**
 * Returns true once the Zustand store has rehydrated from localStorage.
 * Use this to prevent SSR/hydration mismatches where the page sees an
 * empty store on the server and incorrectly redirects to onboarding.
 */
export function useHydration(): boolean {
  const storeHydrated = useGenealogyStore(s => s._hasHydrated);
  // Also track a local mount flag — localStorage is never available on the server
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted && storeHydrated;
}
