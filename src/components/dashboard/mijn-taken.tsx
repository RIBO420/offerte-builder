"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ListTodo } from "lucide-react";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { PersoonAvatar } from "@/components/taken/persoon-avatar";
import { TaakTags } from "@/components/taken/taak-tags";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import { DagstaatTaakComposer } from "@/components/dashboard/taak-composer";
import { showErrorToast } from "@/lib/toast-utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const STANDAARD_ZICHTBAAR = 5;

/**
 * Eén abonnement voor twee lezers: de kop van de dagstaat telt de open taken en
 * dit paneel toont ze. Convex dedupliceert op (query, args), dus dit is
 * dezelfde subscriptie — geen extra round-trip.
 */
export function useMijnTaken() {
  return useQuery(api.klantTaken.mijnTaken, { limit: 25 });
}

/**
 * "Mijn taken" op de dagstaat: de taken waar ík aan zit.
 *
 * **"Van mij" betekent sinds taakmodel v2: maker óf checker = ik** — de scope
 * hangt aan het account, niet aan een `medewerkers`-rij. Dat repareert de
 * stille v1-bug waarin kantoor en directie (die vaak geen medewerkersrij
 * hebben) hier álle openstaande taken van het bedrijf zagen onder de kop "Mijn
 * taken". Het filter zit in `klantTaken.mijnTaken`; dit paneel toont wat het
 * teruggeeft.
 *
 * Voor het echte dagwerk — slepen, herinneren, reacties — linkt de voetregel
 * door naar het werkbord `/mijn-dag`. Dit blok is de blik erop, niet de
 * werkplek.
 *
 * De eerste regel is de composer, óók zonder taken: een lijst die je alleen
 * elders kunt vullen is een dood blok.
 *
 * `verbergAlsLeeg` is de default, zodat de medewerkerpagina (een enkele kolom
 * kaarten) niet volloopt met lege dozen; de dagstaat zet hem uit, want daar is
 * een gat in het raster erger dan één lege regel.
 */
export function MijnTaken({
  verbergAlsLeeg = true,
}: {
  verbergAlsLeeg?: boolean;
} = {}) {
  const taken = useMijnTaken();
  const setStatus = useMutation(api.klantTaken.setStatus);
  const [bezigMet, setBezigMet] = useState<Id<"klantTaken"> | null>(null);
  const [toonAlles, setToonAlles] = useState(false);

  const laadt = taken === undefined;
  const lijst = taken ?? [];

  if (verbergAlsLeeg && lijst.length === 0) return null;

  const handleAfronden = async (id: Id<"klantTaken">) => {
    setBezigMet(id);
    try {
      await setStatus({ taakId: id, status: "klaar" });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij afronden taak"
      );
    } finally {
      setBezigMet(null);
    }
  };

  const zichtbaar = toonAlles ? lijst : lijst.slice(0, STANDAARD_ZICHTBAAR);
  const leeg = !laadt && lijst.length === 0;

  return (
    <SectiePaneel
      titel="Mijn taken"
      icoon={<ListTodo />}
      telling={lijst.length}
      gewicht="primair"
      uitleg="Taken waar jij aan zit: je maakt ze, of je checkt ze voor verzending. Wat je hier toevoegt komt op jouw naam en bij de gekozen klant te staan; wie het checkt kies je op de taakkaart in het klantdossier of op Mijn dag."
      acties={
        <Link
          href="/mijn-dag"
          className="rounded text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Naar Mijn dag &rarr;
        </Link>
      }
      legeRegel={
        leeg
          ? { tekst: "Nog geen taken", hint: "— voeg de eerste toe." }
          : undefined
      }
    >
      <DagstaatTaakComposer metScheiding={!leeg} />

      {laadt && (
        <ul className="divide-y divide-border/60">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-2.5 px-3 py-1.5">
              <Skeleton className="size-4 shrink-0 rounded-[4px]" />
              <Skeleton className="h-3.5 w-[55%]" />
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-border/60">
        {zichtbaar.map((taak) => (
          <li key={taak._id} className="flex items-start gap-2.5 px-3 py-1.5">
            <TaakCheckbox
              wrapperClassName="mt-0.5"
              checked={false}
              disabled={bezigMet === taak._id}
              onCheckedChange={() => handleAfronden(taak._id)}
              aria-label={`Taak ${taak.titel} afronden`}
            />
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[13px] font-medium leading-5"
                title={taak.titel}
              >
                {taak.titel}
              </p>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-muted-foreground">
                <Link
                  href={`/klanten/${taak.klantId}`}
                  className="truncate hover:underline"
                >
                  {taak.klantNaam}
                </Link>
                <TaakTags taak={taak} />
              </div>
            </div>
            <span className="mt-0.5 flex shrink-0 items-center gap-1">
              <PersoonAvatar persoon={taak.maker} rol="maker" />
              <PersoonAvatar persoon={taak.checker} rol="checker" />
            </span>
          </li>
        ))}
      </ul>
      {lijst.length > STANDAARD_ZICHTBAAR && (
        <button
          type="button"
          onClick={() => setToonAlles((vorig) => !vorig)}
          aria-expanded={toonAlles}
          className="flex min-h-7 w-full items-center border-t px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {toonAlles ? "Minder tonen" : `Alle ${lijst.length} tonen`} &rarr;
        </button>
      )}
    </SectiePaneel>
  );
}
