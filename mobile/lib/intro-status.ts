import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Een eenmaal getoonde of afgesloten intro geldt op dit toestel blijvend als gezien,
 * per account + organisatie (een tweede gebruiker op hetzelfde toestel krijgt hem
 * wel). Dit staat in AsyncStorage, zodat een vertraagde of mislukte outbox-
 * verzending van `appVoorkeuren:markeerIntro` de intro niet terugbrengt.
 */
export const introScope = (orgId: string | null | undefined, userId: string | null | undefined) => orgId && userId ? `${orgId}:${userId}` : null;
const opslagSleutel = (scope: string) => `toptuinen:intro-gezien:v1:${scope}`;

/** scope → true (gezien) / false (gelezen, niet gezien); ontbreekt = nog niet gelezen. */
const status = new Map<string, boolean>();
const bezig = new Set<string>();
const luisteraars = new Set<() => void>();
const informeer = () => luisteraars.forEach(fn => fn());

function laad(scope: string) {
  if (status.has(scope) || bezig.has(scope)) return;
  bezig.add(scope);
  void AsyncStorage.getItem(opslagSleutel(scope))
    .then(waarde => { if (!status.has(scope)) status.set(scope, waarde !== null); })
    // Onleesbare opslag: liever de intro één keer te veel dan een vastgelopen app.
    .catch(() => { if (!status.has(scope)) status.set(scope, false); })
    .finally(() => { bezig.delete(scope); informeer(); });
}

export async function bevestigIntroLokaal(scope: string | null): Promise<void> {
  if (!scope) return;
  status.set(scope, true);
  informeer();
  await AsyncStorage.setItem(opslagSleutel(scope), String(Date.now())).catch(() => undefined);
}

/** `undefined` zolang de opslag nog gelezen wordt. */
export function useIntroLokaalGezien(scope: string | null): boolean | undefined {
  useEffect(() => { if (scope) laad(scope); }, [scope]);
  return useSyncExternalStore(
    fn => { luisteraars.add(fn); return () => { luisteraars.delete(fn); }; },
    () => (scope ? status.get(scope) : undefined),
  );
}

/**
 * Beslisregel voor de redirect naar de intro. Alleen tonen als álles bekend is en
 * nergens blijkt dat deze gebruiker hem al zag: niet op de server (rij of eerdere
 * activiteit), niet in de wachtrij en niet lokaal op dit toestel.
 */
export function moetIntroTonen(opties: {
  /** `getIntro().gezien`, live of uit de cache; undefined = nog onbekend. */
  serverGezien: boolean | undefined;
  /** Er staat een intro-markering in de wachtrij die nog verstuurd wordt. */
  inWachtrij: boolean;
  /** Lokale blijvende bevestiging; undefined = nog niet gelezen. */
  lokaalGezien: boolean | undefined;
}): boolean {
  return opties.serverGezien === false && !opties.inWachtrij && opties.lokaalGezien === false;
}
