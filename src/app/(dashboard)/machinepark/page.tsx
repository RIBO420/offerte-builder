"use client";

/**
 * Machinepark — module-pagina (PRD §3.3, fase 2 stap 3).
 *
 * Machines én bussen/voertuigen in één overzicht: naam, soort, kleurcode per
 * team, status (beschikbaar / in onderhoud / kapot), schaars-vlag en
 * vervalinfo. Detailkaart: standaardinventaris per bus (voedt de
 * delta-checklist §2.6) + vervalitems (APK/keuring/certificaat/verzekering).
 * Los overzicht "Verloopt binnenkort" en beheer van teamkleur + standaardbus
 * (bus-per-team-dag: override op het weekbord-domein via teamBusOverrides).
 *
 * Rollen: kantoor beheert, voorman/staf leest (server afgedwongen; de UI
 * verbergt beheeracties voor lezers).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useCurrentUserRole } from "@/hooks/use-users";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, Truck, Wrench } from "lucide-react";
import {
  MiddelDetailDialog,
  type MiddelRij,
  MIDDEL_STATUS_LABELS,
} from "@/components/machinepark/middel-detail-dialog";

const STATUS_BADGE_VARIANT: Record<string, string> = {
  beschikbaar:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  onderhoud:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  kapot: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  inactief: "bg-muted text-muted-foreground",
};

export default function MachineparkPage() {
  const role = useCurrentUserRole();
  const magBeheren =
    role === "directie" || role === "admin" || role === "projectleider";

  const overzicht = useQuery(api.machinepark.getOverzicht);
  const teamBussen = useQuery(api.machinepark.getTeamBussen);
  const binnenkort = useQuery(api.vervalItems.verlooptBinnenkort);

  const setTeamKleur = useMutation(api.machinepark.setTeamKleur);
  const setTeamStandaardBus = useMutation(api.machinepark.setTeamStandaardBus);

  const [detail, setDetail] = useState<MiddelRij | null>(null);
  const [soortFilter, setSoortFilter] = useState<string>("alle");

  const rijen = (overzicht ?? []).filter(
    (r) => soortFilter === "alle" || r.soort === soortFilter
  );
  const voertuigOpties = (overzicht ?? []).filter(
    (r) => r.soort === "voertuig" && r.status !== "inactief"
  );

  return (
    <>
      <PageHeader />
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-semibold">Machinepark</h1>
          <p className="text-sm text-muted-foreground">
            Machines en bussen in één overzicht: status, teamkleur,
            standaardinventaris per bus en vervalitems (APK, keuring,
            verzekering). Kapot materieel geeft een waarschuwing op het
            weekbord.
          </p>
        </div>

        {/* Verloopt binnenkort */}
        {(binnenkort?.length ?? 0) > 0 && (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            <p className="mb-1 flex items-center gap-1 font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Verloopt binnenkort
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-xs">
              {binnenkort!.map((item) => (
                <li key={item._id}>
                  {item.tekst}
                  {item.objectNaam ? ` — ${item.objectNaam}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs defaultValue="overzicht">
          <TabsList>
            <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
            <TabsTrigger value="teams">Teams &amp; bussen</TabsTrigger>
          </TabsList>

          {/* ── Overzicht ── */}
          <TabsContent value="overzicht" className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={soortFilter} onValueChange={setSoortFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Soort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alles</SelectItem>
                  <SelectItem value="voertuig">Bussen/voertuigen</SelectItem>
                  <SelectItem value="machine">Machines</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {overzicht === undefined ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : rijen.length === 0 ? (
              <EmptyState
                icon={<Truck aria-hidden />}
                title="Nog geen materieel"
                description="Voeg voertuigen toe via Wagenparkbeheer of machines via Machinebeheer; ze verschijnen hier automatisch."
              />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Soort</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Schaars</TableHead>
                      <TableHead>Verval</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rijen.map((rij) => (
                      <TableRow key={`${rij.soort}:${rij.id}`}>
                        <TableCell>
                          <span className="font-medium">{rij.naam}</span>
                          {rij.subtitel && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {rij.subtitel}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {rij.soort === "voertuig" ? (
                              <Truck className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Wrench className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {rij.soort === "voertuig" ? "Voertuig" : "Machine"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={STATUS_BADGE_VARIANT[rij.status]}
                            variant="outline"
                          >
                            {MIDDEL_STATUS_LABELS[rij.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rij.teamNaam ? (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span
                                aria-hidden
                                className="inline-block h-2.5 w-2.5 rounded-full border"
                                style={{
                                  backgroundColor: rij.teamKleur ?? "transparent",
                                }}
                              />
                              {rij.teamNaam}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rij.schaars ? (
                            <Badge variant="outline">Schaars</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rij.eerstvolgendeVervaldatum ? (
                            <span
                              className={
                                rij.vervalBinnenTermijn > 0
                                  ? "text-xs font-medium text-amber-700 dark:text-amber-300"
                                  : "text-xs text-muted-foreground"
                              }
                            >
                              {rij.eerstvolgendeVervaldatum}
                              {rij.vervalBinnenTermijn > 0 && " (binnenkort)"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDetail(rij)}
                          >
                            {magBeheren ? "Beheer" : "Details"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── Teams & bussen ── */}
          <TabsContent value="teams" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vaste standaardbus en kleurcode per team. De delta-checklist
              (route-knop veld) gebruikt: dag-override → standaardbus →
              eerste toegewezen voertuig van het werkitem.
            </p>
            {teamBussen === undefined ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : teamBussen.length === 0 ? (
              <EmptyState
                icon={<Truck aria-hidden />}
                title="Nog geen actieve teams"
                description="Maak eerst een team aan bij Medewerkers."
              />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Kleurcode</TableHead>
                      <TableHead>Standaardbus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamBussen.map((team) => (
                      <TableRow key={team.teamId}>
                        <TableCell className="font-medium">{team.naam}</TableCell>
                        <TableCell>
                          <input
                            type="color"
                            aria-label={`Kleurcode team ${team.naam}`}
                            className="h-7 w-12 cursor-pointer rounded border bg-transparent disabled:cursor-not-allowed"
                            value={team.kleur ?? "#94a3b8"}
                            disabled={!magBeheren}
                            onChange={(e) =>
                              setTeamKleur({
                                teamId: team.teamId,
                                kleur: e.target.value,
                              }).catch(() =>
                                toast.error("Kleur opslaan mislukt")
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {magBeheren ? (
                            <Select
                              value={team.standaardVoertuigId?.toString() ?? "geen"}
                              onValueChange={(waarde) =>
                                setTeamStandaardBus({
                                  teamId: team.teamId,
                                  voertuigId:
                                    waarde === "geen"
                                      ? null
                                      : (waarde as Id<"voertuigen">),
                                })
                                  .then(() => toast.success("Standaardbus opgeslagen"))
                                  .catch(() =>
                                    toast.error("Standaardbus opslaan mislukt")
                                  )
                              }
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue placeholder="Geen standaardbus" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="geen">Geen standaardbus</SelectItem>
                                {voertuigOpties.map((vt) => (
                                  <SelectItem key={vt.id} value={vt.id}>
                                    {vt.naam}
                                    {vt.subtitel ? ` (${vt.subtitel})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">
                              {team.standaardBusNaam ?? "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <MiddelDetailDialog
        middel={detail}
        magBeheren={magBeheren}
        teams={teamBussen ?? []}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
