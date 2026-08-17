"use client";

/**
 * /rapportages?tab=grafieken — het grafiekenblad.
 *
 * Het tegenovergestelde van het verhaal ernaast. Daar lees je vier vragen van
 * boven naar beneden; hier scan je één raster en weet je binnen een paar
 * seconden hoe de zaak loopt. Geen antwoordzinnen, geen doorkliklijstjes, geen
 * scrollverhaal — zes panelen, elk met één vraag in de kopbalk en één grafiek
 * eronder.
 *
 * ── Wat het níét is ─────────────────────────────────────────────────────
 * Geen tweede databron. Alles op dit blad komt uit precies dezelfde
 * `api.rapportage.getRapportage` met precies dezelfde periode als het verhaal
 * (de keuze staat in de URL, zie `use-rapportage-periode.ts`). Dat is R2: het
 * dashboard, het verhaal en dit blad kunnen per constructie geen verschillend
 * bedrag tonen. Wissel van tab en elk getal blijft staan.
 *
 * Geen versiering. Geen sparkline onder een kop, geen grafiek zonder vraag
 * erboven, geen achtste kleur omdat er nog een reeks bij moest. Een paneel
 * zonder data toont één regel achter de vraag (`GrafiekPaneel` → `legeRegel`) en
 * géén leeg assenkruis.
 *
 * ── De vormkeuzes ───────────────────────────────────────────────────────
 * 1. maandstaven met vorig jaar ernaast — twee hoogtes op één grondlijn is de
 *    enige eerlijke manier om "meer of minder dan vorig jaar" per maand te zien;
 * 2. aanleg naast onderhoud — twee genoemde categorieën, dus staven van gelijke
 *    kleur op een gedeelde noemer, niet twee punten van een cirkel;
 * 3. de trap (funnel) — geordende stappen, dus één kleur in aflopende dekking;
 * 4. openstaand geld per ouderdom — één balk die uiteenvalt, want het totaal ís
 *    de boodschap (hergebruik van `StapelBalk` uit het verhaal);
 * 5. begroot versus werkelijk — staven om een nullijn, waar de *richting* de
 *    betekenis draagt (zie de kopnoot van `afwijking-staven.tsx`);
 * 6. marge per soort werk — een ranglijst, want het gaat om de orde.
 *
 * Kleur doet nergens het werk alleen: elk getal staat als tekst in beeld, elke
 * tooltip noemt zijn reeks bij naam, en de maandgrafiek heeft een tabelversie.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowDownRight, ArrowUpRight, FileDown, Minus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Cel, Cijferstrip } from "@/components/ui/cijferstrip";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format/currency";
import {
  dagenTekst,
  formatPercentage,
  offerteTypeLabel,
  periodePresetLabel,
  scopeLabel,
  telwoord,
  urenTekst,
  verschilTekst,
  type VerschilToon,
} from "@/lib/rapportage-labels";
// Per bestand geïmporteerd en niet via de barrel: recharts komt uitsluitend
// binnen via `dynamic.tsx`, en de staafprimitieven zijn pure CSS.
import {
  AfwijkingStaven,
  type AfwijkingRegel,
} from "@/components/analytics/afwijking-staven";
import { DynamicJaarVergelijkingChart } from "@/components/analytics/dynamic";
import { BEWIJS_HOOGTE } from "@/components/analytics/maten";
import {
  RangStaven,
  StapelBalk,
  type StaafRegel,
  type StapelDeel,
} from "@/components/analytics/staafwerk";
import { TrapStaven, type TrapStap } from "@/components/analytics/trap-staven";
import { GrafiekPaneel } from "./grafiek-paneel";
import { PeriodeKiezer } from "./periode-kiezer";
import { RapportageSkelet } from "./rapportage-skelet";
import { RapportageTabbalk } from "./rapportage-tabbalk";
import type { Rapportage } from "./types";
import { useRapportagePeriode } from "./use-rapportage-periode";

/** Hoeveel regels een ranglijst of afwijkingslijst hoogstens toont. */
const MAX_REGELS = 8;

function euro(bedrag: number): string {
  return formatCurrency(bedrag, "nl-NL", false);
}

/** Ondertekend bedrag: "+ € 2.400" / "− € 320". Echte tekens, geen streepje. */
function euroMetTeken(bedrag: number): string {
  if (Math.round(bedrag) === 0) return euro(0);
  return `${bedrag > 0 ? "+ " : "− "}${euro(Math.abs(bedrag))}`;
}

export function RapportageGrafieken() {
  const { preset, aangepast, kiesPeriode } = useRapportagePeriode();

  const data = useQuery(api.rapportage.getRapportage, {
    preset,
    startDate: aangepast?.van,
    endDate: aangepast?.tot,
  });

  // Zelfde cross-fade als het verhaal (R6): het vorige blad blijft staan en
  // vervaagt licht terwijl het nieuwe binnenkomt, in plaats van terug te vallen
  // op skeletons bij elke periodewissel. Bewust een render-fase state-aanpassing
  // en géén effect — een `setState` na de paint laat je het oude blad eerst zien
  // verdwijnen.
  const [getoond, setGetoond] = useState<Rapportage | undefined>(undefined);
  if (data !== undefined && data !== getoond) {
    setGetoond(data);
  }
  const laadt = data === undefined;

  const afdrukHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("periode", preset);
    if (aangepast) {
      params.set("van", String(aangepast.van));
      params.set("tot", String(aangepast.tot));
    }
    params.set("direct", "1");
    return `/rapportages/afdruk?${params.toString()}`;
  }, [preset, aangepast]);

  return (
    <>
      <div className="border-b border-border/70 px-4 pt-6 pb-5 md:px-8 md:pt-9">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Rapport · {getoond?.periode.label ?? periodePresetLabel(preset)}
          </p>
          <h1 className="mt-1.5 font-display text-[32px] leading-tight font-semibold tracking-tight md:text-[40px]">
            Alle cijfers in één blik
          </h1>
          <p className="mt-2 max-w-[62ch] text-[15px] text-pretty text-muted-foreground">
            Zes vragen, zes grafieken, dezelfde cijfers als in het verhaal —
            maar dan om te scannen in plaats van te lezen.
          </p>
          <RapportageTabbalk className="mt-5 -mb-5" />
        </div>
      </div>

      {/* Eén filterrij boven álles wat hij begrenst, nooit een filter per
          paneel: zo kunnen twee grafieken naast elkaar niet over een andere
          periode gaan. */}
      <div className="sticky top-0 z-30 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2 py-2">
          <PeriodeKiezer
            preset={preset}
            periodeLabel={getoond?.periode.label}
            aangepast={aangepast}
            onKies={kiesPeriode}
          />
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 gap-2 font-normal"
          >
            <Link href={afdrukHref} target="_blank" rel="noopener">
              <FileDown className="size-3.5" />
              Download maandrapport
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-4 pb-16 md:px-8">
        {getoond === undefined ? (
          <div className="pt-8">
            <RapportageSkelet />
          </div>
        ) : (
          // Het dimmen tijdens het herladen is een CSS-transition, geen
          // JS-animatie: de eindwaarde staat in de klasse, dus zonder een enkel
          // animatieframe klopt de opaciteit meteen.
          <div
            className={cn(
              "mx-auto max-w-5xl pt-8 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              laadt ? "opacity-45" : "opacity-100"
            )}
            aria-busy={laadt}
          >
            <Blad rapportage={getoond} />
          </div>
        )}
      </div>
    </>
  );
}

// ── Het raster ───────────────────────────────────────────────────────────

function Blad({ rapportage }: { rapportage: Rapportage }) {
  const { periode, hoeLoopt, pipeline, geldLigt, besteWerk, meta } = rapportage;

  if (!meta.heeftData) {
    return (
      <div className="max-w-[58ch] py-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Over {periode.label} valt nog niets te tekenen
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted-foreground">
          Er is in deze periode geen offerte getekend, geen factuur verstuurd en
          er staat geen werk open. Elke grafiek op dit blad vult zich vanzelf
          zodra dat verandert; kijk anders eerst naar een ruimere periode.
        </p>
      </div>
    );
  }

  return (
    // @container/blad: het raster vouwt op de breedte van de kolom, niet op die
    // van het scherm — dit blad staat naast een sidebar die open of dicht kan.
    <div className={cn("@container/blad", REVEAL_KLASSE)}>
      <Kerncijfers rapportage={rapportage} />

      <div className="mt-6 grid gap-4 @min-[56rem]/blad:grid-cols-2">
        <PaneelOmzetVerloop
          hoeLoopt={hoeLoopt}
          periodeLabel={periode.label}
          vorigJaarLabel={periode.zelfdePeriodeVorigJaar?.label}
        />
        <PaneelOmzetMix besteWerk={besteWerk} periodeLabel={periode.label} />
        <PaneelTrap pipeline={pipeline} />
        <PaneelOpenstaand geldLigt={geldLigt} />
        <PaneelBegroting geldLigt={geldLigt} periodeLabel={periode.label} />
        <PaneelMarge besteWerk={besteWerk} periodeLabel={periode.label} />
      </div>
    </div>
  );
}

// ── Kerncijfers ──────────────────────────────────────────────────────────

function ToonIcoon({ toon }: { toon: VerschilToon }) {
  if (toon === "vooruit") {
    return <ArrowUpRight className="size-3 text-primary" aria-hidden />;
  }
  if (toon === "achteruit") {
    return (
      <ArrowDownRight className="size-3 text-[var(--chart-2)]" aria-hidden />
    );
  }
  if (toon === "gelijk") {
    return <Minus className="size-3 text-muted-foreground" aria-hidden />;
  }
  return null;
}

/**
 * Eén voetregel met de vergelijking. De richting staat er in taal ("12,4%
 * meer"), het pijltje en de kleur zijn versterking — nooit de enige drager.
 */
function Vergelijking({
  verschil,
  basisLabel,
}: {
  verschil: number | null;
  basisLabel?: string;
}) {
  const { toon, tekst } = verschilTekst(verschil);
  if (toon === "geen-basis") {
    return (
      <span className="text-muted-foreground">geen vergelijking mogelijk</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <ToonIcoon toon={toon} />
      <span className="font-medium text-foreground">{tekst}</span>
      {basisLabel && <>dan {basisLabel.toLowerCase()}</>}
    </span>
  );
}

/**
 * Vier kerncijfers als één instrument (`Cijferstrip`), niet als vier kaarten.
 * Dit is de "één oogopslag" waar de rest van het blad het bewijs bij levert;
 * elk cijfer klikt door naar de lijst die het maakt.
 */
function Kerncijfers({ rapportage }: { rapportage: Rapportage }) {
  const { periode, hoeLoopt, geldLigt, besteWerk } = rapportage;
  const { huidig, verschil } = hoeLoopt;
  const openstaand = geldLigt.openstaand;

  return (
    <Cijferstrip
      label="Kerncijfers van deze periode"
      kolommen="@min-[34rem]/blad:grid-cols-2 @min-[62rem]/blad:grid-cols-4"
    >
      <Cel
        label="Getekend werk, excl. btw"
        href="/offertes?status=geaccepteerd"
        waardeTekst={euro(huidig.getekendeOmzetExclBtw)}
        voet={
          <Vergelijking
            verschil={verschil.getekendeOmzetVsVorigePeriode}
            basisLabel={periode.vorigePeriode?.label}
          />
        }
      />
      <Cel
        label="Gefactureerd, incl. btw"
        href="/facturen"
        waardeTekst={euro(huidig.gefactureerdInclBtw)}
        voet={
          <Vergelijking
            verschil={verschil.gefactureerdVsVorigePeriode}
            basisLabel={periode.vorigePeriode?.label}
          />
        }
      />
      <Cel
        label="Nog openstaand"
        href="/facturen"
        waardeTekst={euro(openstaand.totaalOpenstaand)}
        voet={
          <span className="text-muted-foreground">
            {openstaand.totaalOpenstaand > 0
              ? `gemiddeld ${dagenTekst(openstaand.gemiddeldeOuderdomDagen)} oud`
              : "alles is binnen"}
          </span>
        }
      />
      <Cel
        label="Marge op getekend werk"
        href="/offertes?status=geaccepteerd"
        waardeTekst={formatPercentage(besteWerk.margePercentage)}
        voet={
          <span className="text-muted-foreground">
            {euro(besteWerk.marge)} in euro&apos;s
          </span>
        }
      />
    </Cijferstrip>
  );
}

// ── Paneel 1: omzetverloop per maand, met vorig jaar ─────────────────────

function PaneelOmzetVerloop({
  hoeLoopt,
  periodeLabel,
  vorigJaarLabel,
}: {
  hoeLoopt: Rapportage["hoeLoopt"];
  periodeLabel: string;
  vorigJaarLabel?: string;
}) {
  const { maandReeks, maandReeksVorigJaar } = hoeLoopt;
  const heeftVergelijking = maandReeksVorigJaar.length > 0;

  return (
    <GrafiekPaneel
      vraag={
        heeftVergelijking
          ? "Loopt de omzet voor op vorig jaar?"
          : "Hoe verloopt de omzet per maand?"
      }
      reikwijdte={periodeLabel}
      uitleg={
        <>
          Getekende omzet per maand, excl. btw — de opdrachtwaarde die de klant
          in die maand tekende.
          {heeftVergelijking && vorigJaarLabel && (
            <> De tweede staaf is dezelfde maand in {vorigJaarLabel}.</>
          )}
        </>
      }
      leeg={
        maandReeks.length === 0
          ? {
              tekst: "Nog geen volle maand",
              hint: "Deze periode beslaat nog geen hele maand; kies een ruimere periode.",
            }
          : undefined
      }
    >
      <DynamicJaarVergelijkingChart
        data={maandReeks}
        vorigJaar={maandReeksVorigJaar}
        hoogte={BEWIJS_HOOGTE}
      />
    </GrafiekPaneel>
  );
}

// ── Paneel 2: aanleg naast onderhoud ────────────────────────────────────

function PaneelOmzetMix({
  besteWerk,
  periodeLabel,
}: {
  besteWerk: Rapportage["besteWerk"];
  periodeLabel: string;
}) {
  const { omzetPerType } = besteWerk;
  const totaal = omzetPerType.reduce((som, rij) => som + rij.omzetExclBtw, 0);

  const regels: StaafRegel[] = omzetPerType.map((rij) => ({
    sleutel: rij.type,
    label: offerteTypeLabel(rij.type),
    waarde: rij.omzetExclBtw,
    waardeTekst: euro(rij.omzetExclBtw),
    bijschrift: `${formatPercentage(rij.aandeelPercentage, 0)} van de omzet · ${telwoord(
      rij.aantalGetekend,
      "opdracht",
      "opdrachten"
    )} · marge ${formatPercentage(rij.margePercentage)}`,
    href: "/offertes?status=geaccepteerd",
  }));

  return (
    <GrafiekPaneel
      vraag="Waar komt de omzet vandaan?"
      reikwijdte={periodeLabel}
      uitleg="Getekende omzet excl. btw, verdeeld over aanleg en onderhoud. De staaflengte is het aandeel in het totaal."
      leeg={
        regels.length === 0
          ? {
              tekst: "Nog niets getekend",
              hint: "Zodra een offerte op ‘geaccepteerd’ staat verschijnt hier de verdeling over aanleg en onderhoud.",
            }
          : undefined
      }
    >
      {/* Eén noemer voor beide staven, zodat de lengte het aandeel is en niet
          alleen de onderlinge verhouding. */}
      <RangStaven regels={regels} maximum={Math.max(1, totaal)} />
    </GrafiekPaneel>
  );
}

// ── Paneel 3: de trap ───────────────────────────────────────────────────

function PaneelTrap({ pipeline }: { pipeline: Rapportage["pipeline"] }) {
  const { funnel, conversie } = pipeline;

  const stappen: TrapStap[] = [
    {
      sleutel: "voorcalculatie",
      label: "Voorcalculatie gemaakt",
      waarde: funnel.voorcalculatie,
      waardeTekst: telwoord(funnel.voorcalculatie, "offerte", "offertes"),
      bijschrift: "alles wat verder is dan een concept",
      href: "/offertes?status=voorcalculatie",
    },
    {
      sleutel: "verzonden",
      label: "Verstuurd naar de klant",
      waarde: funnel.verzonden,
      waardeTekst: telwoord(funnel.verzonden, "offerte", "offertes"),
      bijschrift: `${formatPercentage(conversie.voorcalculatieToVerzonden, 0)} ging de deur uit`,
      href: "/offertes?status=verzonden",
    },
    {
      sleutel: "afgehandeld",
      label: "Klant heeft geantwoord",
      waarde: funnel.afgehandeld,
      waardeTekst: telwoord(funnel.afgehandeld, "offerte", "offertes"),
      bijschrift: `${formatPercentage(conversie.verzondenToAfgehandeld, 0)} van het verstuurde werk`,
    },
    {
      sleutel: "geaccepteerd",
      label: "Getekend",
      waarde: funnel.geaccepteerd,
      waardeTekst: telwoord(funnel.geaccepteerd, "offerte", "offertes"),
      bijschrift: `${formatPercentage(conversie.afgehandeldToWon, 0)} van de antwoorden was ja · ${formatPercentage(
        conversie.overallConversion,
        0
      )} van begin tot eind`,
      href: "/offertes?status=geaccepteerd",
    },
  ];

  return (
    <GrafiekPaneel
      vraag="Hoe ver komt een offerte?"
      reikwijdte="Alle offertes"
      uitleg="De vier stappen die een offerte doorloopt, cumulatief geteld: elke stap bevat alles wat die stap bereikt heeft of verder is. Concepten tellen niet mee — die ontstaan bij het opslaan. Los van de gekozen periode."
      leeg={
        funnel.voorcalculatie === 0
          ? {
              tekst: "Nog geen offerte voorbij het concept",
              hint: "Zodra een offerte een voorcalculatie krijgt begint de trap te lopen.",
            }
          : undefined
      }
    >
      <TrapStaven stappen={stappen} />
    </GrafiekPaneel>
  );
}

// ── Paneel 4: openstaand geld per ouderdom ──────────────────────────────

/** Zelfde volgorde en zelfde kleurregel als in het verhaal (R4). */
const OUDERDOM_DELEN: ReadonlyArray<{
  sleutel: "nog_niet_vervallen" | "1_30_dagen" | "31_60_dagen" | "ouder_dan_60_dagen";
  label: string;
  vraagtAandacht: boolean;
}> = [
  { sleutel: "nog_niet_vervallen", label: "Nog niet vervallen", vraagtAandacht: false },
  { sleutel: "1_30_dagen", label: "1–30 dagen te laat", vraagtAandacht: true },
  { sleutel: "31_60_dagen", label: "31–60 dagen te laat", vraagtAandacht: true },
  { sleutel: "ouder_dan_60_dagen", label: "60+ dagen te laat", vraagtAandacht: true },
];

function PaneelOpenstaand({
  geldLigt,
}: {
  geldLigt: Rapportage["geldLigt"];
}) {
  const { openstaand } = geldLigt;

  const delen: StapelDeel[] = OUDERDOM_DELEN.map((deel) => {
    const bucket = openstaand.perBucket[deel.sleutel];
    return {
      sleutel: deel.sleutel,
      label: `${deel.label} (${bucket.aantal})`,
      waarde: bucket.bedrag,
      waardeTekst: euro(bucket.bedrag),
      vraagtAandacht: deel.vraagtAandacht,
    };
  });

  return (
    <GrafiekPaneel
      vraag="Hoe lang staat het geld al buiten?"
      reikwijdte="Nu openstaand"
      uitleg="Verzonden facturen die nog niet (volledig) betaald zijn, verdeeld naar hoe lang ze over de vervaldatum heen zijn. Bewust los van de gekozen periode: openstaand geld is openstaand, ook als de factuur van vorig kwartaal is."
      leeg={
        openstaand.totaalOpenstaand <= 0
          ? {
              tekst: "Er staat geen geld buiten",
              hint: "Elke verstuurde factuur is betaald.",
            }
          : undefined
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-display text-xl font-semibold tabular-nums text-foreground">
          {euro(openstaand.totaalOpenstaand)}
        </span>{" "}
        openstaand, gemiddeld{" "}
        {dagenTekst(openstaand.gemiddeldeOuderdomDagen)} oud
      </p>
      <StapelBalk delen={delen} />
    </GrafiekPaneel>
  );
}

// ── Paneel 5: begroot versus werkelijk ──────────────────────────────────

function PaneelBegroting({
  geldLigt,
  periodeLabel,
}: {
  geldLigt: Rapportage["geldLigt"];
  periodeLabel: string;
}) {
  const { voorNacalculatie } = geldLigt;

  const regels: AfwijkingRegel[] = voorNacalculatie.scopes
    .slice(0, MAX_REGELS)
    .map((scope) => ({
      sleutel: scope.scope,
      label: scopeLabel(scope.scope),
      waarde: scope.afwijkingEuro,
      waardeTekst: euroMetTeken(scope.afwijkingEuro),
      bijschrift: `${urenTekst(scope.werkelijkeUren)} gewerkt, ${urenTekst(
        scope.geplandeUren
      )} begroot`,
    }));

  const onvolledig = voorNacalculatie.projectenZonderNacalculatie;

  return (
    <GrafiekPaneel
      vraag="Waar loopt de begroting uit de hand?"
      reikwijdte={periodeLabel}
      uitleg={
        <>
          Werkelijke uren minus begrote uren per soort werk, omgerekend tegen het
          uurtarief van {euro(voorNacalculatie.uurtarief)}. Rechts van de
          middenlijn is duurder dan begroot, links goedkoper.
          {onvolledig > 0 && (
            <>
              {" "}
              Let op: {telwoord(onvolledig, "afgerond project", "afgeronde projecten")}{" "}
              wacht nog op een nacalculatie, dus dit beeld is onvolledig.
            </>
          )}
        </>
      }
      leeg={
        regels.length === 0
          ? {
              tekst: "Nog niets nagecalculeerd",
              hint:
                onvolledig > 0
                  ? `${telwoord(onvolledig, "afgerond project", "afgeronde projecten")} wacht nog op een nacalculatie.`
                  : "Zodra een project is nagecalculeerd verschijnt hier het verschil tussen begroot en werkelijk.",
            }
          : undefined
      }
    >
      <AfwijkingStaven
        regels={regels}
        linksLabel="goedkoper dan begroot"
        rechtsLabel="duurder dan begroot"
      />
      <p className="mt-4 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
        Over {telwoord(voorNacalculatie.aantalProjecten, "project", "projecten")}:{" "}
        {formatPercentage(voorNacalculatie.accuratessePercentage, 0)} bleef binnen
        10% van de begroting.
      </p>
    </GrafiekPaneel>
  );
}

// ── Paneel 6: marge per soort werk ──────────────────────────────────────

function PaneelMarge({
  besteWerk,
  periodeLabel,
}: {
  besteWerk: Rapportage["besteWerk"];
  periodeLabel: string;
}) {
  const regels: StaafRegel[] = useMemo(
    () =>
      besteWerk.scopeMarges
        .slice()
        // Op marge en niet op omzet: paneel 2 gaat al over "waar komt de omzet
        // vandaan", dit paneel gaat over wat het oplevert.
        .sort((a, b) => b.margePercentage - a.margePercentage)
        .slice(0, MAX_REGELS)
        .map((scope) => ({
          sleutel: scope.scope,
          label: scopeLabel(scope.scope),
          waarde: scope.margePercentage,
          waardeTekst: formatPercentage(scope.margePercentage),
          bijschrift: `${euro(scope.marge)} marge op ${euro(scope.omzetExclBtw)} omzet · ${telwoord(
            scope.aantalOffertes,
            "offerte",
            "offertes"
          )}`,
        })),
    [besteWerk.scopeMarges]
  );

  return (
    <GrafiekPaneel
      vraag="Welk werk levert de meeste marge op?"
      reikwijdte={periodeLabel}
      uitleg="Marge als percentage van de omzet per soort werk, over de getekende offertes in deze periode. De omzet wordt toegerekend op basis van de regelbedragen per scope."
      leeg={
        regels.length === 0
          ? {
              tekst: "Nog geen getekend werk met scopes",
              hint: "Zodra er een offerte met werkzaamheden getekend is verschijnt hier de marge per soort werk.",
            }
          : undefined
      }
    >
      <RangStaven regels={regels} />
    </GrafiekPaneel>
  );
}
