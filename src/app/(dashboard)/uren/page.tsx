"use client";

/**
 * `/uren` — de Controlekamer.
 *
 * Deze pagina was tot 17 aug 2026 een pre-designprogramma-scherm: vier
 * statkaarten ("Deze Week 0,0", "Deze Maand", "Totaal", "Registraties 44"), twee
 * voortgangsbalk-kaarten en één gepagineerde tabel met zeven filtercontrols op
 * de óude urenbron. Hij vertelde dát er uren waren, niet óf ze kloppen — en de
 * echte urenketen (`urenSegmenten`, dag op slot, voorstellen, logboek) kwam er
 * niet in voor.
 *
 * Nu: één route, per rol een ander gezicht, en voor kantoor de vier vragen van
 * de Controlekamer. Onderbouwing in `docs/design/plannen/uren-controlekamer-plan.md`
 * en `uren-redesign-onderzoek-ux.md`; het datacontract staat in plan §2 en leeft
 * aan de UI-kant in `src/components/uren/controle-types.ts`.
 */

import { Suspense } from "react";
import Link from "next/link";
import { useCurrentUserRole, useIsKantoor } from "@/hooks/use-users";
import { PageHeader } from "@/components/page-header";
import { DataFetchErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { KantoorControlekamer } from "@/components/uren/kantoor-controlekamer";

export default function UrenPage() {
  return (
    <>
      <PageHeader />
      {/* De weekkeuze leeft in `?week=`; `useSearchParams` vraagt daarom om een
          Suspense-grens boven het gezicht. */}
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <LaadIndicator formaat="pagina" tekst="Laden…" />
          </div>
        }
      >
        <UrenGezicht />
      </Suspense>
    </>
  );
}

/**
 * ── Ankerpunt rolgezichten (WS-C) ──────────────────────────────────────────
 *
 * Eén route, drie gezichten (plan §1). WS-B levert het kantoor-gezicht; WS-C
 * hangt de andere twee hier ín, en verder nergens. Wat WS-C hoeft te doen:
 *
 * ```tsx
 * const rol = useCurrentUserRole();
 * if (rol === "voorman")    return <PloegDagGezicht datum={vandaagIso()} />;
 * if (rol === "medewerker") return <MijnWeekGezicht />;   // leest ?week= zelf
 * return <KantoorControlekamer onDagFilm={openFilm} />;
 * ```
 *
 * Beide nieuwe gezichten horen hun eigen periode uit de URL te lezen met
 * `useWeekKeuze()` (`src/components/uren/week.ts`) — dan blijft één `?week=` de
 * bron voor alle drie, en werkt een gedeelde link in elk gezicht.
 *
 * **Film-doorklik.** `KantoorControlekamer` heeft één prop:
 * `onDagFilm?: (dag: { medewerkerId: string; datum: string }) => void`. Die
 * wordt doorgegeven aan elke dagkaart in "Wat wijkt af?" en rendert daar de knop
 * "Bekijk deze dag als film"; zonder de prop blijft de knop weg. WS-C zet er
 * `?dag=YYYY-MM-DD&weergave=film` in (deeplinkbaar, `useTabState`-patroon) en
 * rendert de Ploegenfilm dan hier, boven of in plaats van de Controlekamer.
 * De dagbalk die de film nodig heeft is klaar: `<Dagbalk formaat="mini" />` per
 * ploeglid, met dezelfde as (`asVanMinuten`/`asTotMinuten` via
 * `dagbalkBlokken`) als de gedeelde tijd-as van het hoofdstuk.
 */
function UrenGezicht() {
  const rol = useCurrentUserRole();
  const isKantoor = useIsKantoor();

  // Tot WS-C de rolgezichten bouwt: voorman en medewerker krijgen geen half
  // kantoor-scherm te zien (de controle-queries zijn kantoor-only en zouden
  // gewoon een fout gooien), maar een eerlijke regel plus de weg naar hun eigen
  // invoer. Zodra WS-C er is, vervangt zijn switch deze twee takken.
  if (rol !== null && !isKantoor) {
    return <NogGeenEigenGezicht />;
  }

  return (
    <DataFetchErrorBoundary dataDescription="De controlekamer">
      <KantoorControlekamer />
    </DataFetchErrorBoundary>
  );
}

function NogGeenEigenGezicht() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 md:p-8">
      <h1 className="font-display text-[19px] leading-7 font-semibold tracking-tight">
        Je eigen week komt hier te staan
      </h1>
      <p className="max-w-[58ch] text-[13px] text-pretty text-muted-foreground">
        Deze pagina is nu het controlescherm van kantoor. Je eigen dagen —
        inclusief wat kantoor eventueel gecorrigeerd heeft — krijgen hier een
        eigen gezicht. Tot dan doe je je uren waar je ze altijd doet.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-8">
          <Link href="/veld">Naar mijn werkdag</Link>
        </Button>
      </div>
    </div>
  );
}
