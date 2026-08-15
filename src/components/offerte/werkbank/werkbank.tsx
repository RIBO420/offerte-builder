"use client";

/**
 * Het werkblad — één scherm waarin de offerte al bestaat.
 *
 * Links het document (klant, omstandigheden, scopes met hun berekende regels,
 * garantie), rechts het palet met de lettertoetsen en het meelopende totaal.
 * Geen stappen, geen "Beginnen", geen "Offerte Aanmaken": wat je typt staat
 * binnen een seconde in het concept.
 *
 * Zie `docs/design/plannen/offerte-entree-masterplan.md`, fase B.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { m } from "framer-motion";
import { AlertTriangle, Check, Loader2, PenLine, Sprout } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { BouwstenenKiezer } from "@/components/offerte/bouwstenen-kiezer";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  RENOVATIE_COMBI,
  scopesVoorType,
  type WerkbankScopeId,
  type WerkbankType,
} from "@/lib/werkbank";
import { useWerkbank } from "./use-werkbank";
import { WerkbankKlantSectie } from "./werkbank-klant-sectie";
import {
  WerkbankGarantie,
  WerkbankOmstandigheden,
} from "./werkbank-instellingen";
import { WerkbankPalet } from "./werkbank-palet";
import { WerkbankScopeBlok } from "./werkbank-scope-blok";
import { WerkbankSuccesDialog } from "./werkbank-succes-dialog";

const TITEL: Record<WerkbankType, string> = {
  aanleg: "Aanleg",
  onderhoud: "Onderhoud",
};

export function Werkbank({ type }: { type: WerkbankType }) {
  const wb = useWerkbank(type);

  // Validatiemeldingen per scope komen uit de formulieren zelf; het werkblad
  // gebruikt ze alleen om een scope als "nog gegevens nodig" te markeren.
  const [, setVeldFouten] = useState<Record<string, Record<string, string>>>({});
  const validatieHandlers = useMemo(() => {
    const handlers: Record<
      string,
      (isValid: boolean, errors: Record<string, string>) => void
    > = {};
    scopesVoorType(type).forEach((scope) => {
      handlers[scope.id] = (_isValid, errors) =>
        setVeldFouten((huidig) =>
          JSON.stringify(huidig[scope.id]) === JSON.stringify(errors)
            ? huidig
            : { ...huidig, [scope.id]: errors }
        );
    });
    return handlers;
  }, [type]);

  const wisselScope = wb.wisselScope;
  const voegScopesToe = wb.voegScopesToe;

  const renovatie = useCallback(
    () => voegScopesToe(RENOVATIE_COMBI.scopes),
    [voegScopesToe]
  );

  // Lettertoetsen: dezelfde letters als in het palet, en ze werken niet
  // terwijl je in een invoerveld staat (useKeyboardShortcuts regelt dat).
  const sneltoetsen = useMemo(
    () => [
      ...scopesVoorType(type).map((scope) => ({
        key: scope.toets,
        action: () => wisselScope(scope.id),
        description: `${scope.naam} toevoegen of weghalen`,
      })),
      ...(type === "aanleg"
        ? [
            {
              key: RENOVATIE_COMBI.toets,
              action: renovatie,
              description: "Renovatiepakket toevoegen",
            },
          ]
        : []),
    ],
    [type, wisselScope, renovatie]
  );
  useKeyboardShortcuts(sneltoetsen);

  return (
    <>
      <PageHeader />

      <div className="@container/werkbank flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Masthead
          type={type}
          offerteNummer={wb.offerteNummer}
          klantNaam={wb.klant.naam}
          opslagStatus={wb.opslagStatus}
          opgeslagenOm={wb.opgeslagenOm}
          aanmaakFout={wb.aanmaakFout}
        />

        <div className="flex flex-col gap-5 @min-[68rem]/werkbank:grid @min-[68rem]/werkbank:grid-cols-[minmax(0,1fr)_20.5rem] @min-[68rem]/werkbank:items-start @min-[68rem]/werkbank:gap-6">
          {/* Palet: op smalle schermen bóven het document, nooit weggelaten. */}
          <aside className="order-1 @min-[68rem]/werkbank:order-2 @min-[68rem]/werkbank:sticky @min-[68rem]/werkbank:top-4">
            <WerkbankPalet
              type={type}
              scopes={wb.scopes}
              onvolledig={wb.voortgang.onvolledig}
              onWissel={wisselScope}
              onRenovatie={renovatie}
              totalen={wb.totalen}
              aantalRegels={wb.regels.length}
              calculatieLaadt={wb.calculatieLaadt}
              klantCompleet={wb.voortgang.klantCompleet}
              heeftRegels={wb.voortgang.heeftRegels}
              kanDefinitief={wb.voortgang.kanDefinitief}
              afronden={wb.afronden}
              onDefinitief={wb.maakDefinitief}
              onBekijk={wb.naarOfferte}
            />
          </aside>

          <div className="order-2 min-w-0 space-y-3 @min-[68rem]/werkbank:order-1">
            <Reveel index={0}>
              <WerkbankKlantSectie
                klant={wb.klant}
                klantCompleet={wb.voortgang.klantCompleet}
                initialKlantId={wb.klantIdParam}
                initialLeadId={wb.leadIdParam}
                fout={wb.afrondFout}
                onVelden={wb.setKlantVelden}
                onKoppel={wb.kiesKlant}
                onLead={() => undefined}
              />
            </Reveel>

            <Reveel index={1}>
              <WerkbankOmstandigheden
                type={type}
                bereikbaarheid={wb.bereikbaarheid}
                achterstalligheid={wb.achterstalligheid}
                onBereikbaarheid={wb.setBereikbaarheid}
                onAchterstalligheid={wb.setAchterstalligheid}
              />
            </Reveel>

            {!wb.documentGereed ? (
              <div className="h-48 animate-pulse rounded-lg border bg-card" />
            ) : wb.scopes.length === 0 ? (
              <Reveel index={2}>
                <LegeStaat type={type} />
              </Reveel>
            ) : (
              <div className="space-y-5 pt-1">
                {wb.scopes.map((scope) => (
                  <WerkbankScopeBlok
                    key={`${scope}-${wb.hydratieVersie}`}
                    type={type}
                    scope={scope}
                    data={wb.scopeData[scope]}
                    compleet={wb.isScopeCompleet(scope)}
                    regels={wb.regelsPerScope.get(scope) ?? []}
                    onChange={(data) => wb.wijzigScopeData(scope, data)}
                    onValidationChange={validatieHandlers[scope]}
                    onVerwijder={() => wisselScope(scope as WerkbankScopeId)}
                  />
                ))}
              </div>
            )}

            {type === "onderhoud" && (
              <Reveel index={3}>
                <SectiePaneel
                  titel="Onderhoudscontract"
                  icoon={<Sprout />}
                  uitleg="Bouwstenen uit de catalogus: frequentie × prijs per beurt. De prijs wordt op offertedatum vastgelegd."
                  acties={
                    wb.catalogusTotalen.maandbedrag > 0 && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(wb.catalogusTotalen.maandbedrag)} p/m
                      </span>
                    )
                  }
                >
                  <div className="px-3 py-3">
                    <BouwstenenKiezer
                      bouwstenen={wb.bouwsteenDefaults}
                      catalogus={wb.catalogus}
                      setCatalogus={wb.setCatalogus}
                    />
                  </div>
                </SectiePaneel>
              </Reveel>
            )}

            {wb.vervallenDoorContract.length > 0 && (
              <p className="flex items-start gap-2 px-1 text-xs leading-4 text-muted-foreground">
                <Check aria-hidden className="mt-px size-3.5 shrink-0 text-primary" />
                <span>
                  {wb.vervallenDoorContract.join(", ")} staat al in het
                  onderhoudscontract — die regel is niet nog een keer
                  meegerekend.
                </span>
              </p>
            )}

            {type === "aanleg" && (
              <Reveel index={4}>
                <WerkbankGarantie
                  waarde={wb.garantieId}
                  onKies={wb.setGarantieId}
                />
              </Reveel>
            )}
          </div>
        </div>
      </div>

      <WerkbankSuccesDialog
        open={wb.succesOpen}
        onOpenChange={wb.setSuccesOpen}
        offerteId={wb.offerteId}
        offerteNummer={wb.offerteNummer}
      />
    </>
  );
}

/** Rustige, gestaggerde onthulling bij het openen van het werkblad. */
function Reveel({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </m.div>
  );
}

function Masthead({
  type,
  offerteNummer,
  klantNaam,
  opslagStatus,
  opgeslagenOm,
  aanmaakFout,
}: {
  type: WerkbankType;
  offerteNummer: string | null;
  klantNaam: string;
  opslagStatus: string;
  opgeslagenOm: Date | null;
  aanmaakFout: string | null;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b pb-4">
      <div className="min-w-0">
        <p className="text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
          Werkblad · {TITEL[type]}
        </p>
        <h1 className="mt-1 flex min-w-0 items-baseline gap-2.5 font-display text-[30px] leading-tight font-semibold tracking-tight">
          {offerteNummer ?? (
            <span className="inline-block h-[1em] w-[9ch] animate-pulse rounded bg-muted align-middle" />
          )}
          <span className="shrink-0 rounded bg-status-concept px-1.5 py-0.5 text-[11px] leading-4 font-medium text-status-concept-text">
            Concept
          </span>
        </h1>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {klantNaam || "Nog geen klant gekoppeld"}
        </p>
      </div>

      <div className="text-right text-xs text-muted-foreground">
        {aanmaakFout ? (
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="size-3.5" />
            {aanmaakFout}
          </span>
        ) : (
          <OpslagChip status={opslagStatus} opgeslagenOm={opgeslagenOm} />
        )}
      </div>
    </header>
  );
}

function OpslagChip({
  status,
  opgeslagenOm,
}: {
  status: string;
  opgeslagenOm: Date | null;
}) {
  const tijd = opgeslagenOm
    ? opgeslagenOm.toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        status === "fout" && "text-destructive"
      )}
    >
      {status === "bezig" ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          Opslaan…
        </>
      ) : status === "fout" ? (
        <>
          <AlertTriangle className="size-3" />
          Opslaan mislukt
        </>
      ) : tijd ? (
        <>
          <Check className="size-3 text-primary" />
          Opgeslagen om {tijd}
        </>
      ) : (
        <>
          <PenLine className="size-3" />
          Alles wordt automatisch bewaard
        </>
      )}
    </span>
  );
}

function LegeStaat({ type }: { type: WerkbankType }) {
  const eerste = scopesVoorType(type).slice(0, 3);
  return (
    <div className="rounded-lg border border-dashed px-4 py-6">
      <p className="font-display text-base font-semibold tracking-tight">
        Kies een werkzaamheid om te beginnen
      </p>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Elke werkzaamheid uit het palet zet zijn eigen invulblok in dit
        document. Vul type en oppervlakte in en de regels rekenen zichzelf uit
        op jullie normuren.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Sneltoets:
        {eerste.map((scope) => (
          <span key={scope.id} className="inline-flex items-center gap-1.5">
            <kbd className="flex size-5 items-center justify-center rounded border bg-background font-display text-[11px] leading-none font-semibold uppercase">
              {scope.toets}
            </kbd>
            {scope.naam}
          </span>
        ))}
      </p>
    </div>
  );
}
