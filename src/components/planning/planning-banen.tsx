"use client";

/**
 * Planningsoverzicht variant A (okt 2026): drie banen, van links naar rechts
 * de weg die een project aflegt — nog geen datum → ingepland → in uitvoering.
 *
 * De vorige versie groepeerde projecten op de week waarin ze waren
 * **aangemaakt** ("Week 38 – 14 sep") en las daardoor als een planning die er
 * niet was. De baan volgt nu de werkelijke stand: de status en de datums van
 * het weekbord.
 */

import Link from "next/link";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { kolomLabel } from "@/components/planbord/periode";

export interface PlanningProject {
  projectId: string;
  projectNaam: string;
  klantNaam: string;
  status: string;
  geplandeUren: number;
  gewerktUren: number;
  totaalTaken: number;
  afgerondeTaken: number;
  geschatteDagen: number;
  teamleden: string[];
  geplandeStart: string | null;
  geplandeEind: string | null;
  teamNaam: string | null;
}

export interface PlanningBanenIndeling {
  zonderDatum: PlanningProject[];
  ingepland: PlanningProject[];
  inUitvoering: PlanningProject[];
  /** Ingepland, einddatum voorbij en nog niet gestart. Zit ook in `ingepland`. */
  verlopen: PlanningProject[];
}

/**
 * Verdeelt projecten over de drie banen. Pure functie: `vandaag` als
 * `YYYY-MM-DD`, zodat de grens (wat is verlopen) testbaar is.
 */
export function verdeelOverBanen(
  projecten: PlanningProject[],
  vandaag: string
): PlanningBanenIndeling {
  const indeling: PlanningBanenIndeling = {
    zonderDatum: [],
    ingepland: [],
    inUitvoering: [],
    verlopen: [],
  };

  for (const project of projecten) {
    if (project.status === "in_uitvoering") {
      indeling.inUitvoering.push(project);
    } else if (project.geplandeStart) {
      indeling.ingepland.push(project);
      if ((project.geplandeEind ?? project.geplandeStart) < vandaag) {
        indeling.verlopen.push(project);
      }
    } else {
      indeling.zonderDatum.push(project);
    }
  }

  // Ingepland op datum, eerstvolgende bovenaan; de rest op naam.
  indeling.ingepland.sort((a, b) =>
    (a.geplandeStart ?? "").localeCompare(b.geplandeStart ?? "")
  );
  indeling.zonderDatum.sort((a, b) => a.projectNaam.localeCompare(b.projectNaam, "nl"));
  indeling.inUitvoering.sort((a, b) => a.projectNaam.localeCompare(b.projectNaam, "nl"));

  return indeling;
}

/** Uren in Nederlandse notatie: 17,6 — niet 17.6. */
function uren(waarde: number): string {
  return waarde.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

function ploegTekst(project: PlanningProject): string | null {
  if (project.teamNaam) return project.teamNaam;
  if (project.teamleden.length === 0) return null;
  const eerste = project.teamleden.slice(0, 2).join(", ");
  return project.teamleden.length > 2 ? `${eerste} +${project.teamleden.length - 2}` : eerste;
}

function dagenTekst(dagen: number): string | null {
  if (dagen <= 0) return null;
  const afgerond = Math.round(dagen);
  return afgerond <= 1 ? "≈ 1 dag" : `≈ ${afgerond} dgn`;
}

// ── Banen ───────────────────────────────────────────────────────────────────

function Baan({
  titel,
  stip,
  uitleg,
  aantal,
  legeTekst,
  children,
}: {
  titel: string;
  /** Tailwind-klasse van de stip in de kop (status-dot-token). */
  stip: string;
  uitleg: string;
  aantal: number;
  legeTekst: string;
  children: React.ReactNode;
}) {
  return (
    <SectiePaneel
      titel={titel}
      kopbalk
      telling={aantal}
      icoon={<span className={`block size-2 rounded-full ${stip}`} />}
    >
      <p className="px-3 pt-2 text-xs text-muted-foreground">{uitleg}</p>
      {aantal === 0 ? (
        <p className="px-3 pt-2 pb-3 text-[13px] text-muted-foreground">{legeTekst}</p>
      ) : (
        <ul className="flex flex-col p-1">{children}</ul>
      )}
    </SectiePaneel>
  );
}

function ZonderDatumRij({ project }: { project: PlanningProject }) {
  const ploeg = ploegTekst(project);
  const dagen = dagenTekst(project.geschatteDagen);
  return (
    <li className="flex flex-col gap-1.5 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent/40">
      <Link href={`/projecten/${project.projectId}/planning`} className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={project.projectNaam}>
          {project.projectNaam}
        </span>
        {dagen && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{dagen}</span>
        )}
      </Link>
      <p className="truncate text-xs text-muted-foreground">
        {[project.klantNaam, ploeg].filter(Boolean).join(" · ")}
      </p>
      <Link
        href="/planning/weekbord"
        className="inline-flex h-8 items-center self-start rounded-md border border-primary/45 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        Inplannen op weekbord
      </Link>
    </li>
  );
}

function IngeplandRij({
  project,
  verlopen,
}: {
  project: PlanningProject;
  verlopen: boolean;
}) {
  const start = kolomLabel(project.geplandeStart!);
  const eind =
    project.geplandeEind && project.geplandeEind !== project.geplandeStart
      ? kolomLabel(project.geplandeEind)
      : null;
  const [startDag, startMaand] = start.datum.split(" ");
  const ploeg = ploegTekst(project);

  return (
    <li>
      <Link
        href={`/projecten/${project.projectId}/planning`}
        className="flex gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent/40"
      >
        {/* Datumtegel: de startdag als anker van de rij. Verlopen = gestippeld
            en gedempt, plus tekst — kleur is nooit het enige signaal. */}
        <span
          className={`flex w-[52px] shrink-0 flex-col items-center justify-center rounded-lg border py-1.5 leading-tight ${
            verlopen
              ? "border-dashed border-accent-warm/60 bg-muted text-muted-foreground"
              : "border-status-gepland-border bg-status-gepland"
          }`}
        >
          <span className={`text-[11px] ${verlopen ? "" : "text-status-gepland-text"}`}>{start.dag}</span>
          <span className="text-[17px] font-semibold tabular-nums">{startDag}</span>
          <span className={`text-[11px] ${verlopen ? "" : "text-status-gepland-text"}`}>{startMaand}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold" title={project.projectNaam}>
            {project.projectNaam}
          </span>
          <span
            className={`truncate text-xs tabular-nums ${
              verlopen ? "text-status-vervallen-text" : "text-muted-foreground"
            }`}
          >
            {[
              eind ? `t/m ${eind.dag} ${eind.datum}` : `${start.dag} ${start.datum}`,
              verlopen ? "verlopen, niet gestart" : ploeg,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              project.klantNaam,
              verlopen ? ploeg : null,
              project.totaalTaken > 0
                ? `${project.totaalTaken} ${project.totaalTaken === 1 ? "taak" : "taken"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </Link>
    </li>
  );
}

function InUitvoeringRij({ project }: { project: PlanningProject }) {
  const over =
    project.geplandeUren > 0 && project.gewerktUren > project.geplandeUren
      ? project.gewerktUren - project.geplandeUren
      : 0;
  const pct =
    project.geplandeUren > 0
      ? Math.round((project.gewerktUren / project.geplandeUren) * 100)
      : null;
  const ploeg = ploegTekst(project);

  return (
    <li>
      <Link
        href={`/projecten/${project.projectId}/planning`}
        className="flex flex-col gap-1.5 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent/40"
      >
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={project.projectNaam}>
            {project.projectNaam}
          </span>
          <span
            className={`shrink-0 text-[13px] font-semibold tabular-nums ${
              over > 0 ? "text-status-vervallen-text" : ""
            }`}
          >
            {pct === null ? "—" : `${pct}%`}
          </span>
        </span>
        {/* Uren tegen begroting, zelfde maat als "Lopend werk" op het dashboard.
            Terracotta: werk onderweg is geen succes. Over de begroting:
            gearceerd én in tekst. */}
        <span
          className="block h-1.5 overflow-hidden rounded-full bg-accent-warm/15"
          role="progressbar"
          aria-valuenow={Math.min(100, pct ?? 0)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uren ${project.projectNaam}`}
        >
          <span
            className="block h-full rounded-full bg-accent-warm"
            style={{
              width: `${Math.min(100, pct ?? 0)}%`,
              backgroundImage:
                over > 0
                  ? "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklch, var(--background) 35%, transparent) 4px 8px)"
                  : undefined,
            }}
          />
        </span>
        <span
          className={`truncate text-xs tabular-nums ${
            over > 0 ? "text-status-vervallen-text" : "text-muted-foreground"
          }`}
        >
          {[
            `${uren(project.gewerktUren)} van ${uren(project.geplandeUren)} u`,
            over > 0 ? `${uren(over)} u over` : null,
            project.totaalTaken > 0
              ? `${project.afgerondeTaken} van ${project.totaalTaken} taken`
              : null,
            over > 0 ? null : ploeg,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </Link>
    </li>
  );
}

export function PlanningBanen({
  indeling,
}: {
  indeling: PlanningBanenIndeling;
}) {
  const verlopenIds = new Set(indeling.verlopen.map((p) => p.projectId));

  return (
    // Container-query: drie banen naast elkaar zodra er plek is, anders onder
    // elkaar in dezelfde volgorde. Nooit zijwaarts scrollen.
    <div className="@container/banen">
      <div className="grid grid-cols-1 items-start gap-4 @[54rem]/banen:grid-cols-3">
        <Baan
          titel="Nog geen datum"
          stip="bg-status-concept-dot"
          uitleg="Gepland als project, maar nog niet op het weekbord."
          aantal={indeling.zonderDatum.length}
          legeTekst="Alles heeft een datum."
        >
          {indeling.zonderDatum.map((project) => (
            <ZonderDatumRij key={project.projectId} project={project} />
          ))}
        </Baan>

        <Baan
          titel="Ingepland"
          stip="bg-status-gepland-dot"
          uitleg="Met datum op het weekbord, nog niet gestart."
          aantal={indeling.ingepland.length}
          legeTekst="Nog niets ingepland."
        >
          {indeling.ingepland.map((project) => (
            <IngeplandRij
              key={project.projectId}
              project={project}
              verlopen={verlopenIds.has(project.projectId)}
            />
          ))}
        </Baan>

        <Baan
          titel="In uitvoering"
          stip="bg-status-in-uitvoering-dot"
          uitleg="Uren tegen begroting; taken erachter."
          aantal={indeling.inUitvoering.length}
          legeTekst="Er loopt nu niets."
        >
          {indeling.inUitvoering.map((project) => (
            <InUitvoeringRij key={project.projectId} project={project} />
          ))}
        </Baan>
      </div>
    </div>
  );
}
