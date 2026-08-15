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
  voortgang: number;
  totaalUren: number;
  begroteUren: number;
}

/** "Wat loopt er nu, en hoe ver is het?" */
export function LopendWerkPaneel({ projecten }: { projecten: LopendProject[] }) {
  if (projecten.length === 0) {
    return (
      <SectiePaneel
        titel="Lopend werk"
        legeRegel={{
          tekst: "Geen projecten in uitvoering",
          hint: "Zodra een project start, staat de voortgang hier.",
        }}
        acties={<AlleLink href="/projecten" tekst="Alle projecten" />}
      />
    );
  }

  const zichtbaar = projecten.slice(0, MAX_PROJECTEN);

  return (
    <SectiePaneel
      titel="Lopend werk"
      telling={projecten.length}
      acties={<AlleLink href="/projecten" tekst="Alle projecten" />}
    >
      <ul className="divide-y divide-border/60">
        {zichtbaar.map((project) => {
          const pct = Math.min(100, Math.max(0, project.voortgang));
          return (
            <li key={project._id}>
              <Link
                href={`/projecten/${project._id}`}
                className="block px-3 py-2 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[13px] leading-5 font-medium">
                    {project.naam}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {project.klantNaam}
                    </span>
                  </p>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {pct}%
                  </span>
                </div>
                {/* Voortgang in accent-warm (terracotta): werk onderweg is geen
                    succes — groen blijft voorbehouden aan "afgerond". */}
                <div
                  className="mt-1 h-1 overflow-hidden rounded bg-accent-warm/15"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Voortgang ${project.naam}`}
                >
                  <div
                    className="h-full rounded bg-accent-warm transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
                  {project.totaalUren} / {project.begroteUren} uur
                </p>
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
}: {
  offertes: OfferteGebeurtenis[];
}) {
  if (offertes.length === 0) {
    return (
      <SectiePaneel
        titel="Laatste offertes"
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
              {/* Neutraal: de status zit al in de stip en het label. */}
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                {formatCurrency(offerte.totaal, "nl-NL", false)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectiePaneel>
  );
}
