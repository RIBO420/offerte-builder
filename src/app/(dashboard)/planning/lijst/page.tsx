"use client";

/**
 * Lijstweergave van afspraken (PRD bijlage B, fase 2 §2.5): derde, goedkope
 * weergave op dezelfde planbord-data als weekbord en dagkaart. Mijn (voorman:
 * eigen team) / Alle, filter op team/status/periode en sortering per kolom.
 * Geen nieuwe opslag: planbord.getBordContext + werkitems.listVoorPlanbord
 * via de bestaande adapter.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  LayoutGrid,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/use-current-user";
import { naarEvents } from "@/components/planbord/adapter";
import {
  eigenTeamIds,
  filterAfspraken,
  sorteerAfspraken,
  type LijstKolom,
  type LijstWeergave,
  type SorteerRichting,
} from "@/components/planbord/lijst";
import { maandagVan, vandaagIso } from "@/components/planbord/periode";
import { addDagen } from "@convex/planbordLogica";

const STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  afgerond: "Afgerond",
  uitgevoerd: "Uitgevoerd",
  deels_uitgevoerd: "Deels uitgevoerd",
  nacalculatie_compleet: "Nacalculatie",
  gefactureerd: "Gefactureerd",
  vervallen: "Vervallen",
  voorcalculatie: "Voorcalculatie",
};

const KOLOMMEN: { id: LijstKolom; label: string; uitlijning?: string }[] = [
  { id: "datum", label: "Datum" },
  { id: "naam", label: "Afspraak" },
  { id: "team", label: "Team" },
  { id: "status", label: "Status" },
  { id: "tijd", label: "Tijd" },
  { id: "uren", label: "Uren", uitlijning: "text-right" },
];

export default function LijstweergavePagina() {
  const { user } = useCurrentUser();

  // Default-periode: deze week + volgende week (zelfde horizon als het bord)
  const [van, setVan] = useState(() => maandagVan(vandaagIso()));
  const [tot, setTot] = useState(() => addDagen(maandagVan(vandaagIso()), 13));
  const [weergave, setWeergave] = useState<LijstWeergave>("alle");
  const [teamFilter, setTeamFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [sorteerKolom, setSorteerKolom] = useState<LijstKolom>("datum");
  const [richting, setRichting] = useState<SorteerRichting>("asc");

  const geldigePeriode = Boolean(van && tot && van <= tot);
  const queryArgs = geldigePeriode ? { start: van, eind: tot } : "skip";
  const context = useQuery(api.planbord.getBordContext, queryArgs as never);
  const werkitems = useQuery(api.werkitems.listVoorPlanbord, queryArgs as never);

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
    return sorteerAfspraken(gefilterd, sorteerKolom, richting, teamNamen);
  }, [
    werkitems,
    weergave,
    teamFilter,
    statusFilter,
    van,
    tot,
    eigenTeams,
    sorteerKolom,
    richting,
    teamNamen,
  ]);

  const handleSorteer = (kolom: LijstKolom) => {
    if (kolom === sorteerKolom) {
      setRichting((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSorteerKolom(kolom);
      setRichting("asc");
    }
  };

  const isLoading = context === undefined || werkitems === undefined;

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Afsprakenlijst
            </h1>
            <p className="text-muted-foreground">
              Dezelfde planning als het weekbord, als lijst — filter op team,
              status en periode; klik op een kolomkop om te sorteren.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/planning/weekbord">
                <LayoutGrid className="mr-2 h-4 w-4" />
                Weekbord
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/planning/dagkaart">
                <CalendarClock className="mr-2 h-4 w-4" />
                Dagkaart
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Tabs
            value={weergave}
            onValueChange={(v) => setWeergave(v as LijstWeergave)}
          >
            <TabsList>
              <TabsTrigger value="mijn" disabled={!medewerkerId}>
                Mijn
              </TabsTrigger>
              <TabsTrigger value="alle">Alle</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-1.5">
            <Label htmlFor="lijst-team">Team</Label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger id="lijst-team" className="w-44">
                <SelectValue placeholder="Alle teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle teams</SelectItem>
                {(context?.teams ?? []).map((team) => (
                  <SelectItem key={team._id} value={team._id}>
                    {team.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lijst-status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="lijst-status" className="w-44">
                <SelectValue placeholder="Alle statussen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle statussen</SelectItem>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <SelectItem key={status} value={status}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lijst-van">Van</Label>
            <Input
              id="lijst-van"
              type="date"
              value={van}
              onChange={(e) => setVan(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lijst-tot">Tot en met</Label>
            <Input
              id="lijst-tot"
              type="date"
              value={tot}
              onChange={(e) => setTot(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {!geldigePeriode ? (
              <p className="text-sm text-muted-foreground">
                Kies een geldige periode (van t/m tot).
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Afspraken laden…</p>
            ) : rijen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen afspraken in deze periode
                {weergave === "mijn" ? " voor jouw team" : ""}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {KOLOMMEN.map((kolom) => (
                        <TableHead key={kolom.id} className={kolom.uitlijning}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => handleSorteer(kolom.id)}
                            aria-label={`Sorteer op ${kolom.label}`}
                          >
                            {kolom.label}
                            {sorteerKolom === kolom.id ? (
                              richting === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : (
                                <ArrowDown className="size-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rijen.map((rij) => (
                      <TableRow key={rij.id}>
                        <TableCell>
                          {rij.start}
                          {rij.eind !== rij.start ? ` – ${rij.eind}` : ""}
                        </TableCell>
                        <TableCell className="font-medium">
                          {rij.titel}
                          {rij.type === "onderhoudsbeurt" && (
                            <Badge variant="outline" className="ml-2">
                              Beurt
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {rij.resourceId
                            ? (teamNamen[rij.resourceId] ?? "—")
                            : "Zonder team"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {STATUS_LABELS[rij.status] ?? rij.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rij.startTijd
                            ? `${rij.startTijd}${rij.eindTijd ? `–${rij.eindTijd}` : ""}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {rij.geschatteUren !== undefined
                            ? String(rij.geschatteUren).replace(".", ",")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
