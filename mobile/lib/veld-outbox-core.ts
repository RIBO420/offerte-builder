/** Eén duurzame, account- en organisatiegebonden wachtrij voor idempotente opdrachten. */
export type VeldOpdrachtType = 'dagvoorstel' | 'retour' | 'afronding' | 'delegatie' | 'foto' | 'afvoer' | 'segmentToevoegen' | 'segmentWijzigen' | 'intro';
export interface VeldOpdracht {
  id: string;
  type: VeldOpdrachtType;
  payload: Record<string, unknown>;
  status: 'wacht' | 'conflict';
  aangemaaktOp: number;
  fout?: string;
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
        const { fout: _fout, ...bewaard } = r;
        return { ...bewaard, status: 'wacht' };
      })));
    });
  }

  async verwerk(opties: {
    online: () => boolean;
    juisteSessie: () => boolean;
    uitvoeren: (opdracht: VeldOpdracht) => Promise<unknown>;
    isNetwerkFout: (fout: unknown) => boolean;
  }): Promise<void> {
    if (this.verwerking) return this.verwerking;
    const verwerken = async () => {
      while (opties.online() && opties.juisteSessie()) {
        const rijen = await this.lees();
        const eerste = rijen[0];
        if (!eerste || eerste.status === 'conflict') return;
        try {
          await opties.uitvoeren(eerste);
          // Een wissel tijdens verzending mag nooit de nieuwe sessie muteren.
          if (!opties.juisteSessie()) return;
          await this.verwijder(eerste.id);
        } catch (fout) {
          if (!opties.juisteSessie() || opties.isNetwerkFout(fout)) return;
          const bericht = fout instanceof Error ? fout.message : 'Kantoor heeft deze registratie gewijzigd. Controleer je invoer.';
          await this.exclusief(async () => {
            const actueel = await this.lees();
            await this.storage.setItem(this.key, JSON.stringify(actueel.map(r => r.id === eerste.id ? { ...r, status: 'conflict', fout: bericht } : r)));
          });
          return;
        }
      }
    };
    this.verwerking = verwerken().finally(() => { this.verwerking = null; });
    return this.verwerking;
  }
}
