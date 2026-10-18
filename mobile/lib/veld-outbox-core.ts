import { MAX_TIJDELIJKE_POGINGEN, backoffMs, type VeldFoutsoort } from './veld-foutsoort';

/** Eén duurzame, account- en organisatiegebonden wachtrij voor idempotente opdrachten. */
export type VeldOpdrachtType = 'dagvoorstel' | 'retour' | 'afronding' | 'delegatie' | 'foto' | 'afvoer' | 'segmentToevoegen' | 'segmentWijzigen' | 'intro';
export interface VeldOpdracht {
  id: string;
  type: VeldOpdrachtType;
  payload: Record<string, unknown>;
  status: 'wacht' | 'conflict';
  aangemaaktOp: number;
  /** Alleen bij `conflict`: de server weigerde inhoudelijk. */
  fout?: string;
  /** Tijdelijke serverfouten: blijft `wacht`, opnieuw na `volgendePogingOp`. */
  pogingen?: number;
  volgendePogingOp?: number;
  laatsteFout?: string;
}
export interface OutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export function outboxSleutel(orgId: string, userId: string): string {
  if (!orgId || !userId) throw new Error('Log in bij een organisatie om wijzigingen te bewaren.');
  return `toptuinen:veld-outbox:v1:${encodeURIComponent(orgId)}:${encodeURIComponent(userId)}`;
}

export class VeldOutbox {
  private keten: Promise<unknown> = Promise.resolve();
  private verwerking: Promise<void> | null = null;
  constructor(private storage: OutboxStorage, private key: string) {}

  private async exclusief<T>(actie: () => Promise<T>): Promise<T> {
    const volgende = this.keten.then(actie, actie);
    this.keten = volgende.catch(() => undefined);
    return volgende;
  }

  async lees(): Promise<VeldOpdracht[]> {
    const tekst = await this.storage.getItem(this.key);
    if (!tekst) return [];
    const rijen: unknown = JSON.parse(tekst);
    if (!Array.isArray(rijen) || rijen.some(r => !r || typeof r.id !== 'string' || !r.payload || !['wacht', 'conflict'].includes(r.status))) {
      throw new Error('De lokale wachtrij kan niet worden gelezen. Wis de appgegevens niet; neem contact op met kantoor.');
    }
    return rijen as VeldOpdracht[];
  }

  async voegToe(opdracht: VeldOpdracht): Promise<void> {
    await this.exclusief(async () => {
      const rijen = await this.lees();
      const bestaat = rijen.find(r => r.id === opdracht.id);
      if (bestaat) {
        if (JSON.stringify(bestaat.payload) !== JSON.stringify(opdracht.payload) || bestaat.type !== opdracht.type) throw new Error('Deze opdracht is al bewaard met andere gegevens.');
        return;
      }
      await this.storage.setItem(this.key, JSON.stringify([...rijen, opdracht]));
    });
  }

  async verwijder(id: string): Promise<void> {
    await this.exclusief(async () => this.storage.setItem(this.key, JSON.stringify((await this.lees()).filter(r => r.id !== id))));
  }

  /** Expliciete retry behoudt payload, foto en idempotentiesleutel. */
  async probeerOpnieuw(id: string): Promise<void> {
    await this.exclusief(async () => {
      const rijen = await this.lees();
      await this.storage.setItem(this.key, JSON.stringify(rijen.map(r => {
        if (r.id !== id) return r;
        const { fout: _fout, pogingen: _p, volgendePogingOp: _v, laatsteFout: _l, ...bewaard } = r;
        return { ...bewaard, status: 'wacht' };
      })));
    });
  }

  private async patch(id: string, wijziging: (r: VeldOpdracht) => VeldOpdracht): Promise<void> {
    await this.exclusief(async () => {
      const actueel = await this.lees();
      await this.storage.setItem(this.key, JSON.stringify(actueel.map(r => r.id === id ? wijziging(r) : r)));
    });
  }

  /**
   * Verwerkt in volgorde. Een netwerk- of tijdelijke serverfout stopt de ronde (de
   * rest zou net zo falen en de volgorde blijft zo bewaard). Een conflict blokkeert
   * de rest niet: die rij wacht op de gebruiker, de volgende opdrachten gaan door.
   */
  async verwerk(opties: {
    online: () => boolean;
    juisteSessie: () => boolean;
    uitvoeren: (opdracht: VeldOpdracht) => Promise<unknown>;
    classificeer: (fout: unknown) => VeldFoutsoort;
    /** Handmatig synchroniseren wacht niet op de backoff. */
    negeerBackoff?: boolean;
    /** Opdrachten die bij een conflict beter vervallen dan blijven hangen. */
    vervaltBijConflict?: (opdracht: VeldOpdracht) => boolean;
    nu?: () => number;
  }): Promise<void> {
    if (this.verwerking) return this.verwerking;
    const nu = opties.nu ?? Date.now;
    const verwerken = async () => {
      while (opties.online() && opties.juisteSessie()) {
        const rijen = await this.lees();
        const volgende = rijen.find(r => r.status === 'wacht');
        if (!volgende) return;
        if (!opties.negeerBackoff && (volgende.volgendePogingOp ?? 0) > nu()) return;
        try {
          await opties.uitvoeren(volgende);
          // Een wissel tijdens verzending mag nooit de nieuwe sessie muteren.
          if (!opties.juisteSessie()) return;
          await this.verwijder(volgende.id);
        } catch (fout) {
          if (!opties.juisteSessie()) return;
          const soort = opties.classificeer(fout);
          if (soort === 'netwerk') return;
          const bericht = fout instanceof Error && fout.message ? fout.message : 'Kantoor heeft deze registratie gewijzigd. Controleer je invoer.';
          const pogingen = (volgende.pogingen ?? 0) + 1;
          if (soort === 'tijdelijk' && pogingen < MAX_TIJDELIJKE_POGINGEN) {
            await this.patch(volgende.id, r => ({ ...r, pogingen, volgendePogingOp: nu() + backoffMs(pogingen), laatsteFout: bericht.slice(0, 200) }));
            return;
          }
          // Conflict, of tijdelijk maar te vaak: vanaf nu beslist de gebruiker.
          if (opties.vervaltBijConflict?.(volgende)) { await this.verwijder(volgende.id); continue; }
          const melding = soort === 'tijdelijk' ? `De server reageerde ${pogingen} keer niet goed. Probeer het later opnieuw of neem contact op met kantoor.` : bericht;
          await this.patch(volgende.id, r => {
            const { volgendePogingOp: _v, laatsteFout: _l, ...rest } = r;
            return { ...rest, status: 'conflict', fout: melding };
          });
        }
      }
    };
    this.verwerking = verwerken().finally(() => { this.verwerking = null; });
    return this.verwerking;
  }
}
