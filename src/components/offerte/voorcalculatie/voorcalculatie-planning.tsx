"use client";

/**
 * De planningsrail naast het urenblad — het tegenhanger-blok van het
 * werkbank-palet, en met opzet dezelfde vorm: keuzes boven, één heldcijfer,
 * daaronder de knop die de fase afsluit.
 *
 * Wat hier gekozen wordt (ploeg, effectieve uren, namen) is het énige dat de
 * voorcalculatie toevoegt aan de offerte. De uren komen kant-en-klaar uit het
 * urenblad; deze rail vertaalt ze naar werkdagen.
 *
 * De ploeggrootte stond in een select met drie opties. Drie opties horen op
 * één rij te staan: zien is sneller dan uitklappen.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { Check, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDagen, formatUren } from "@/lib/voorcalculatie-calculator";

const PLOEGGROOTTES = [2, 3, 4] as const;

interface Medewerker {
  _id: string;
  naam: string;
  functie?: string;
}

interface VoorcalculatiePlanningProps {
  teamGrootte: 2 | 3 | 4;
  teamleden: string[];
  effectieveUrenPerDag: number;
  normUrenTotaal: number;
  geschatteDagen: number;
  leesAlleen: boolean;
  afronden: boolean;
  kanAfronden: boolean;
  onTeamGrootte: (waarde: 2 | 3 | 4) => void;
  onTeamleden: (leden: string[]) => void;
  onEffectieveUren: (uren: number) => void;
  onAfronden: () => void;
  onBekijk: () => void;
}

export function VoorcalculatiePlanning({
  teamGrootte,
  teamleden,
  effectieveUrenPerDag,
  normUrenTotaal,
  geschatteDagen,
  leesAlleen,
  afronden,
  kanAfronden,
  onTeamGrootte,
  onTeamleden,
  onEffectieveUren,
  onAfronden,
  onBekijk,
}: VoorcalculatiePlanningProps) {
  const capaciteit = teamGrootte * effectieveUrenPerDag;

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-lg border bg-card">
        <header className="flex items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
          <h2 className="shrink-0 text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
            Ploeg
          </h2>
          <p className="ml-auto text-[11px] leading-4 tabular-nums text-muted-foreground">
            {capaciteit} uur per dag samen
          </p>
        </header>

        <div className="space-y-3 px-3 py-3">
          <div className="space-y-1.5">
            <span
              id="voorcalc-ploeg-label"
              className="block text-xs leading-4 text-muted-foreground"
            >
              Hoeveel mensen gaan erop
            </span>
            <div
              role="radiogroup"
              aria-labelledby="voorcalc-ploeg-label"
              className="flex items-center gap-1"
            >
              {PLOEGGROOTTES.map((aantal) => (
                <button
                  key={aantal}
                  type="button"
                  role="radio"
                  aria-checked={teamGrootte === aantal}
                  disabled={leesAlleen}
                  onClick={() => {
                    onTeamGrootte(aantal);
                    if (teamleden.length > aantal) {
                      onTeamleden(teamleden.slice(0, aantal));
                    }
                  }}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-[13px] leading-5 tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
                    teamGrootte === aantal
                      ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {aantal}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="voorcalc-uren-per-dag" className="text-xs font-normal text-muted-foreground">
              Effectieve uren per dag
            </Label>
            <NumberInput
              id="voorcalc-uren-per-dag"
              value={effectieveUrenPerDag}
              onChange={onEffectieveUren}
              suffix="uur"
              min={4}
              max={10}
              step={0.5}
              decimals={1}
              roundToStep
              disabled={leesAlleen}
            />
            <p className="text-[11px] leading-4 text-muted-foreground">
              Zonder pauzes en reistijd. Standaard 7.
            </p>
          </div>
        </div>
      </section>

      <Teamleden
        teamGrootte={teamGrootte}
        teamleden={teamleden}
        leesAlleen={leesAlleen}
        onTeamleden={onTeamleden}
      />

      {/* Het heldcijfer. Eén Outfit-getal per pagina — hier, omdat dit het
          antwoord is waarvoor je op deze pagina komt. */}
      <section className="rounded-lg border bg-surface-primair shadow-xs">
        <div className="space-y-1.5 px-3 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
              Doorlooptijd
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatUren(normUrenTotaal)}
            </span>
          </div>

          {/* key her-mount bij waardewissel → CSS-puls; basisstaat is zichtbaar
              (fill-mode none), dus een bevroren rAF toont gewoon het getal. */}
          <p
            key={geschatteDagen}
            className="font-display text-[28px] leading-none font-semibold tracking-tight tabular-nums motion-safe:animate-in motion-safe:fade-in-25 motion-safe:duration-300"
          >
            {formatDagen(geschatteDagen)}
          </p>

          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 pt-1 text-[11px] leading-5 text-muted-foreground">
            <dt>Capaciteit</dt>
            <dd className="text-right tabular-nums">
              {teamGrootte} × {effectieveUrenPerDag} uur
            </dd>
            <dt>Met 10% weerbuffer</dt>
            <dd className="text-right tabular-nums">
              {formatDagen(Math.ceil(geschatteDagen * 1.1))}
            </dd>
          </dl>
        </div>

        {!leesAlleen && (
          <div className="mt-3 space-y-2 border-t border-border/70 p-3">
            <Button
              className="w-full"
              disabled={!kanAfronden || afronden}
              onClick={onAfronden}
            >
              {afronden ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Voorcalculatie afronden
            </Button>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Daarna staat de offerte klaar om te verzenden. Je kunt de
              planning later blijven aanpassen.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={onBekijk}
            >
              Bekijk de offerte
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Namen erbij zetten is optioneel — het blok begint dus dicht en zegt in de
 * kop al wat erin staat. De medewerkerslijst komt uit Convex; wie er niet in
 * staat kan alsnog met de hand worden toegevoegd (inval, zzp).
 */
function Teamleden({
  teamGrootte,
  teamleden,
  leesAlleen,
  onTeamleden,
}: {
  teamGrootte: number;
  teamleden: string[];
  leesAlleen: boolean;
  onTeamleden: (leden: string[]) => void;
}) {
  const [open, setOpen] = useState(teamleden.length > 0);
  const [nieuweNaam, setNieuweNaam] = useState("");
  const medewerkers = useQuery(api.medewerkers.getActive) as
    | Medewerker[]
    | undefined;

  const vol = teamleden.length >= teamGrootte;

  function wissel(naam: string) {
    if (teamleden.includes(naam)) {
      onTeamleden(teamleden.filter((lid) => lid !== naam));
    } else if (!vol) {
      onTeamleden([...teamleden, naam]);
    }
  }

  function voegToe() {
    const naam = nieuweNaam.trim();
    if (!naam || vol || teamleden.includes(naam)) return;
    onTeamleden([...teamleden, naam]);
    setNieuweNaam("");
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="shrink-0 text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
          Namen
        </span>
        <span className="min-w-0 flex-1 truncate text-xs leading-4 text-foreground">
          {teamleden.length > 0
            ? teamleden.join(", ")
            : "Nog niet ingedeeld"}
        </span>
        <span className="shrink-0 text-[11px] leading-4 tabular-nums text-muted-foreground">
          {teamleden.length}/{teamGrootte}
        </span>
      </button>

      {/* grid-template-rows: animeert zonder de layout te meten. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t px-3 py-3">
            {medewerkers === undefined ? (
              <p className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Medewerkers laden…
              </p>
            ) : medewerkers.length === 0 ? (
              <p className="text-[11px] leading-4 text-muted-foreground">
                Nog geen medewerkers vastgelegd — typ hieronder een naam.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {medewerkers.map((medewerker) => {
                  const gekozen = teamleden.includes(medewerker.naam);
                  return (
                    <button
                      key={medewerker._id}
                      type="button"
                      aria-pressed={gekozen}
                      disabled={leesAlleen || (!gekozen && vol)}
                      title={medewerker.functie}
                      onClick={() => wissel(medewerker.naam)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs leading-4 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45",
                        gekozen
                          ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {gekozen && <Check aria-hidden className="size-3 text-primary" />}
                      {medewerker.naam}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Handmatige namen krijgen een kruisje: ze staan nergens anders,
                dus ze moeten hier ook weer weg kunnen. */}
            {teamleden.some(
              (lid) => !medewerkers?.some((m) => m.naam === lid)
            ) && (
              <div className="flex flex-wrap gap-1">
                {teamleden
                  .filter((lid) => !medewerkers?.some((m) => m.naam === lid))
                  .map((lid) => (
                    <span
                      key={lid}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs leading-4"
                    >
                      {lid}
                      {!leesAlleen && (
                        <button
                          type="button"
                          aria-label={`${lid} van de ploeg halen`}
                          onClick={() =>
                            onTeamleden(teamleden.filter((n) => n !== lid))
                          }
                          className="-mr-1 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
              </div>
            )}

            {!leesAlleen && !vol && (
              <div className="flex gap-1.5">
                <Input
                  value={nieuweNaam}
                  onChange={(e) => setNieuweNaam(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      voegToe();
                    }
                  }}
                  placeholder="Andere naam"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={!nieuweNaam.trim()}
                  onClick={voegToe}
                  aria-label="Naam aan de ploeg toevoegen"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
