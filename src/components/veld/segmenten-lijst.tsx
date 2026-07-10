"use client";

/**
 * SegmentenLijst — urensegmenten van de veld-dag (PRD §2.6/§8.10).
 * Voorstellen komen uit de dagkaart-blokken (afgeleid tot bevestigd);
 * de medewerker bevestigt of corrigeert — loggen wordt bevestigen.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Check, CheckCheck, Plus, Trash2 } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VeldDagData = NonNullable<
  FunctionReturnType<typeof api.urenSegmenten.getVeldDag>
>;

const CATEGORIE_LABELS: Record<string, string> = {
  werken: "Werken",
  pauze: "Pauze",
  reistijd: "Reistijd",
  teammeeting: "Teammeeting",
  onderhoud_materiaal: "Onderhoud materiaal",
  afvalverwerker_bes: "Afvalverwerker (BES)",
  anders: "Anders",
};

export function SegmentenLijst({
  dag,
  datum,
  magBewerken,
  isKantoor,
  gekozenMedewerkerId,
}: {
  dag: VeldDagData;
  datum: string;
  magBewerken: boolean;
  isKantoor: boolean;
  gekozenMedewerkerId?: Id<"medewerkers">;
}) {
  const bevestigSegment = useMutation(api.urenSegmenten.bevestigSegment);
  const bevestigAlle = useMutation(api.urenSegmenten.bevestigAlleVoorstellen);
  const verwijderSegment = useMutation(api.urenSegmenten.verwijderSegment);

  const medewerkerArg = gekozenMedewerkerId
    ? { medewerkerId: gekozenMedewerkerId }
    : {};

  const stopNaam = (werkitemId: string | null | undefined) =>
    dag.stops.find((s) => s.werkitemId === werkitemId)?.klantNaam ??
    dag.stops.find((s) => s.werkitemId === werkitemId)?.naam ??
    null;

  const handleBevestigVoorstel = async (
    voorstel: VeldDagData["voorstellen"][number]
  ) => {
    try {
      await bevestigSegment({
        datum,
        categorie: voorstel.categorie,
        beginTijd: voorstel.beginTijd,
        eindTijd: voorstel.eindTijd,
        werkitemId: (voorstel.werkitemId as Id<"projecten"> | null) ?? undefined,
        bron: "voorstel",
        ...medewerkerArg,
      });
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Bevestigen is mislukt"
      );
    }
  };

  const handleBevestigAlle = async () => {
    try {
      const resultaat = await bevestigAlle({ datum, ...medewerkerArg });
      toast.success(`${resultaat.bevestigd} segmenten bevestigd`);
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Bevestigen is mislukt"
      );
    }
  };

  const handleVerwijder = async (id: Id<"urenSegmenten">) => {
    try {
      await verwijderSegment({ id });
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Verwijderen is mislukt"
      );
    }
  };

  return (
    <section aria-label="Urensegmenten" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Uren</h2>
        {magBewerken && (
          <div className="flex gap-2">
            {dag.voorstellen.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleBevestigAlle}>
                <CheckCheck className="mr-1 h-4 w-4" aria-hidden />
                Alles bevestigen ({dag.voorstellen.length})
              </Button>
            )}
            <NieuwSegmentDialog
              dag={dag}
              datum={datum}
              medewerkerArg={medewerkerArg}
            />
          </div>
        )}
      </div>

      {/* Voorgestelde segmenten uit de dagkaart (§8.10) */}
      {magBewerken && dag.voorstellen.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Voorgesteld uit je dagkaart — bevestig of corrigeer
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dag.voorstellen.map((voorstel, i) => (
              <div
                key={`${voorstel.beginTijd}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono">
                    {voorstel.beginTijd}–{voorstel.eindTijd}
                  </span>
                  <Badge variant="outline">
                    {CATEGORIE_LABELS[voorstel.categorie]}
                  </Badge>
                  {voorstel.werkitemId && (
                    <span className="text-muted-foreground">
                      {stopNaam(voorstel.werkitemId as string)}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBevestigVoorstel(voorstel)}
                >
                  <Check className="mr-1 h-4 w-4" aria-hidden />
                  Bevestig
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bevestigde/ingediende segmenten */}
      {dag.segmenten.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen segmenten voor deze dag.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {dag.segmenten.map((segment) => (
            <div
              key={segment._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono">
                  {segment.beginTijd}–{segment.eindTijd}
                </span>
                <Badge
                  variant={segment.status === "ingediend" ? "secondary" : "default"}
                >
                  {CATEGORIE_LABELS[segment.categorie]}
                </Badge>
                {segment.werkitemId && (
                  <span className="text-muted-foreground">
                    {stopNaam(segment.werkitemId)}
                  </span>
                )}
                {segment.notitie && (
                  <span className="text-xs text-muted-foreground">
                    „{segment.notitie}”
                  </span>
                )}
                {segment.status === "ingediend" && (
                  <Badge variant="outline">ingediend</Badge>
                )}
              </div>
              {(magBewerken && segment.status !== "ingediend") || isKantoor ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleVerwijder(segment._id)}
                  aria-label="Segment verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Handmatig segment toevoegen (corrigeren van de voorinvulling). */
function NieuwSegmentDialog({
  dag,
  datum,
  medewerkerArg,
}: {
  dag: VeldDagData;
  datum: string;
  medewerkerArg: { medewerkerId?: Id<"medewerkers"> };
}) {
  const bevestigSegment = useMutation(api.urenSegmenten.bevestigSegment);
  const [open, setOpen] = useState(false);
  const [categorie, setCategorie] = useState<string>("werken");
  const [beginTijd, setBeginTijd] = useState("07:00");
  const [eindTijd, setEindTijd] = useState("08:00");
  const [werkitemId, setWerkitemId] = useState<string>("");
  const [notitie, setNotitie] = useState("");

  const handleOpslaan = async () => {
    try {
      await bevestigSegment({
        datum,
        categorie: categorie as VeldDagData["segmenten"][number]["categorie"],
        beginTijd,
        eindTijd,
        werkitemId: werkitemId
          ? (werkitemId as Id<"projecten">)
          : undefined,
        notitie: notitie.trim() || undefined,
        bron: "handmatig",
        ...medewerkerArg,
      });
      setOpen(false);
      setNotitie("");
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Opslaan is mislukt");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Segment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segment toevoegen</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="segment-categorie">Categorie</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger id="segment-categorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIE_LABELS).map(([waarde, label]) => (
                  <SelectItem key={waarde} value={waarde}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="segment-begin">Begin</Label>
              <Input
                id="segment-begin"
                type="time"
                value={beginTijd}
                onChange={(e) => setBeginTijd(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="segment-eind">Eind</Label>
              <Input
                id="segment-eind"
                type="time"
                value={eindTijd}
                onChange={(e) => setEindTijd(e.target.value)}
              />
            </div>
          </div>
          {(categorie === "werken" || categorie === "afvalverwerker_bes") && (
            <div className="grid gap-1.5">
              <Label htmlFor="segment-werkitem">
                {categorie === "werken"
                  ? "Klus (verplicht)"
                  : "Herkomst groenafval (optioneel)"}
              </Label>
              <Select value={werkitemId} onValueChange={setWerkitemId}>
                <SelectTrigger id="segment-werkitem">
                  <SelectValue placeholder="Kies een klus van vandaag" />
                </SelectTrigger>
                <SelectContent>
                  {dag.stops.map((stop) => (
                    <SelectItem key={stop.werkitemId} value={stop.werkitemId}>
                      {stop.klantNaam ?? stop.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="segment-notitie">Notitie (optioneel)</Label>
            <Input
              id="segment-notitie"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              placeholder="Korte toelichting"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleOpslaan}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
