"use client";

/**
 * Lijstweergave van afspraken (PRD bijlage B, fase 2 §2.5): derde, goedkope
 * weergave op dezelfde planbord-data als weekbord en dagkaart. Mijn (voorman:
 * eigen team) / Alle, zoeken op afspraak of klant, filter op
 * ploeg/status/periode, gegroepeerd per ISO-week en sorteerbaar per kolom.
 * Geen nieuwe opslag: planbord.getBordContext + werkitems.listVoorPlanbord
 * via de bestaande adapter (klantnamen alleen als er gezocht wordt).
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { naarEvents, type PlanbordEvent } from "@/components/planbord/adapter";
import {
  aantalDagen,
  eigenTeamIds,
  filterAfspraken,
  groepeerPerWeek,
  sorteerAfspraken,
  zoekAfspraken,
  type LijstKolom,
  type LijstWeergave,
  type SorteerRichting,
  type WeekGroep,
} from "@/components/planbord/lijst";
import {
  dagenBereik,
  datumBereikKort,
  periodeVoluit,
  urenTekst,
} from "@/components/planbord/datum-nl";
import {
  PLAN_STATUS_LABELS,
  PlanStatusPil,
  planStatusConfig,
} from "@/components/planbord/plan-status";
import { PlanningTabs } from "@/components/planbord/planning-tabs";
import {
  maandagVan,
  periodeBereik,
  vandaagIso,
  type Periode,
} from "@/components/planbord/periode";
import { addDagen } from "@convex/planbordLogica";

/**
 * Kolommen in schermvolgorde. Nooit zijwaarts scrollen: de tabel is een grid
 * dat met de breedte van zijn container meegroeit. Smal staan alleen datum,
 * afspraak en uren; status, ploeg en tijd komen er bij meer ruimte bij (en
 * staan smal in de tweede regel onder de afspraak).
 */
const KOLOMMEN: {
  id: LijstKolom;
  label: string;
  zichtbaar: string;
  rechts?: boolean;
}[] = [
  { id: "datum", label: "Datum", zichtbaar: "" },
  { id: "naam", label: "Afspraak", zichtbaar: "" },
  { id: "team", label: "Ploeg", zichtbaar: "hidden @4xl:flex" },
  { id: "status", label: "Status", zichtbaar: "hidden @xl:flex" },
  { id: "tijd", label: "Tijd", zichtbaar: "hidden @5xl:flex" },
  { id: "uren", label: "Uren", zichtbaar: "", rechts: true },
];

const RASTER =
  "grid items-center gap-x-4 grid-cols-[6.5rem_minmax(0,1fr)_3rem] @xl:grid-cols-[9.5rem_minmax(0,1fr)_8rem_4rem] @4xl:grid-cols-[9.5rem_minmax(0,1fr)_9rem_8rem_4rem] @5xl:grid-cols-[9.5rem_minmax(0,1fr)_9rem_8rem_7.5rem_4rem]";

const SNELLE_PERIODES: { id: Periode; label: string }[] = [
  { id: "week", label: "Deze week" },
  { id: "14dagen", label: "2 weken" },
  { id: "maand", label: "Maand" },
];

function tijdTekst(rij: PlanbordEvent): string {
  if (!rij.startTijd) return "—";
  return rij.eindTijd ? `${rij.startTijd}–${rij.eindTijd}` : rij.startTijd;
}

function WeekKop({ groep, eerste }: { groep: WeekGroep; eerste: boolean }) {
  const doorlopend = groep.vanWeek.week !== groep.totWeek.week ||
    groep.vanWeek.jaar !== groep.totWeek.jaar;
  const aantal = groep.afspraken.length;
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-2.5 px-3.5 pt-3.5 pb-1.5",
        !eerste && "border-t"
      )}
    >
      <h2 className="font-display text-[15px] font-semibold tabular-nums">
        Week {groep.vanWeek.week}
        {doorlopend ? `–${groep.totWeek.week}` : ""}
      </h2>
      <span className="text-xs text-muted-foreground tabular-nums">
        {doorlopend ? "loopt over het weekend door" : dagenBereik(groep.maandag, groep.zondag)}
        {" · "}
        {aantal} {aantal === 1 ? "afspraak" : "afspraken"}
      </span>
    </div>
  );
}

export default function LijstweergavePagina() {
  const { user } = useCurrentUser();

  // Default-periode: deze week + volgende week (zelfde horizon als het bord)
  const [van, setVan] = useState(() => maandagVan(vandaagIso()));
  const [tot, setTot] = useState(() => addDagen(maandagVan(vandaagIso()), 13));
  const [weergave, setWeergave] = useState<LijstWeergave>("alle");
  const [zoekterm, setZoekterm] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [sorteerKolom, setSorteerKolom] = useState<LijstKolom>("datum");
  const [richting, setRichting] = useState<SorteerRichting>("asc");

  const geldigePeriode = Boolean(van && tot && van <= tot);
  const queryArgs = geldigePeriode ? { start: van, eind: tot } : "skip";
  const context = useQuery(api.planbord.getBordContext, queryArgs as never);
  const werkitems = useQuery(api.werkitems.listVoorPlanbord, queryArgs as never);
  // Klantnamen alleen ophalen als er echt gezocht wordt
  const zoekt = zoekterm.trim().length > 0;
  const klanten = useQuery(api.klanten.list, zoekt ? {} : "skip");

  const medewerkerId = (user?.linkedMedewerkerId as string | undefined) ?? null;
  const eigenTeams = useMemo(
    () => eigenTeamIds(context?.teams ?? [], medewerkerId),
    [context?.teams, medewerkerId]
  );
  const teamNamen = useMemo(() => {
    const namen: Record<string, string> = {};
    for (const team of context?.teams ?? []) namen[team._id] = team.naam;
    return namen;
  }, [context?.teams]);

  const klantNaamPerWerkitem = useMemo(() => {
    const kaart = new Map<string, string>();
    if (!klanten || !werkitems) return kaart;
    const namen = new Map<string, string>();
    for (const klant of klanten) namen.set(klant._id, klant.naam);
    for (const item of werkitems) {
      const naam = item.klantId ? namen.get(item.klantId) : undefined;
      if (naam) kaart.set(item._id, naam);
    }
    return kaart;
  }, [klanten, werkitems]);

  const rijen = useMemo(() => {
    const events = naarEvents(werkitems ?? []);
    const gefilterd = filterAfspraken(
      events,
      {
        weergave,
        teamId: teamFilter === "alle" ? null : teamFilter,
        status: statusFilter === "alle" ? null : statusFilter,
        van,
        tot,
      },
      eigenTeams
    );
    const gezocht = zoekAfspraken(gefilterd, zoekterm, (e) =>
      klantNaamPerWerkitem.get(e.id)
    );
    return sorteerAfspraken(gezocht, sorteerKolom, richting, teamNamen);
  }, [
    werkitems,
    weergave,
    teamFilter,
    statusFilter,
    van,
    tot,
    eigenTeams,
    zoekterm,
    klantNaamPerWerkitem,
    sorteerKolom,
    richting,
    teamNamen,
  ]);

  const groepen = useMemo(
    () => groepeerPerWeek(rijen, sorteerKolom === "datum" && richting === "desc"),
    [rijen, sorteerKolom, richting]
  );

  const totaalUren = useMemo(
    () => rijen.reduce((som, rij) => som + (rij.geschatteUren ?? 0), 0),
    [rijen]
  );

  const handleSorteer = (kolom: LijstKolom) => {
    if (kolom === sorteerKolom) {
      setRichting((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSorteerKolom(kolom);
      setRichting("asc");
    }
  };

  const kiesSnellePeriode = (periode: Periode) => {
    const bereik = periodeBereik(periode, vandaagIso());
    setVan(bereik.start);
    setTot(bereik.eind);
  };

  const isLoading = context === undefined || werkitems === undefined;

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">
              Afspraken
            </h1>
            <p className="text-[15px] text-muted-foreground tabular-nums">
              {!geldigePeriode ? (
                "Kies een geldige periode"
              ) : isLoading ? (
                <>Van {periodeVoluit(van, tot)}</>
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {rijen.length}
                  </span>{" "}
                  {rijen.length === 1 ? "afspraak" : "afspraken"} van{" "}
                  {periodeVoluit(van, tot)}
                  {totaalUren > 0 ? ` · ${urenTekst(totaalUren)} uur` : ""}
                </>
              )}
            </p>
          </div>
          <PlanningTabs actief="/planning/lijst" />
        </div>

        {/* Filters op één regel, zonder labels erboven: de waarde zegt wat
            het filter is; de naam staat in aria-label. */}
        <div
          role="search"
          aria-label="Afspraken filteren"
          className="flex flex-wrap items-center gap-2"
        >
          <div
            role="group"
            aria-label="Wiens afspraken"
            className="flex gap-0.5 rounded-lg bg-muted p-[3px]"
          >
            {(
              [
                { id: "mijn", label: "Mijn" },
                { id: "alle", label: "Alle" },
              ] as const
            ).map((optie) => {
              const actief = weergave === optie.id;
              const uit = optie.id === "mijn" && !medewerkerId;
              return (
                <button
                  key={optie.id}
                  type="button"
                  aria-pressed={actief}
                  disabled={uit}
                  title={
                    uit
                      ? "Je account is niet aan een medewerker gekoppeld"
                      : undefined
                  }
                  onClick={() => setWeergave(optie.id)}
                  className={cn(
                    "h-[30px] rounded-md px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    actief
                      ? "bg-card font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {optie.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full max-w-60 min-w-0 sm:w-60">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Zoek afspraak of klant"
              placeholder="Zoek afspraak of klant"
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              className="h-9 pl-9 text-[13px]"
            />
          </div>

          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger aria-label="Ploeg" className="h-9 w-auto min-w-36 text-[13px]">
              <SelectValue placeholder="Alle ploegen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle ploegen</SelectItem>
              {(context?.teams ?? []).map((team) => (
                <SelectItem key={team._id} value={team._id}>
                  {team.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Status" className="h-9 w-auto min-w-36 text-[13px]">
              <SelectValue placeholder="Alle statussen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle statussen</SelectItem>
              {Object.entries(PLAN_STATUS_LABELS).map(([status, label]) => (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            role="group"
            aria-label="Periode"
            className="flex items-center gap-1.5"
          >
            <Input
              type="date"
              aria-label="Van"
              value={van}
              onChange={(e) => setVan(e.target.value)}
              className="h-9 w-[9.5rem] text-[13px] tabular-nums"
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <Input
              type="date"
              aria-label="Tot en met"
              value={tot}
              onChange={(e) => setTot(e.target.value)}
              className="h-9 w-[9.5rem] text-[13px] tabular-nums"
            />
          </div>

          <div role="group" aria-label="Snelle periode" className="flex gap-1">
            {SNELLE_PERIODES.map((optie) => {
              const bereik = periodeBereik(optie.id, vandaagIso());
              const actief = bereik.start === van && bereik.eind === tot;
              return (
                <button
                  key={optie.id}
                  type="button"
                  aria-pressed={actief}
                  onClick={() => kiesSnellePeriode(optie.id)}
                  className={cn(
                    "h-[30px] rounded-full border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    actief
                      ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {optie.label}
                </button>
              );
            })}
          </div>
        </div>

        <section
          aria-label="Afspraken"
          className="@container rounded-lg border bg-card p-1"
        >
          {!geldigePeriode ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">
              Kies een geldige periode (van t/m tot).
            </p>
          ) : isLoading ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">
              Afspraken laden…
            </p>
          ) : rijen.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">
              Geen afspraken in deze periode
              {weergave === "mijn" ? " voor jouw ploeg" : ""}
              {zoekt ? " die passen bij je zoekterm" : ""}.
            </p>
          ) : (
            <div role="table" aria-label="Afspraken per week">
              <div role="rowgroup">
                <div role="row" className={cn(RASTER, "px-3.5 py-2")}>
                  {KOLOMMEN.map((kolom) => {
                    const actief = sorteerKolom === kolom.id;
                    return (
                      <div
                        key={kolom.id}
                        role="columnheader"
                        aria-sort={
                          actief
                            ? richting === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        className={cn(
                          "min-w-0",
                          kolom.zichtbaar || "flex",
                          kolom.rechts && "justify-end"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSorteer(kolom.id)}
                          aria-label={`Sorteer op ${kolom.label}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded text-xs transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            actief ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {kolom.label}
                          {actief ? (
                            richting === "asc" ? (
                              <ArrowDown aria-hidden="true" className="size-3" />
                            ) : (
                              <ArrowUp aria-hidden="true" className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown
                              aria-hidden="true"
                              className="size-3 opacity-40"
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {groepen.map((groep, groepIndex) => (
                <div role="rowgroup" key={groep.sleutel}>
                  <div role="row">
                    <div role="rowheader" aria-colspan={KOLOMMEN.length}>
                      <WeekKop groep={groep} eerste={groepIndex === 0} />
                    </div>
                  </div>
                  {groep.afspraken.map((rij, index) => {
                    const herhaaldeDatum =
                      sorteerKolom === "datum" &&
                      index > 0 &&
                      groep.afspraken[index - 1].start === rij.start &&
                      groep.afspraken[index - 1].eind === rij.eind;
                    const dagen = aantalDagen(rij);
                    const ploeg = rij.resourceId
                      ? (teamNamen[rij.resourceId] ?? "—")
                      : "Zonder ploeg";
                    return (
                      <div
                        role="row"
                        key={rij.id}
                        className={cn(
                          RASTER,
                          "rounded-md px-3.5 py-2.5 transition-colors hover:bg-muted/50"
                        )}
                      >
                        <div
                          role="cell"
                          className={cn(
                            "text-[13px] tabular-nums",
                            herhaaldeDatum
                              ? "text-muted-foreground"
                              : "font-semibold"
                          )}
                        >
                          {datumBereikKort(rij.start, rij.eind)}
                        </div>
                        <div role="cell" className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold" title={rij.titel}>
                            {rij.titel}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {rij.type === "onderhoudsbeurt"
                              ? "Onderhoudsbeurt"
                              : "Project"}
                            {dagen > 1 ? ` · ${dagen} dagen` : ""}
                            {/* Smal: ploeg, status en tijd in deze regel */}
                            <span className="@4xl:hidden"> · {ploeg}</span>
                            <span className="@xl:hidden">
                              {" · "}
                              {planStatusConfig(rij.status).label}
                            </span>
                            {rij.startTijd && (
                              <span className="tabular-nums @5xl:hidden">
                                {" · "}
                                {tijdTekst(rij)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div
                          role="cell"
                          className="hidden min-w-0 truncate text-[13px] @4xl:block"
                        >
                          {ploeg}
                        </div>
                        <div role="cell" className="hidden min-w-0 @xl:block">
                          <PlanStatusPil status={rij.status} />
                        </div>
                        <div
                          role="cell"
                          className="hidden text-[13px] text-muted-foreground tabular-nums @5xl:block"
                        >
                          {tijdTekst(rij)}
                        </div>
                        <div
                          role="cell"
                          className={cn(
                            "text-right tabular-nums",
                            rij.geschatteUren !== undefined
                              ? "font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          {rij.geschatteUren !== undefined
                            ? urenTekst(rij.geschatteUren)
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {geldigePeriode && !isLoading && rijen.length > 0 && (
            <div className="flex flex-wrap justify-between gap-2 border-t px-3.5 py-3 text-[13px] text-muted-foreground">
              <span>Klik op een kolomkop om binnen elke week te sorteren.</span>
              <span className="tabular-nums">
                Totaal{" "}
                <span className="font-semibold text-foreground">
                  {urenTekst(totaalUren)} uur
                </span>
              </span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
