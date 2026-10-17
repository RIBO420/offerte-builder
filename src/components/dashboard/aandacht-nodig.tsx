"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";

interface AandachtNodigProps {
  acceptedWithoutProject: Array<{
    _id: string;
    offerteNummer: string;
    klantNaam: string;
  }>;
  warnings: Array<{
    id: string;
    type: string;
    prioriteit: "hoog" | "middel" | "laag";
    titel: string;
    beschrijving: string;
    actie?: string;
  }>;
}

/**
 * Zonder eigen lijstpagina: elk signaal wijst naar het scherm waar je het
 * oplost. Dit is navigatie, geen data — de waarschuwingen zelf dragen geen link.
 */
const BESTEMMING: Record<string, string> = {
  conflict: "/planning",
  deadline: "/planning",
  materieel: "/wagenpark",
  keuring: "/wagenpark",
  financieel: "/facturen",
};

/**
 * Kleur zegt "hoog", tekst zegt het ook. Alleen `hoog` krijgt het warme accent;
 * middel en laag blijven gedempt, anders is prioriteit weer betekenisloos.
 */
const PRIORITEIT_STIP: Record<string, string> = {
  hoog: "bg-accent-warm",
  middel: "bg-muted-foreground/55",
  laag: "bg-muted-foreground/30",
};

const STANDAARD_ZICHTBAAR = 4;

/**
 * Eén regel in de werkstrook: stip · titel met toelichting eronder · actie.
 *
 * Dashboard A: twee regels per signaal. In de werkkolom is de breedte er, en
 * "wie" (de titel) leest pas snel als hij niet om ruimte hoeft te vechten met
 * "wat" (de toelichting) op dezelfde regel.
 */
function Regel({
  prioriteit,
  titel,
  toelichting,
  toelichtingTitel,
  actie,
}: {
  prioriteit: "hoog" | "middel" | "laag";
  titel: string;
  toelichting: React.ReactNode;
  /** Platte tekst van de toelichting voor `title` (afgeknipte regels). */
  toelichtingTitel: string;
  actie: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={`size-2 shrink-0 rounded-full ${PRIORITEIT_STIP[prioriteit] ?? PRIORITEIT_STIP.laag}`}
        aria-hidden="true"
      />
      <span className="sr-only">Prioriteit {prioriteit}. </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-5 font-semibold @[30rem]/sectie:truncate" title={titel}>
          {titel}
        </p>
        <p
          className="min-w-0 truncate text-xs leading-4 text-muted-foreground"
          title={toelichtingTitel}
        >
          {toelichting}
        </p>
      </div>
      <div className="shrink-0">{actie}</div>
    </li>
  );
}

/**
 * "Aandacht nodig" is het zwaarste blok van de dagstaat: het amberen
 * werkvlak `--surface-aandacht` (1,23:1 op de achtergrond, tekst ≥ 4,17:1)
 * met een rand die naar terracotta trekt, bovenaan de werkkolom. Alles
 * daaronder is bewust stiller.
 *
 * De twee blokken van de werkstrook delen niet langer één tint: attentie is
 * leem/amber, eigen werk is loofgroen (`--surface-primair`, "Mijn taken"
 * ernaast). De kleur zegt daarmee wélk soort werk het is, niet alleen dát het
 * werk is.
 *
 * Leeg rendert dit blok géén `null` maar één regel: in een bento is een gat
 * erger dan een lege regel, en "niets vraagt je aandacht" is een bericht dat
 * je wilt lezen.
 */
export function AandachtNodig({
  acceptedWithoutProject,
  warnings,
}: AandachtNodigProps) {
  const [toonAlles, setToonAlles] = useState(false);
  const totaal = acceptedWithoutProject.length + warnings.length;

  if (totaal === 0) {
    return (
      <SectiePaneel
        titel="Aandacht nodig"
        icoon={<AlertTriangle className="text-muted-foreground" />}
        gewicht="primair"
        className="bg-surface-aandacht"
        legeRegel={{
          tekst: "Niets vraagt je aandacht",
          hint: "Conflicten, vervallen facturen en getekende offertes zonder project komen hier binnen.",
        }}
      />
    );
  }

  // Getekende offertes zonder project staan altijd bovenaan: dat is het enige
  // signaal met een knop, en het kost geld zolang het blijft staan.
  const regels = [
    ...acceptedWithoutProject.map((offerte) => ({
      sleutel: `offerte-${offerte._id}`,
      prioriteit: "hoog" as const,
      titel: offerte.klantNaam,
      toelichting: (
        <>
          <span className="font-mono">{offerte.offerteNummer}</span> · getekend, nog geen
          project
        </>
      ),
      toelichtingTitel: `${offerte.offerteNummer} · getekend, nog geen project`,
      // Omlijnd, niet gevuld: per scherm is er één gevulde hoofdknop (Nieuwe
      // offerte). Vier gevulde knoppen onder elkaar lazen als vier keer "dit
      // eerst" — de Eén-Hoofdknop-regel uit DESIGN.md.
      actie: (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 rounded-md border-primary/45 bg-transparent px-3 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>Start project</Link>
        </Button>
      ),
    })),
    ...warnings.map((warning) => ({
      sleutel: `waarschuwing-${warning.id}`,
      prioriteit: warning.prioriteit,
      titel: warning.titel,
      toelichting: warning.beschrijving,
      toelichtingTitel: warning.beschrijving,
      actie: (
        <Link
          href={BESTEMMING[warning.type] ?? "/meldingen"}
          className="inline-flex min-h-6 items-center whitespace-nowrap text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={warning.actie}
        >
          {/* Het advies ("Herplan één van de projecten") is de mooiste link,
              maar hij at op een telefoon de halve regel op. Daar valt hij terug
              op "Bekijk"; de volle tekst blijft in `title` staan. */}
          <span className="hidden @[30rem]/sectie:inline">
            {warning.actie ?? "Bekijk"}
          </span>
          <span className="@[30rem]/sectie:hidden">Bekijk</span>
          &nbsp;&rarr;
        </Link>
      ),
    })),
  ];

  const zichtbaar = toonAlles ? regels : regels.slice(0, STANDAARD_ZICHTBAAR);
  const rest = regels.length - zichtbaar.length;

  return (
    <SectiePaneel
      titel="Aandacht nodig"
      icoon={<AlertTriangle className="text-accent-warm" />}
      telling={totaal}
      gewicht="primair"
      className="border-[color-mix(in_oklch,var(--accent-warm)_35%,var(--border))] bg-surface-aandacht"
    >
      <ul className="divide-y divide-border/60">
        {zichtbaar.map((regel) => (
          <Regel
            key={regel.sleutel}
            prioriteit={regel.prioriteit}
            titel={regel.titel}
            toelichting={regel.toelichting}
            toelichtingTitel={regel.toelichtingTitel}
            actie={regel.actie}
          />
        ))}
      </ul>
      {/* Cappen, niet amputeren: de rest blijft één klik weg. Deze signalen
          hebben geen eigen lijstpagina, dus de doorklik vouwt hier open. */}
      {regels.length > STANDAARD_ZICHTBAAR && (
        <button
          type="button"
          onClick={() => setToonAlles((vorig) => !vorig)}
          aria-expanded={toonAlles}
          className="flex min-h-7 w-full items-center border-t px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {toonAlles ? "Minder tonen" : `Alle ${regels.length} tonen`} &rarr;
          {!toonAlles && <span className="sr-only"> (nog {rest})</span>}
        </button>
      )}
    </SectiePaneel>
  );
}
