import { useCallback, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { Value } from 'convex/values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { VeldOutbox, outboxSleutel, type VeldOpdracht, type VeldOpdrachtType } from '../lib/veld-outbox-core';
import { bewaarVeldFoto, ruimVeldFotoOp, uploadVeldFoto, wisFotoCheckpoint } from '../lib/veld-foto-upload';
import { classificeerVeldFout } from '../lib/veld-foutsoort';
import { controleerVeldToken } from '../lib/veld-sessie';

const FUNCTIES: Record<VeldOpdrachtType, string> = {
  dagvoorstel: 'urenSegmenten:slaDagvoorstelOp', retour: 'aanhangerRetouren:meld',
  afronding: 'werkbezoek:meldAfronding', delegatie: 'werkbezoek:delegeer', foto: 'werkbezoek:voegFotoToe',
  intro: 'appVoorkeuren:markeerIntro', afvoer: 'werkbezoek:meldAfvoer', segmentToevoegen: 'urenSegmenten:bevestigSegment', segmentWijzigen: 'urenSegmenten:updateSegment',
};
type TokenOphaler = (opties: { template: string }) => Promise<string | null>;
interface Snapshot { wachtrij: VeldOpdracht[]; fout: string | null }
const LEEG: Snapshot = { wachtrij: [], fout: null };

/**
 * Eén store per account+organisatie. Alle gemounte hooks (Mijn dag heeft er ±7)
 * delen dezelfde wachtrij, één NetInfo-listener, één 30s-timer en één
 * AsyncStorage-lezing per wijziging; React leest via useSyncExternalStore.
 */
class VeldStore {
  readonly outbox: VeldOutbox;
  snapshot: Snapshot = LEEG;
  private luisteraars = new Set<() => void>();
  private gebruikers = 0;
  /** Verhoogt bij elke (her)activering: een verzoek uit een vorige mount muteert nooit. */
  private generatie = 0;
  private online = true;
  private stoppen: (() => void) | null = null;
  tokenOphaler: TokenOphaler | null = null;

  constructor(readonly sleutel: string, private orgId: string, private userId: string) {
    this.outbox = new VeldOutbox(AsyncStorage, sleutel);
  }

  abonneer = (fn: () => void) => { this.luisteraars.add(fn); return () => { this.luisteraars.delete(fn); }; };
  lees = () => this.snapshot;
  private zet(volgend: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...volgend };
    this.luisteraars.forEach(fn => fn());
  }

  activeer() {
    this.gebruikers += 1;
    if (this.gebruikers === 1) {
      this.generatie += 1;
      queueMicrotask(() => { void this.vernieuw(); });
      const timer = setInterval(() => { if (this.online) void this.synchroniseer(); }, 30000);
      const stop = NetInfo.addEventListener(state => {
        this.online = state.isConnected !== false && state.isInternetReachable !== false;
        if (this.online) void this.synchroniseer();
      });
      this.stoppen = () => { clearInterval(timer); stop(); };
    }
    return () => {
      this.gebruikers -= 1;
      if (this.gebruikers === 0) { this.generatie += 1; this.stoppen?.(); this.stoppen = null; }
    };
  }

  private sessieCheck() {
    const generatie = this.generatie;
    return () => this.gebruikers > 0 && this.generatie === generatie;
  }

  async vernieuw() {
    const juist = this.sessieCheck();
    try {
      const wachtrij = await this.outbox.lees();
      if (juist()) this.zet({ wachtrij });
    } catch (e) { if (juist()) this.zet({ fout: e instanceof Error ? e.message : 'Wachtrij lezen mislukt' }); }
  }

  async synchroniseer(opties: { handmatig?: boolean } = {}) {
    const juisteSessie = this.sessieCheck();
    if (!juisteSessie()) return;
    const { sleutel, userId, orgId } = this;
    try {
      const voor = await this.outbox.lees();
      const mutation = async (naam: string, args: Record<string, unknown>) => {
        if (!juisteSessie() || !this.tokenOphaler) throw new Error('Account gewijzigd');
        const token = await this.tokenOphaler({ template: 'convex' });
        if (!juisteSessie()) throw new Error('Account gewijzigd');
        if (!token) throw new Error('Sessie niet beschikbaar; log opnieuw in');
        controleerVeldToken(token, userId, orgId);
        const url = process.env.EXPO_PUBLIC_CONVEX_URL;
        if (!url) throw new Error('De server is niet ingesteld');
        // Bewaar de HTTP-status: ConvexHttpClient gooit bij 429/5xx een kale
        // Error(responseText), alleen 560 betekent "de functie weigerde".
        let httpStatus: number | undefined;
        // Dit verzoek houdt de oorspronkelijke identiteit vast. Een websocketretry
        // mag een oude opdracht nooit met het token van een nieuw account sturen.
        const client = new ConvexHttpClient(url, { auth: token, logger: false, fetch: async (input, options) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 20000);
          try { const response = await fetch(input, { ...options, signal: controller.signal }); httpStatus = response.status; return response; }
          finally { clearTimeout(timer); }
        } });
        try {
          return await client.mutation(makeFunctionReference<'mutation', Record<string, Value>, Value>(naam), args as Record<string, Value>);
        } catch (e) {
          if (e instanceof Error && httpStatus !== undefined && httpStatus !== 200) Object.assign(e, { httpStatus });
          throw e;
        }
      };
      await this.outbox.verwerk({
        online: () => this.online,
        juisteSessie,
        negeerBackoff: opties.handmatig,
        uitvoeren: opdracht => opdracht.type === 'foto' ? uploadVeldFoto(sleutel, opdracht, mutation, juisteSessie) : mutation(FUNCTIES[opdracht.type], opdracht.type === 'intro' ? { overgeslagen: opdracht.payload.overgeslagen } : opdracht.payload),
        classificeer: e => classificeerVeldFout(e, this.online),
        // De intro is lokaal al blijvend bevestigd; een geweigerde markering mag
        // nooit als conflict in de wachtrij blijven staan.
        vervaltBijConflict: opdracht => opdracht.type === 'intro',
      });
      if (this.snapshot.fout && juisteSessie()) this.zet({ fout: null });
      const na = new Set((await this.outbox.lees()).map(r => r.id));
      for (const r of voor) if (r.type === 'foto' && !na.has(r.id)) await ruimVeldFotoOp(sleutel, r).catch(() => undefined);
    } catch (e) { if (juisteSessie()) this.zet({ fout: e instanceof Error ? e.message : 'Synchroniseren mislukt' }); }
    await this.vernieuw();
  }
}

const stores = new Map<string, VeldStore>();
function storeVoor(orgId: string, userId: string): VeldStore {
  const sleutel = outboxSleutel(orgId, userId);
  let store = stores.get(sleutel);
  if (!store) { store = new VeldStore(sleutel, orgId, userId); stores.set(sleutel, store); }
  return store;
}
const geenAbonnement = () => () => undefined;
const leeg = () => LEEG;

export function useVeldOpdracht() {
  const { userId, orgId, getToken } = useAuth();
  const store = useMemo(() => userId && orgId ? storeVoor(orgId, userId) : null, [orgId, userId]);
  useLayoutEffect(() => { if (store) store.tokenOphaler = getToken as TokenOphaler; }, [store, getToken]);
  useEffect(() => store?.activeer(), [store]);
  const { wachtrij, fout } = useSyncExternalStore(store?.abonneer ?? geenAbonnement, store?.lees ?? leeg, store?.lees ?? leeg);

  const synchroniseer = useCallback(async () => { await store?.synchroniseer({ handmatig: true }); }, [store]);

  const verstuur = useCallback(async (type: VeldOpdrachtType, payload: Record<string, unknown>, id = Crypto.randomUUID()) => {
    if (!store) throw new Error('Log in bij een organisatie om dit op te slaan.');
    const { outbox, sleutel } = store;
    const gegevens = { ...payload, ...(type === 'foto' && typeof payload.localUri === 'string' ? { localUri: bewaarVeldFoto(sleutel, id, payload.localUri) } : {}), [type === 'retour' ? 'idempotencyKey' : 'sleutel']: payload[type === 'retour' ? 'idempotencyKey' : 'sleutel'] ?? id };
    await outbox.voegToe({ id, type, payload: gegevens, status: 'wacht', aangemaaktOp: Date.now() });
    await store.vernieuw();
    // Een wegvallende verbinding mag het formulier niet eindeloos openhouden.
    // De bewaarde opdracht blijft op de achtergrond via dezelfde queue lopen.
    await Promise.race([store.synchroniseer(), new Promise<void>(resolve => setTimeout(resolve, 2500))]);
    const over = (await outbox.lees()).find(r => r.id === id);
    return { id, status: over?.status ?? 'verzonden' as const, fout: over?.fout };
  }, [store]);

  const verwijder = useCallback(async (id: string) => {
    if (!store) return;
    const opdracht = (await store.outbox.lees()).find(r => r.id === id);
    await store.outbox.verwijder(id);
    if (opdracht?.type === 'foto') await ruimVeldFotoOp(store.sleutel, opdracht).catch(() => undefined);
    await store.vernieuw(); await store.synchroniseer();
  }, [store]);

  const probeerOpnieuw = useCallback(async (id: string) => {
    if (!store) return;
    const opdracht = (await store.outbox.lees()).find(r => r.id === id);
    // Een upload-checkpoint kan naar een afgewezen of verlopen upload wijzen.
    if (opdracht?.type === 'foto' && opdracht.status === 'conflict') await wisFotoCheckpoint(store.sleutel, opdracht.id).catch(() => undefined);
    await store.outbox.probeerOpnieuw(id); await store.vernieuw(); await store.synchroniseer({ handmatig: true });
  }, [store]);
  return { verstuur, wachtrij, fout, synchroniseer, verwijder, probeerOpnieuw };
}
