"use client";

/**
 * "Wie is achter" (PRD §2.6) — kantoor. Twee lijsten voor één dag:
 * - achterstanden: gepland bezoek zonder enige urenlog die dag;
 * - afwijkingen: wel gelogd, maar boven de instelbare drempel
 *   (>15 min of >20% — PRD-aanname, bevestiging Mickey §7.1).
 * Dit bewaakt de volledigheid waarop de facturatie-engine (§2.8) draait:
 * wat niet gelogd is, wordt niet gefactureerd.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";

function vandaagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function schuifDag(datum: string, dagen: number): string {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + dagen);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "zo 18 okt" — korte dagnotatie voor de kop van de strook. */
function dagLabel(datum: string): string {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

export interface VerlopenPlanning {
  projectId: string;
  projectNaam: string;
  periode: string;
}

/**
 * "Let op" (planningsoverzicht A): één amber strook met wat de planning niet
 * klopt — wie op een dag niet (of afwijkend) logde, en ingeplande projecten
 * waarvan de periode voorbij is zonder dat ze gestart zijn. Vervangt de losse
 * "Wie is achter"-kaart van een halve pagina; de dagnavigatie blijft.
 *
 * Leeg = één regel, op de basislijn van het kopje.
 */
export function LetOpStrook({ verlopen }: { verlopen: VerlopenPlanning[] }) {
  const [datum, setDatum] = useState(vandaagIso());
  const data = useQuery(api.urenSegmenten.getWieIsAchter, { datum });

  const achterstanden = data?.achterstanden ?? [];
  const afwijkingen = data?.afwijkingen ?? [];
  const totaal = achterstanden.length + afwijkingen.length + verlopen.length;
  const drempel = data
    ? `>${data.drempels.minuten} min of >${data.drempels.procent}%`
    : null;

  const dagNavigatie = (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => setDatum((d) => schuifDag(d, -1))}
        aria-label="Vorige dag"
        className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums">
        {datum === vandaagIso() ? "vandaag" : dagLabel(datum)}
      </span>
      <button
        type="button"
        onClick={() => setDatum((d) => schuifDag(d, 1))}
        aria-label="Volgende dag"
        className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </span>
  );

  return (
    <SectiePaneel
      titel="Let op"
      icoon={<AlertTriangle className={totaal > 0 ? "text-accent-warm" : "text-muted-foreground"} />}
      telling={totaal}
      gewicht="primair"
      uitleg={`Urenlog per dag: gepland bezoek zonder log, of gelogd maar afwijkend${
        drempel ? ` (${drempel})` : ""
      }. Wat niet gelogd is, wordt niet gefactureerd. Daarnaast: ingeplande projecten waarvan de periode voorbij is.`}
      acties={dagNavigatie}
      className="border-[color-mix(in_oklch,var(--accent-warm)_35%,var(--border))] bg-surface-aandacht"
      legeRegel={
        data !== undefined && totaal === 0
          ? { tekst: "Alles gelogd en op schema", hint: "Niets achter of verlopen op deze dag." }
          : undefined
      }
    >
      {data === undefined && verlopen.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Laden…</p>
      ) : totaal > 0 ? (
        <ul className="divide-y divide-border/60">
          {achterstanden.map((item) => (
            <Regel
              key={`a-${item.werkitemId}`}
              titel={item.klantNaam ?? item.naam}
              toelichting={[item.teamNaam, `op ${dagLabel(datum)} niets gelogd`]
                .filter(Boolean)
                .join(" · ")}
              actie={<RegelLink href="/uren">Uren bekijken</RegelLink>}
            />
          ))}
          {afwijkingen.map((item) => (
            <Regel
              key={`w-${item.werkitemId}`}
              titel={item.klantNaam ?? item.naam}
              toelichting={[
                item.teamNaam,
                `${item.gelogdeMinuten} van ${item.geplandeMinuten} min gelogd (${item.verschilProcent}% verschil)`,
              ]
                .filter(Boolean)
                .join(" · ")}
              actie={<RegelLink href="/uren">Uren bekijken</RegelLink>}
            />
          ))}
          {verlopen.map((item) => (
            <Regel
              key={`v-${item.projectId}`}
              titel={item.projectNaam}
              toelichting={`stond ${item.periode}, nog niet gestart`}
              actie={<RegelLink href="/planning/weekbord">Herplannen</RegelLink>}
            />
          ))}
        </ul>
      ) : null}
    </SectiePaneel>
  );
}

function Regel({
  titel,
  toelichting,
  actie,
}: {
  titel: string;
  toelichting: string;
  actie: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="size-2 shrink-0 rounded-full bg-accent-warm" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-[13px]" title={`${titel} · ${toelichting}`}>
        <span className="font-semibold">{titel}</span>
        <span className="text-muted-foreground"> · {toelichting}</span>
      </p>
      <span className="shrink-0">{actie}</span>
    </li>
  );
}

function RegelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-6 items-center whitespace-nowrap text-xs font-medium text-primary transition-colors hover:text-primary/80"
    >
      {children}&nbsp;&rarr;
    </Link>
  );
}

/**
 * Meerwerk-beoordeling (PRD §2.6) — kantoor/planning keurt veld-verzoeken:
 * tijd erbij (cascade schuift door) of als nieuwe opdracht in de bak.
 */
export function MeerwerkBeoordeling() {
  const verzoeken = useQuery(api.meerwerk.listVoorBeoordeling, {});
  const keurGoed = useMutation(api.meerwerk.keurGoed);
  const wijsAf = useMutation(api.meerwerk.wijsAf);

  const handleBesluit = async (
    id: (typeof verzoeken extends (infer T)[] | undefined ? T : never)["_id"],
    besluit: "tijd_erbij" | "nieuwe_opdracht" | "afwijzen"
  ) => {
    try {
      if (besluit === "afwijzen") {
        await wijsAf({ id });
        toast.success("Meerwerk-verzoek afgewezen");
      } else {
        await keurGoed({ id, besluit });
        toast.success(
          besluit === "tijd_erbij"
            ? "Goedgekeurd — tijd erbij, de dagkaart-cascade schuift door"
            : "Goedgekeurd — als nieuwe opdracht in de bak gezet"
        );
      }
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Beoordelen is mislukt");
    }
  };

  if (verzoeken === undefined || verzoeken.length === 0) return null;

  return (
    <SectiePaneel
      titel="Meerwerk uit het veld"
      icoon={<AlertTriangle className="text-accent-warm" />}
      telling={verzoeken.length}
      gewicht="primair"
      uitleg="Meerwerk kan alleen ná akkoord van planning: tijd erbij (de dagkaart-cascade schuift door) of als nieuwe opdracht in de bak."
      className="bg-surface-aandacht"
    >
      <ul className="divide-y divide-border/60">
        {verzoeken.map((verzoek) => (
          <li key={verzoek._id} className="flex flex-col gap-2 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold">{verzoek.omschrijving}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                ±{verzoek.geschatteMinuten ?? 0} min · {verzoek.klantNaam ?? verzoek.werkitemNaam} ·
                aangevraagd door {verzoek.aangevraagdDoorNaam ?? "veld"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBesluit(verzoek._id, "tijd_erbij")}
              >
                Tijd erbij
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBesluit(verzoek._id, "nieuwe_opdracht")}
              >
                Nieuwe opdracht in de bak
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleBesluit(verzoek._id, "afwijzen")}
              >
                Afwijzen
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </SectiePaneel>
  );
}
