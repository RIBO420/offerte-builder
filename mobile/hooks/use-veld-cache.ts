import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Laatst bevestigde data, per account en org. Nooit een offline succes fingeren. */
export function useVeldCache<T>(naam: string, live: T | undefined) {
  const { userId, orgId } = useAuth();
  const sleutel = userId && orgId ? `toptuinen:veld-cache:v1:${orgId}:${userId}:${naam}` : null;
  const [cache, setCache] = useState<{ sleutel: string; data: T; opgeslagenOp: number } | null>(null);
  useEffect(() => {
    let actief = true;
    if (!sleutel) return;
    if (live !== undefined) {
      const waarde = { sleutel, data: live, opgeslagenOp: Date.now() };
      void AsyncStorage.setItem(sleutel, JSON.stringify(waarde)).catch(() => undefined);
      return;
    }
    void AsyncStorage.getItem(sleutel).then(tekst => {
      if (!actief || !tekst) return;
      try {
        const waarde = JSON.parse(tekst);
        if (waarde?.sleutel === sleutel && Number.isFinite(waarde.opgeslagenOp)) setCache(waarde);
      } catch { /* Een onleesbare cache vervangt geen geldige servergegevens. */ }
    });
    return () => { actief = false; };
  }, [sleutel, live]);
  const eigenCache = cache?.sleutel === sleutel ? cache : null;
  return { data: sleutel ? (live !== undefined ? live : eigenCache?.data) : undefined, uitCache: live === undefined && eigenCache !== null, opgeslagenOp: eigenCache?.opgeslagenOp ?? null };
}
