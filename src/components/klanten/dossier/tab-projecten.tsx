"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { FolderKanban } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { formatCurrency } from "@/lib/format/currency";
import {
  getStatusConfig,
  statusClasses,
} from "@/lib/constants/statuses";
import { handleKeyboardActivation } from "@/lib/accessibility";
import { cn } from "@/lib/utils";

/**
 * Projecten — de klussen van deze klant.
 *
 * Vier kolommen zoals het prototype: Project / Planning / Status / Waarde.
 * Losse onderhoudsbeurten staan er bewust niet bij; die horen bij de
 * Onderhoud-tab (`projecten.listVoorKlant` filtert ze er serverzijde uit).
 *
 * Nooit zijwaarts scrollen: de tabel is `table-fixed` en de Planning-kolom
 * valt weg zodra het paneel smaller wordt dan 30rem — de planning staat dan
 * als tweede regel onder de projectnaam, zodat er geen informatie verdwijnt.
 */
export function TabProjecten({ klantId }: { klantId: Id<"klanten"> }) {
  const router = useRouter();
  const projecten = useQuery(api.projecten.listVoorKlant, { klantId });

  const isLeeg = projecten !== undefined && projecten.length === 0;

  return (
    <SectiePaneel
      titel="Projecten"
      icoon={<FolderKanban />}
      kopbalk
      telling={projecten?.length}
      uitleg="De projecten van deze klant, nieuwste eerst. Losse onderhoudsbeurten staan onder Onderhoud. Klik een regel om het project te openen."
      legeRegel={
        isLeeg
          ? {
              tekst: "Nog geen projecten voor deze klant.",
              hint: "Een project ontstaat zodra een offerte geaccepteerd wordt.",
            }
          : undefined
      }
    >
      {projecten === undefined ? (
        <LaadIndicator formaat="sectie" label="Projecten laden…" />
      ) : projecten.length === 0 ? null : (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Project
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 text-left font-medium @[30rem]/sectie:table-cell @[30rem]/sectie:w-[10rem]"
              >
                Planning
              </th>
              <th
                scope="col"
                className="w-[7.5rem] px-3 py-2 text-left font-medium"
              >
                Status
              </th>
              <th
                scope="col"
                className="w-[6.5rem] px-3 py-2 text-right font-medium"
              >
                Waarde
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {projecten.map((project) => {
              const config = getStatusConfig(project.status, "project");
              const planning = formatPlanning(
                project.geplandeStart,
                project.geplandeEind
              );
              const openen = () => router.push(`/projecten/${project._id}`);

              return (
                <tr
                  key={project._id}
                  role="button"
                  tabIndex={0}
                  onClick={openen}
                  onKeyDown={(e) => handleKeyboardActivation(e, openen)}
                  className="cursor-pointer transition-colors duration-100 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <td className="overflow-hidden px-3 py-2">
                    <span className="block truncate font-medium">
                      {project.naam}
                    </span>
                    {/* Zonder Planning-kolom mag de planning niet zoekraken. */}
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground @[30rem]/sectie:hidden">
                      {planning}
                    </span>
                  </td>
                  <td className="hidden overflow-hidden px-3 py-2 text-muted-foreground @[30rem]/sectie:table-cell">
                    <span className="block truncate">{planning}</span>
                  </td>
                  <td className="overflow-hidden px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium",
                        statusClasses(config)
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          config.color.dot
                        )}
                      />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                    {project.waarde === null
                      ? "—"
                      : formatCurrency(project.waarde)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SectiePaneel>
  );
}

/**
 * Planning in weeknummers, zoals kantoor hem uitspreekt ("week 36 t/m 38").
 * Beide velden zijn optioneel: het planbord vult ze pas bij het inplannen.
 */
function formatPlanning(start: string | null, eind: string | null): string {
  if (!start && !eind) return "Nog niet ingepland";

  const startWeek = start ? isoWeek(start) : null;
  const eindWeek = eind ? isoWeek(eind) : null;

  if (startWeek !== null && eindWeek !== null) {
    return startWeek === eindWeek
      ? `week ${startWeek}`
      : `week ${startWeek} t/m ${eindWeek}`;
  }
  if (startWeek !== null) return `vanaf week ${startWeek}`;
  if (eindWeek !== null) return `t/m week ${eindWeek}`;
  return "Nog niet ingepland";
}

/** ISO-weeknummer van een YYYY-MM-DD-datum; `null` bij een onleesbare waarde. */
function isoWeek(datum: string): number | null {
  const d = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  // Donderdag van dezelfde week bepaalt het ISO-jaar (ma=1 … zo=7).
  const donderdag = new Date(d);
  donderdag.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const eersteJanuari = new Date(donderdag.getFullYear(), 0, 1);
  return Math.ceil(
    ((donderdag.getTime() - eersteJanuari.getTime()) / 86400000 + 1) / 7
  );
}
