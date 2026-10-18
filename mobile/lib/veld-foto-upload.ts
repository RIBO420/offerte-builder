import { Directory, File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VeldOpdracht } from './veld-outbox-core';
import { verwerkFotoUpload } from './veld-foto-proces';
import { veldFotoContentType } from './veld-foto-type';

const checkpoint = (scope: string, id: string) => `${scope}:foto:${id}`;
const map = (scope: string) => new Directory(Paths.document, 'veld-fotos', encodeURIComponent(scope));

/** Kopieer uit de tijdelijke cameramap voordat de UI opgeslagen meldt. */
export function bewaarVeldFoto(scope: string, id: string, uri: string): string {
  const bron = new File(uri);
  if (!bron.exists || !bron.size) throw new Error('De gekozen foto kan niet worden gelezen. Kies de foto opnieuw.');
  if (bron.size > 15 * 1024 * 1024) throw new Error('Deze foto is groter dan 15 MB. Kies een kleinere foto.');
  const directory = map(scope);
  directory.create({ intermediates: true, idempotent: true });
  const doel = new File(directory, `${encodeURIComponent(id)}${bron.extension || '.jpg'}`);
  if (!doel.exists) bron.copy(doel);
  return doel.uri;
}

type Mutatie = (naam: string, args: Record<string, unknown>) => Promise<unknown>;
export async function uploadVeldFoto(scope: string, opdracht: VeldOpdracht, mutation: Mutatie, juisteSessie: () => boolean) {
  const { localUri, ...gegevens } = opdracht.payload;
  // Ook reeds voorbereide uploads kunnen dezelfde duurzame metadataqueue gebruiken.
  if (typeof localUri !== 'string') return mutation('werkbezoek:voegFotoToe', gegevens);
  const checkSessie = () => { if (!juisteSessie()) throw new Error('Het account is gewijzigd. De foto blijft bij het oorspronkelijke account bewaard.'); };
  checkSessie();
  return verwerkFotoUpload({
    juisteSessie,
    leesCheckpoint: async () => { const s = await AsyncStorage.getItem(checkpoint(scope, opdracht.id)); return s ? JSON.parse(s) : null; },
    bewaarCheckpoint: waarde => AsyncStorage.setItem(checkpoint(scope, opdracht.id), JSON.stringify(waarde)),
    upload: async () => {
    const bestand = new File(localUri);
    if (!bestand.exists) throw new Error('De lokale foto ontbreekt. Kies de foto opnieuw; de melding is nog niet verzonden.');
    // Expo's native bridge vraagt een TypedArray; een losse ArrayBuffer wordt
    // door de TS-signature toegestaan maar op iOS geweigerd.
    const bytes = await bestand.bytes();
    const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
    const sha256 = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
    checkSessie();
    const ticket = await mutation('werkbezoek:uploadUrl', { werkitemId: gegevens.werkitemId, datum: gegevens.datum, sha256 }) as { url: string; ticketId: string };
    checkSessie();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    // Send the exact hashed bytes. Expo normalizes File/Blob bodies separately
    // and overwrites Content-Type with File.type, which can be octet-stream.
    try { response = await expoFetch(ticket.url, { method: 'POST', headers: { 'Content-Type': veldFotoContentType(bestand.type, bestand.extension) }, body: bytes, signal: controller.signal }); }
    finally { clearTimeout(timer); }
    if (!response.ok) throw new Error(`Foto-upload mislukt (${response.status}).`);
    const result = await response.json() as { storageId?: string };
    if (!result.storageId) throw new Error('De opslag heeft geen fotoreferentie teruggegeven.');
    return { storageId: result.storageId, ticketId: ticket.ticketId };
    },
    koppel: upload => mutation('werkbezoek:voegFotoToe', { ...gegevens, ...upload }),
  });
}

/**
 * Na een geweigerde koppeling kan het checkpoint naar een verlopen of afgewezen
 * upload wijzen; een expliciete retry moet dan opnieuw uploaden.
 */
export async function wisFotoCheckpoint(scope: string, id: string) {
  await AsyncStorage.removeItem(checkpoint(scope, id));
}

/** Alleen opruimen nadat de opdracht uit de duurzame wachtrij is verwijderd. */
export async function ruimVeldFotoOp(scope: string, opdracht: VeldOpdracht) {
  if (typeof opdracht.payload.localUri === 'string') {
    const bestand = new File(opdracht.payload.localUri);
    if (bestand.uri.startsWith(`${map(scope).uri.replace(/\/$/, '')}/`) && bestand.exists) bestand.delete();
  }
  await AsyncStorage.removeItem(checkpoint(scope, opdracht.id));
}
