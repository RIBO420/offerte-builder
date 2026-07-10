"use client";

/**
 * Dialogen van het weekbord (PRD §2.2): dupliceren, splitsen, bemanning
 * per team-dag, afwezigheidsblokken en het ziekte/uitval-scenario.
 * Alle mutaties lopen via convex/planbord.ts (kantoor-only, audit-gelogd).
 */

import { useEffect, useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanbordResource, PlanbordEvent } from "./adapter";

// ============================================
// Dupliceren (behoud van team en tijden — wens Yannick)
// ============================================

export function DupliceerDialog({
  event,
  onSluit,
  onDupliceer,
}: {
  event: PlanbordEvent | null;
  onSluit: () => void;
  onDupliceer: (id: Id<"projecten">, doelDatum: string) => Promise<void>;
}) {
  const [datum, setDatum] = useState("");
  const [bezig, setBezig] = useState(false);
  useEffect(() => setDatum(""), [event]);

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onSluit()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dupliceren naar andere dag</DialogTitle>
          <DialogDescription>
            {event?.titel} wordt gekopieerd met behoud van team en tijden;
            alleen de dag verschuift.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dupliceer-datum">Doeldag</Label>
          <Input
            id="dupliceer-datum"
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onSluit}>
            Annuleren
          </Button>
          <Button
            disabled={!datum || bezig}
            onClick={async () => {
              if (!event) return;
              setBezig(true);
              try {
                await onDupliceer(event.id, datum);
                onSluit();
              } finally {
                setBezig(false);
              }
            }}
          >
            Dupliceren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Splitsen over meerdere dagen of teams
// ============================================

interface SplitsDeelInvoer {
  geplandeStart: string;
  geplandeEind: string;
  teamId: string; // "" = team van het origineel
}

export function SplitsDialog({
  event,
  resources,
  onSluit,
  onSplits,
}: {
  event: PlanbordEvent | null;
  resources: PlanbordResource[];
  onSluit: () => void;
  onSplits: (
    id: Id<"projecten">,
    delen: { geplandeStart: string; geplandeEind?: string; teamId?: Id<"teams"> }[]
  ) => Promise<void>;
}) {
  const [delen, setDelen] = useState<SplitsDeelInvoer[]>([]);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (event) {
      setDelen([
        { geplandeStart: event.start, geplandeEind: event.start, teamId: "" },
        { geplandeStart: "", geplandeEind: "", teamId: "" },
      ]);
    }
  }, [event]);

  const geldig = delen.length >= 2 && delen.every((d) => d.geplandeStart);

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onSluit()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Splitsen</DialogTitle>
          <DialogDescription>
            Verdeel “{event?.titel}” over meerdere dagen of teams. Deel 1 is
            het origineel; elk volgend deel wordt een kopie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {delen.map((deel, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Deel {i + 1} — start</Label>
                <Input
                  type="date"
                  value={deel.geplandeStart}
                  onChange={(e) =>
                    setDelen((d) =>
                      d.map((x, j) => (j === i ? { ...x, geplandeStart: e.target.value } : x))
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Eind</Label>
                <Input
                  type="date"
                  value={deel.geplandeEind}
                  onChange={(e) =>
                    setDelen((d) =>
                      d.map((x, j) => (j === i ? { ...x, geplandeEind: e.target.value } : x))
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Team</Label>
                <Select
                  value={deel.teamId || "zelfde"}
                  onValueChange={(waarde) =>
                    setDelen((d) =>
                      d.map((x, j) =>
                        j === i ? { ...x, teamId: waarde === "zelfde" ? "" : waarde } : x
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zelfde">Zelfde team</SelectItem>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.naam}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={delen.length <= 2}
                onClick={() => setDelen((d) => d.filter((_, j) => j !== i))}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDelen((d) => [...d, { geplandeStart: "", geplandeEind: "", teamId: "" }])
            }
          >
            + Deel toevoegen
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onSluit}>
            Annuleren
          </Button>
          <Button
            disabled={!geldig || bezig}
            onClick={async () => {
              if (!event) return;
              setBezig(true);
              try {
                await onSplits(
                  event.id,
                  delen.map((d) => ({
                    geplandeStart: d.geplandeStart,
                    geplandeEind: d.geplandeEind || undefined,
                    teamId: (d.teamId || undefined) as Id<"teams"> | undefined,
                  }))
                );
                onSluit();
              } finally {
                setBezig(false);
              }
            }}
          >
            Splitsen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Bemanning per team-dag (team ≠ kleurlabel, bijlage B)
// ============================================

export function BemanningDialog({
  doel,
  medewerkerNamen,
  huidige,
  bron,
  onSluit,
  onOpslaan,
  onHerstel,
}: {
  doel: { teamId: Id<"teams">; teamNaam: string; datum: string } | null;
  medewerkerNamen: Record<string, string>;
  huidige: Id<"medewerkers">[];
  bron: "default" | "aangepast";
  onSluit: () => void;
  onOpslaan: (
    teamId: Id<"teams">,
    datum: string,
    medewerkerIds: Id<"medewerkers">[]
  ) => Promise<void>;
  onHerstel: (teamId: Id<"teams">, datum: string) => Promise<void>;
}) {
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);
  useEffect(() => setSelectie(new Set(huidige)), [doel]); // eslint-disable-line react-hooks/exhaustive-deps

  const alleIds = Object.keys(medewerkerNamen);

  return (
    <Dialog open={doel !== null} onOpenChange={(open) => !open && onSluit()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bemanning {doel?.teamNaam} — {doel?.datum}
          </DialogTitle>
          <DialogDescription>
            Wie zit er deze dag in het team? Default = vaste teamleden
            {bron === "aangepast" ? " (deze dag is aangepast)" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {alleIds.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectie.has(id)}
                onCheckedChange={(aan) =>
                  setSelectie((s) => {
                    const kopie = new Set(s);
                    if (aan) kopie.add(id);
                    else kopie.delete(id);
                    return kopie;
                  })
                }
              />
              {medewerkerNamen[id]}
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={bezig || bron === "default"}
            onClick={async () => {
              if (!doel) return;
              setBezig(true);
              try {
                await onHerstel(doel.teamId, doel.datum);
                onSluit();
              } finally {
                setBezig(false);
              }
            }}
          >
            Herstel vaste teamleden
          </Button>
          <Button
            disabled={bezig}
            onClick={async () => {
              if (!doel) return;
              setBezig(true);
              try {
                await onOpslaan(
                  doel.teamId,
                  doel.datum,
                  [...selectie] as Id<"medewerkers">[]
                );
                onSluit();
              } finally {
                setBezig(false);
              }
            }}
          >
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Afwezigheidsblok (verlof/ziekte/feestdag) — fase 1 handmatig
// ============================================

export function AfwezigheidDialog({
  open,
  resources,
  medewerkerNamen,
  onSluit,
  onOpslaan,
}: {
  open: boolean;
  resources: PlanbordResource[];
  medewerkerNamen: Record<string, string>;
  onSluit: () => void;
  onOpslaan: (invoer: {
    medewerkerId?: Id<"medewerkers">;
    teamId?: Id<"teams">;
    startDatum: string;
    eindDatum: string;
    reden: "verlof" | "ziekte" | "feestdag" | "overig";
    omschrijving?: string;
  }) => Promise<void>;
}) {
  const [scope, setScope] = useState("");
  const [startDatum, setStartDatum] = useState("");
  const [eindDatum, setEindDatum] = useState("");
  const [reden, setReden] = useState<"verlof" | "ziekte" | "feestdag" | "overig">("verlof");
  const [omschrijving, setOmschrijving] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (open) {
      setScope("");
      setStartDatum("");
      setEindDatum("");
      setReden("verlof");
      setOmschrijving("");
    }
  }, [open]);

  const geldig = scope && startDatum && eindDatum && eindDatum >= startDatum;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSluit()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Afwezigheid plaatsen</DialogTitle>
          <DialogDescription>
            Niet-klant-blok dat capaciteit blokkeert (verlof, ziekte,
            feestdag). Geldt voor één medewerker of een heel team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Wie</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger>
                <SelectValue placeholder="Kies medewerker of team" />
              </SelectTrigger>
              <SelectContent>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={`team:${r.id}`}>
                    Heel team: {r.naam}
                  </SelectItem>
                ))}
                {Object.entries(medewerkerNamen).map(([id, naam]) => (
                  <SelectItem key={id} value={`medewerker:${id}`}>
                    {naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Van</Label>
              <Input type="date" value={startDatum} onChange={(e) => setStartDatum(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tot en met</Label>
              <Input type="date" value={eindDatum} onChange={(e) => setEindDatum(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Reden</Label>
            <Select value={reden} onValueChange={(w) => setReden(w as typeof reden)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verlof">Verlof</SelectItem>
                <SelectItem value="ziekte">Ziekte</SelectItem>
                <SelectItem value="feestdag">Feestdag</SelectItem>
                <SelectItem value="overig">Overig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Omschrijving (optioneel)</Label>
            <Input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onSluit}>
            Annuleren
          </Button>
          <Button
            disabled={!geldig || bezig}
            onClick={async () => {
              setBezig(true);
              try {
                const [soort, id] = scope.split(":");
                await onOpslaan({
                  medewerkerId:
                    soort === "medewerker" ? (id as Id<"medewerkers">) : undefined,
                  teamId: soort === "team" ? (id as Id<"teams">) : undefined,
                  startDatum,
                  eindDatum,
                  reden,
                  omschrijving: omschrijving || undefined,
                });
                onSluit();
              } finally {
                setBezig(false);
              }
            }}
          >
            Plaatsen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Ziekte/uitval: team van een dag loskoppelen
// ============================================

export function UitvalAlert({
  doel,
  onSluit,
  onBevestig,
}: {
  doel: { teamId: Id<"teams">; teamNaam: string; datum: string } | null;
  onSluit: () => void;
  onBevestig: (teamId: Id<"teams">, datum: string) => Promise<void>;
}) {
  const [bezig, setBezig] = useState(false);
  return (
    <AlertDialog open={doel !== null} onOpenChange={(open) => !open && onSluit()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Team {doel?.teamNaam} loskoppelen van {doel?.datum}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ziekte/uitval-scenario: alle werkitems van dit team op deze dag
            gaan in één keer terug in de opdrachtenbak, zodat je ze over
            andere teams kunt herverdelen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={bezig}
            onClick={async (e) => {
              e.preventDefault();
              if (!doel) return;
              setBezig(true);
              try {
                await onBevestig(doel.teamId, doel.datum);
                onSluit();
              } finally {
                setBezig(false);
              }
            }}
          >
            Loskoppelen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
