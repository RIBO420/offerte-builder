import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { Value } from 'convex/values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { VeldOutbox, outboxSleutel, type VeldOpdracht, type VeldOpdrachtType } from '../lib/veld-outbox-core';
import { bewaarVeldFoto, ruimVeldFotoOp, uploadVeldFoto } from '../lib/veld-foto-upload';
import { controleerVeldToken } from '../lib/veld-sessie';

const FUNCTIES: Record<VeldOpdrachtType, string> = {
  dagvoorstel: 'urenSegmenten:slaDagvoorstelOp', retour: 'aanhangerRetouren:meld',
  afronding: 'werkbezoek:meldAfronding', delegatie: 'werkbezoek:delegeer', foto: 'werkbezoek:voegFotoToe',
  intro: 'appVoorkeuren:markeerIntro', afvoer: 'werkbezoek:meldAfvoer', segmentToevoegen: 'urenSegmenten:bevestigSegment', segmentWijzigen: 'urenSegmenten:updateSegment',
};
// Eén instantie per scope voorkomt races tussen twee gemounte invoercomponenten.
const instanties = new Map<string, VeldOutbox>();
const luisteraars = new Set<() => void>();
const informeer = () => luisteraars.forEach(fn => fn());

export function useVeldOpdracht() {
  const { userId, orgId, getToken } = useAuth();
  const tokenOphaler = useRef(getToken);
  useLayoutEffect(() => { tokenOphaler.current = getToken; }, [getToken]);
  const sleutel = userId && orgId ? outboxSleutel(orgId, userId) : null;
  const huidigeScope = useRef(sleutel);
  useLayoutEffect(() => { huidigeScope.current = sleutel; return () => { huidigeScope.current = null; }; }, [sleutel]);
  const online = useRef(true);
  const [wachtrij, setWachtrij] = useState<VeldOpdracht[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const outbox = useMemo(() => {
    if (!sleutel) return null;
    if (!instanties.has(sleutel)) instanties.set(sleutel, new VeldOutbox(AsyncStorage, sleutel));
    return instanties.get(sleutel)!;
  }, [sleutel]);

  const vernieuw = useCallback(async () => {
    try {
      const rijen = await outbox?.lees() ?? [];
      if (huidigeScope.current === sleutel) setWachtrij(rijen);
    } catch (e) { if (huidigeScope.current === sleutel) setFout(e instanceof Error ? e.message : 'Wachtrij lezen mislukt'); }
  }, [outbox, sleutel]);

  const synchroniseer = useCallback(async () => {
    if (!outbox || !sleutel) return;
    try {
      const voor = await outbox.lees();
      const mutation = async (naam: string, args: Record<string, unknown>) => {
        if (huidigeScope.current !== sleutel) throw new Error('Account gewijzigd');
        const token = await tokenOphaler.current({ template: 'convex' });
        if (huidigeScope.current !== sleutel) throw new Error('Account gewijzigd');
        if (!token) throw new Error('Sessie niet beschikbaar; log opnieuw in');
        controleerVeldToken(token, userId!, orgId!);
        const url = process.env.EXPO_PUBLIC_CONVEX_URL;
        if (!url) throw new Error('De server is niet ingesteld');
        // Dit verzoek houdt de oorspronkelijke identiteit vast. Een websocketretry
        // mag een oude opdracht nooit met het token van een nieuw account sturen.
        const client = new ConvexHttpClient(url, { auth: token, logger: false, fetch: async (input, options) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 20000);
          try { return await fetch(input, { ...options, signal: controller.signal }); }
          finally { clearTimeout(timer); }
        } });
        return client.mutation(makeFunctionReference<'mutation', Record<string, Value>, Value>(naam), args as Record<string, Value>);
      };
      await outbox.verwerk({
        online: () => online.current,
        juisteSessie: () => huidigeScope.current === sleutel,
        uitvoeren: opdracht => opdracht.type === 'foto' ? uploadVeldFoto(sleutel, opdracht, mutation, () => huidigeScope.current === sleutel) : mutation(FUNCTIES[opdracht.type], opdracht.type === 'intro' ? { overgeslagen: opdracht.payload.overgeslagen } : opdracht.payload),
        isNetwerkFout: e => !online.current || (e instanceof Error && /network|fetch failed|offline|connection|disconnected|aborted|sessie niet beschikbaar|upload mislukt \(5\d\d\)/i.test(e.message)),
      });
      const na = new Set((await outbox.lees()).map(r => r.id));
      for (const r of voor) if (r.type === 'foto' && !na.has(r.id)) await ruimVeldFotoOp(sleutel, r).catch(() => undefined);
      informeer();
    } catch (e) { setFout(e instanceof Error ? e.message : 'Synchroniseren mislukt'); }
    await vernieuw();
  }, [outbox, sleutel, vernieuw, userId, orgId]);

  useEffect(() => {
    huidigeScope.current = sleutel;
    // De sessieprovider remount de hele boom bij account-/organisatiewissel.
    // De initiële lege staat hoeft hier niet opnieuw gezet te worden.
    const lees = () => { void vernieuw(); };
    luisteraars.add(lees);
    queueMicrotask(lees);
    const timer = setInterval(() => { if (online.current) void synchroniseer(); }, 30000);
    const stop = NetInfo.addEventListener(state => {
      online.current = state.isConnected !== false && state.isInternetReachable !== false;
      if (online.current) void synchroniseer();
    });
    return () => { clearInterval(timer); huidigeScope.current = null; stop(); luisteraars.delete(lees); };
  }, [vernieuw, synchroniseer, sleutel]);

  const verstuur = useCallback(async (type: VeldOpdrachtType, payload: Record<string, unknown>, id = Crypto.randomUUID()) => {
    if (!outbox || !sleutel) throw new Error('Log in bij een organisatie om dit op te slaan.');
    const gegevens = { ...payload, ...(type === 'foto' && typeof payload.localUri === 'string' ? { localUri: bewaarVeldFoto(sleutel, id, payload.localUri) } : {}), [type === 'retour' ? 'idempotencyKey' : 'sleutel']: payload[type === 'retour' ? 'idempotencyKey' : 'sleutel'] ?? id };
    await outbox.voegToe({ id, type, payload: gegevens, status: 'wacht', aangemaaktOp: Date.now() });
    informeer();
    // Een wegvallende verbinding mag het formulier niet eindeloos openhouden.
    // De bewaarde opdracht blijft op de achtergrond via dezelfde queue lopen.
    await Promise.race([synchroniseer(), new Promise<void>(resolve => setTimeout(resolve, 2500))]);
    const over = (await outbox.lees()).find(r => r.id === id);
    return { id, status: over?.status ?? 'verzonden' as const, fout: over?.fout };
  }, [outbox, sleutel, synchroniseer]);

  const verwijder = useCallback(async (id: string) => {
    const opdracht = (await outbox?.lees())?.find(r => r.id === id);
    await outbox?.verwijder(id);
    if (sleutel && opdracht?.type === 'foto') await ruimVeldFotoOp(sleutel, opdracht).catch(() => undefined);
    informeer(); await synchroniseer();
  }, [outbox, sleutel, synchroniseer]);

  const probeerOpnieuw = useCallback(async (id: string) => {
    await outbox?.probeerOpnieuw(id); informeer(); await synchroniseer();
  }, [outbox, synchroniseer]);
  return { verstuur, wachtrij, fout, synchroniseer, verwijder, probeerOpnieuw };
}
