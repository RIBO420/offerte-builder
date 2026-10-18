"use client";

import Link from "next/link";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { STATUS_GEBEURTENIS, STATUS_STIP } from "./status-tokens";

/** Wat één cel comfortabel toont zonder de rij hoger te maken dan zijn buur. */
const MAX_PROJECTEN = 4;
const MAX_OFFERTES = 5;

/**
 * De doorklik in de kop. In een smalle cel valt het label weg en blijft alleen
 * de pijl staan: "Alle offertes →" wikkelde daar over twee regels en duwde de
 * kop scheef. Een woord inkorten hielp niet — "Alle" onder "Conversie" leest
 * als een halve zin. De naam blijft in `title` en voor schermlezers staan, en
 * het klikvlak blijft 24×24 (WCAG 2.5.8).
 */
export function AlleLink({ href, tekst }: { href: string; tekst: string }) {
  return (
    <Link
      href={href}
      title={tekst}
      className="inline-flex min-h-6 min-w-6 items-center justify-end gap-1 whitespace-nowrap text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="sr-only @[22rem]/sectie:not-sr-only">{tekst}</span>
      <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}

// ── Lopend werk ─────────────────────────────────────────────────────────────

export interface LopendProject {
  _id: string;
  naam: string;
  klantNaam: string;
  voortgang: number | null;
  totaalUren: number | null;
  begroteUren: number;
}

/** Uren in Nederlandse notatie: 17,6 — niet 17.6. */
function uren(waarde: number): string {
  return waarde.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

/**
 * "Wat loopt er nu, en hoe ver is het?"
 *
 * Per project één rij: naam en klant, de urenbalk met de stand, en het
 * percentage rechts als ankerpunt. Gaat een project over zijn begroting, dan
 * zegt de rij dat met tekst én een gearceerde balk — kleur is nooit het enige
 * signaal. `samenvatting` (dashboard A) zet de projecttellers in de kop.
 */
export function LopendWerkPaneel({
  projecten,
  samenvatting,
}: {
  projecten: LopendProject[];
  samenvatting?: { afgerond: number; totaal: number };
}) {
  const kopActies = (
    <>
      {samenvatting && (
        <span className="hidden truncate text-[11px] text-muted-foreground tabular-nums @[22rem]/sectie:inline">
          {samenvatting.afgerond} afgerond · {samenvatting.totaal} totaal
        </span>
      )}
      <AlleLink href="/projecten" tekst="Alle projecten" />
    </>
  );

  if (projecten.length === 0) {
    return (
      <SectiePaneel
        titel="Lopend werk"
        kopbalk={!!samenvatting}
        legeRegel={{
          tekst: "Geen projecten in uitvoering",
          hint: "Zodra een project start, staat de voortgang hier.",
        }}
        acties={kopActies}
      />
    );
  }

  const zichtbaar = projecten.slice(0, MAX_PROJECTEN);

  return (
    <SectiePaneel
      titel="Lopend werk"
      kopbalk={!!samenvatting}
      telling={projecten.length}
      acties={kopActies}
    >
      <ul className="divide-y divide-border/60">
        {zichtbaar.map((project) => {
          const pct = project.voortgang === null ? null : Math.min(100, Math.max(0, project.voortgang));
          const over =
            project.totaalUren !== null &&
            project.begroteUren > 0 &&
            project.totaalUren > project.begroteUren
              ? project.totaalUren - project.begroteUren
              : 0;
          const getoondPct =
            over > 0 && project.totaalUren !== null
              ? Math.round((project.totaalUren / project.begroteUren) * 100)
              : pct;
          return (
            <li key={project._id}>
              <Link
                href={`/projecten/${project._id}${pct === null ? "/nacalculatie" : ""}`}
                // Twee rijen in een smalle cel (naam boven, balk eronder),
                // drie kolommen zodra er ruimte is. Container-query: het paneel
                // staat in een kolom, niet in de viewport.
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-3 py-2.5 transition-colors hover:bg-accent/40 @[34rem]/sectie:grid-cols-[minmax(0,1fr)_11rem_3rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] leading-5 font-medium" title={project.naam}>
                    {project.naam}
                  </p>
                  <p className="truncate text-xs leading-4 text-muted-foreground" title={project.klantNaam}>
                    {project.klantNaam}
                  </p>
                </div>

                <span
                  className={`text-right text-[13px] font-semibold tabular-nums @[34rem]/sectie:col-start-3 @[34rem]/sectie:row-start-1 ${
                    over > 0 ? "text-status-vervallen-text" : ""
                  }`}
                >
                  {getoondPct === null ? "Urenbron kiezen" : `${getoondPct}%`}
                </span>

                <div className="col-span-2 flex flex-col gap-1 @[34rem]/sectie:col-span-1 @[34rem]/sectie:col-start-2 @[34rem]/sectie:row-start-1">
                  {/* Voortgang in accent-warm (terracotta): werk onderweg is geen
                      succes — groen blijft voorbehouden aan "afgerond". Over de
                      begroting: dezelfde kleur, maar gearceerd. */}
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-accent-warm/15"
                    hidden={pct === null}
                    role="progressbar"
                    aria-valuenow={pct ?? undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Voortgang ${project.naam}`}
                  >
                    <div
                      className="h-full rounded-full bg-accent-warm transition-[width] duration-500 ease-standaard motion-reduce:transition-none"
                      style={{
                        width: `${pct ?? 0}%`,
                        backgroundImage:
                          over > 0
                            ? "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklch, var(--background) 35%, transparent) 4px 8px)"
                            : undefined,
                      }}
                    />
                  </div>
                  <p
                    className={`text-[11px] leading-4 tabular-nums ${
                      over > 0 ? "text-status-vervallen-text" : "text-muted-foreground"
                    }`}
                  >
                    {project.totaalUren === null
                      ? "Urenbron ontbreekt"
                      : `${uren(project.totaalUren)} van ${uren(project.begroteUren)} uur${
                          over > 0 ? ` · ${uren(over)} u over` : ""
                        }`}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {projecten.length > zichtbaar.length && (
        <div className="border-t px-3 py-1">
          <AlleLink
            href="/projecten"
            tekst={`Nog ${projecten.length - zichtbaar.length} lopend`}
          />
        </div>
      )}
    </SectiePaneel>
  );
}

// ── Laatste offertes ────────────────────────────────────────────────────────

export interface OfferteGebeurtenis {
  _id: string;
  offerteNummer: string;
  klantNaam: string;
  status: string;
  totaal: number;
  updatedAt: number;
}

/** "Wat is er als laatste met mijn offertes gebeurd?" */
export function LaatsteOffertesPaneel({
  offertes,
  kopbalk = false,
}: {
  offertes: OfferteGebeurtenis[];
  /** Dashboard A: zelfde kop als de andere panelen in de geldkolom. */
  kopbalk?: boolean;
}) {
  if (offertes.length === 0) {
    return (
      <SectiePaneel
        titel="Laatste offertes"
        kopbalk={kopbalk}
        legeRegel={{
          tekst: "Nog geen offertes",
          hint: "De laatste wijzigingen aan je offertes verschijnen hier.",
        }}
        acties={<AlleLink href="/offertes" tekst="Alle offertes" />}
      />
    );
  }

  return (
    <SectiePaneel
      titel="Laatste offertes"
      kopbalk={kopbalk}
      acties={<AlleLink href="/offertes" tekst="Alle offertes" />}
    >
      <ul className="divide-y divide-border/60">
        {offertes.slice(0, MAX_OFFERTES).map((offerte) => (
          <li key={offerte._id}>
            <Link
              href={`/offertes/${offerte._id}`}
              className="flex items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-accent/40"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    STATUS_STIP[offerte.status] ?? "var(--status-concept-dot)",
                }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 @[24rem]/sectie:flex @[24rem]/sectie:items-baseline @[24rem]/sectie:gap-2">
                <p className="truncate text-[13px] leading-5 font-medium @[24rem]/sectie:shrink-0">
                  {STATUS_GEBEURTENIS[offerte.status] ?? offerte.status}
                </p>
                <p
                  className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground @[24rem]/sectie:leading-5"
                  title={`${offerte.offerteNummer} · ${offerte.klantNaam}`}
                >
                  {offerte.offerteNummer} · {formatRelativeTime(offerte.updatedAt)}
                </p>
              </div>
              {/* Neutraal: de status zit al in de stip en het label. Een
                  afgewezen bedrag telt niet meer mee — doorgestreept en gedempt,
                  zodat de kolom alleen levend geld als vol cijfer toont. */}
              <span
                className={`shrink-0 text-[13px] tabular-nums ${
                  offerte.status === "afgewezen"
                    ? "text-muted-foreground line-through decoration-muted-foreground/50"
                    : "font-semibold"
                }`}
              >
                {formatCurrency(offerte.totaal, "nl-NL", false)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectiePaneel>
  );
}
