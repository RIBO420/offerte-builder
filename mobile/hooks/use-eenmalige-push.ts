import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/** Gedeeld over alle schermen: ook twee verschillende rijen snel na elkaar openen maar één scherm. */
let laatstePush = 0;
const VENSTER_MS = 700;

/**
 * `router.push` voor tikken op rijen en knoppen: een dubbele tik (of twee rijen
 * vlak na elkaar) zet geen twee schermen op de stack.
 */
export function useEenmaligePush() {
  const router = useRouter();
  return useCallback((href: Href) => {
    const nu = Date.now();
    if (nu - laatstePush < VENSTER_MS) return;
    laatstePush = nu;
    router.push(href);
  }, [router]);
}
