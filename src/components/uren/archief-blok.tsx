"use client";

/**
 * Voetblok · archief — de enige plek waar de klassieke lijst nog leeft.
 *
 * Twee dingen, streng gescheiden:
 *
 * 1. **Behandelde dagen** — het `urenLogboek` als compacte dagenlijst: wie,
 *    welke dag, wat ermee gebeurde. Dit is het terugzoek-archief van de nieuwe
 *    engine (`urenSegmenten` + `urenDagen`).
 * 2. **Projectregistraties** — de oude engine (`urenRegistraties`), in compacte
 *    vorm, met een periode-kiezer. Dit is de bron waar nacalculatie en de
 *    loonexport op draaien.
 *
 * **De twee worden nooit opgeteld.** Dat is de bindende regel uit onderzoek §6
 * ("geen twee waarheden"): dezelfde uren kunnen in beide bronnen staan, en één
 * totaal over de twee is per definitie fout. Daarom staan ze in twee panelen
 * met twee eigen totalen en een regel die zegt waarom.
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Archive, FolderKanban } from "lucide-react";
import { api } from "@convex/_generated/api";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatHours, getDaysAgoString, getTodayString } from "@/lib/format";
import { dagLabelLang } from "./week";

type ArchiefPeriode = "maand" | "kwartaal" | "jaar";

const PERIODE_LABEL: Record<ArchiefPeriode, string> = {
  maand: "Afgelopen maand",
  kwartaal: "Afgelopen kwartaal",
  jaar: "Afgelopen jaar",
};

const PERIODE_DAGEN: Record<ArchiefPeriode, number> = {
  maand: 30,
  kwartaal: 90,
  jaar: 365,
};

const LOGBOEK_LABEL: Record<string, string> = {
  dag_ingediend: "ingediend",
  dag_heropend: "heropend",
  segment_gecorrigeerd: "gecorrigeerd",
  dag_akkoord: "akkoord",
};

/** Hoeveel dagregels het archief laat zien voordat het te veel wordt. */
const MAX_DAGREGELS = 25;
const MAX_REGISTRATIES = 25;

export function ArchiefBlok() {
  const [periode, setPeriode] = useState<ArchiefPeriode>("maand");
  const startDate = getDaysAgoString(PERIODE_DAGEN[periode]);
  const endDate = getTodayString();

  const logboek = useQuery(api.urenSegmenten.getUrenLogboek, { limit: 200 });
  const medewerkers = useQuery(api.medewerkers.list, {});
  const registraties = useQuery(api.urenRegistraties.listGlobal, {
    startDate,
    endDate,
  });

  const naamVan = useMemo(() => {
    const kaart = new Map<string, string>();
    for (const medewerker of medewerkers ?? []) {
      kaart.set(medewerker._id.toString(), medewerker.naam);
    }
    return kaart;
  }, [medewerkers]);

  /**
   * Eén regel per medewerker-dag: de acties van die dag samengevoegd. Het
   * logboek heeft meerdere regels per dag (ingediend, gecorrigeerd, akkoord) en
   * die horen in het archief op één regel te staan — je zoekt een dag terug, geen
   * gebeurtenis.
   */
  const dagen = useMemo(() => {
    const perDag = new Map<
      string,
      {
        medewerkerId: string;
        datum: string;
        acties: string[];
        laatste: number;
      }
    >();
    for (const regel of logboek ?? []) {
      if (regel.datum < startDate || regel.datum > endDate) continue;
      const sleutel = `${regel.medewerkerId}-${regel.datum}`;
      const bestaand = perDag.get(sleutel);
      const label = LOGBOEK_LABEL[regel.actie] ?? regel.actie;
      if (bestaand) {
        if (!bestaand.acties.includes(label)) bestaand.acties.push(label);
        bestaand.laatste = Math.max(bestaand.laatste, regel.createdAt);
      } else {
        perDag.set(sleutel, {
          medewerkerId: regel.medewerkerId.toString(),
          datum: regel.datum,
          acties: [label],
          laatste: regel.createdAt,
        });
      }
    }
    return [...perDag.values()]
      .sort((a, b) => b.datum.localeCompare(a.datum))
      .slice(0, MAX_DAGREGELS);
  }, [logboek, startDate, endDate]);

  const gesorteerdeRegistraties = useMemo(
    () =>
      [...(registraties ?? [])]
        .sort((a, b) => b.datum.localeCompare(a.datum))
        .slice(0, MAX_REGISTRATIES),
    [registraties]
  );

  const registratieTotaal = (registraties ?? []).reduce(
    (som, regel) => som + regel.uren,
    0
  );

  const periodeKiezer = (
    <Select
      value={periode}
      onValueChange={(waarde) => setPeriode(waarde as ArchiefPeriode)}
    >
      <SelectTrigger
        size="sm"
        className="h-8 w-[11rem]"
        aria-label="Periode van het archief"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(PERIODE_LABEL) as ArchiefPeriode[]).map((waarde) => (
          <SelectItem key={waarde} value={waarde}>
            {PERIODE_LABEL[waarde]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-4">
      <SectiePaneel
        kopbalk
        titel="Archief"
        icoon={<Archive aria-hidden />}
        acties={periodeKiezer}
        uitleg="Terugzoeken in dagen die al behandeld zijn: ingediend, gecorrigeerd, heropend of akkoord bevonden."
        {...(dagen.length === 0
          ? {
              legeRegel: {
                tekst: "Nog niets behandeld in deze periode.",
                hint: "Zodra een dag is ingediend of gecorrigeerd, staat hij hier.",
              },
            }
          : {})}
      >
        {dagen.length > 0 && (
          <ul className="divide-y">
            {dagen.map((dag) => (
              <li
                key={`${dag.medewerkerId}-${dag.datum}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-[13px]"
              >
                <span className="min-w-0 truncate font-medium @[30rem]/sectie:w-[11rem]">
                  {naamVan.get(dag.medewerkerId) ?? "Onbekende medewerker"}
                </span>
                <time
                  dateTime={dag.datum}
                  className="text-xs text-muted-foreground"
                >
                  {dagLabelLang(dag.datum)}
                </time>
                <span className="ml-auto text-xs text-muted-foreground">
                  {dag.acties.join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectiePaneel>

      <SectiePaneel
        kopbalk
        titel="Projectregistraties"
        icoon={<FolderKanban aria-hidden />}
        uitleg="De oude urenbron per project (urenRegistraties), waar nacalculatie en de loonexport op draaien. Deze uren worden nooit bij de dagen hierboven opgeteld: dezelfde uren kunnen in beide bronnen staan."
        {...(gesorteerdeRegistraties.length === 0
          ? {
              legeRegel: {
                tekst: "Geen registraties in deze periode.",
                hint: "Projecturen komen uit de projectuitvoering, niet uit de dagcontrole.",
              },
            }
          : {})}
      >
        {gesorteerdeRegistraties.length > 0 && (
          <>
            <p className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              Aparte bron: {formatHours(registratieTotaal)} uur in{" "}
              {PERIODE_LABEL[periode].toLowerCase()} — bewust niet opgeteld bij
              de dagen hierboven.
            </p>
            <ul className="divide-y">
              {gesorteerdeRegistraties.map((regel) => (
                <li
                  key={regel._id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-[13px]"
                >
                  <time
                    dateTime={regel.datum}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                  >
                    {formatDate(regel.datum)}
                  </time>
                  <span className="min-w-0 truncate font-medium @[30rem]/sectie:w-[9rem]">
                    {regel.medewerker}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-muted-foreground"
                    title={regel.projectNaam}
                  >
                    {regel.projectNaam}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatHours(regel.uren)} uur
                  </span>
                </li>
              ))}
            </ul>
            {(registraties?.length ?? 0) > MAX_REGISTRATIES && (
              <p className="px-3 py-1.5 text-xs text-muted-foreground">
                De {MAX_REGISTRATIES} nieuwste van {registraties?.length}{" "}
                registraties. Zoek verder in het project zelf.
              </p>
            )}
          </>
        )}
      </SectiePaneel>
    </div>
  );
}
