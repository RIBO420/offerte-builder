import { useCallback, useLayoutEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useNetInfo } from '@react-native-community/netinfo';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { Value } from 'convex/values';
import { controleerVeldToken } from '../lib/veld-sessie';

/** Definitieve acties zijn online en houden één identiteit vast tijdens verzending. */
export function useVeldServerActie() {
  const { userId, orgId, getToken } = useAuth();
  const netwerk = useNetInfo();
  const scope = `${orgId ?? ''}:${userId ?? ''}`;
  const huidig = useRef(scope);
  useLayoutEffect(() => { huidig.current = scope; return () => { huidig.current = ''; }; }, [scope]);
  const tokenOphaler = useRef(getToken);
  useLayoutEffect(() => { tokenOphaler.current = getToken; }, [getToken]);
  const online = netwerk.isConnected === true && netwerk.isInternetReachable !== false;
  const voerUit = useCallback(async (naam: string, args: Record<string, Value>) => {
    if (!userId || !orgId || !online) throw new Error('Voor deze actie is een actieve verbinding nodig.');
    const token = await tokenOphaler.current({ template: 'convex' });
    if (huidig.current !== scope || !token) throw new Error('Je sessie is gewijzigd. Open de dag opnieuw.');
    controleerVeldToken(token, userId, orgId);
    const url = process.env.EXPO_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('De server is niet ingesteld');
    const client = new ConvexHttpClient(url, { auth: token, logger: false, fetch: async (input, options) => {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
      try { return await fetch(input, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
    } });
    return client.mutation(makeFunctionReference<'mutation', Record<string, Value>, Value>(naam), args);
  }, [userId, orgId, online, scope]);
  return { online, voerUit };
}
