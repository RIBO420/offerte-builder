"use client";

/**
 * Onderhoud-sectie op de klantkaart (PRD §2.1): contracten en losse beurten
 * staan als APARTE regels naast elkaar, elk met eigen historie-link — nooit
 * samengevoegd. Vanaf hier kan kantoor ook een losse beurt aanmaken.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollText, Sprout, Plus, CalendarClock } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { formatCurrency } from "@/lib/format/currency";

const contractStatusLabels: Record<string, string> = {
  concept: "Concept",
  actief: "Actief",
  verlopen: "Verlopen",
  opgezegd: "Opgezegd",
};

const beurtStatusLabels: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  uitgevoerd: "Uitgevoerd",
  gefactureerd: "Gefactureerd",
  vervallen: "Vervallen",
};

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function formatDatum(iso?: string): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MAANDEN[Number(m) - 1]} ${iso.slice(0, 4)}`;
}

type RitmeKeuze = "eenmalig" | "per_jaar" | "interval";

export function OnderhoudSectie({ klantId }: { klantId: Id<"klanten"> }) {
  const contracten = useQuery(api.onderhoudscontracten.getByKlant, { klantId });
  const losseBeurten = useQuery(api.losseBeurten.listByKlant, { klantId });
  const bouwstenen = useQuery(api.onderhoudscontracten.getBouwsteenDefaults, {});
  const createLosseBeurt = useMutation(api.losseBeurten.createLosseBeurt);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [naam, setNaam] = useState("");
  const [bouwsteenId, setBouwsteenId] = useState<string>("vrij");
  const [omschrijving, setOmschrijving] = useState("");
  const [prijsPerBeurt, setPrijsPerBeurt] = useState<string>("");
  const [geschatteUren, setGeschatteUren] = useState<string>("");
  const [ritmeKeuze, setRitmeKeuze] = useState<RitmeKeuze>("eenmalig");
  const [frequentiePerJaar, setFrequentiePerJaar] = useState<string>("1");
  const [intervalWeken, setIntervalWeken] = useState<string>("2");
  const [vensterVan, setVensterVan] = useState<string>("geen");
  const [vensterTot, setVensterTot] = useState<string>("geen");
  const [attenderingDagen, setAttenderingDagen] = useState<string>("14");

  const gekozenBouwsteen = useMemo(
    () => bouwstenen?.find((b) => b._id === bouwsteenId) ?? null,
    [bouwstenen, bouwsteenId]
  );

  const handleBouwsteenKeuze = (id: string) => {
    setBouwsteenId(id);
    if (id === "vrij") return;
    const b = bouwstenen?.find((x) => x._id === id);
    if (!b) return;
    setOmschrijving(b.naam);
    if (!naam.trim()) setNaam(b.naam);
    if (b.defaultPrijsPerBeurt != null)
      setPrijsPerBeurt(String(b.defaultPrijsPerBeurt));
    if (b.urenPerBeurt != null) setGeschatteUren(String(b.urenPerBeurt));
    if (b.vensterVanMaand) setVensterVan(String(b.vensterVanMaand));
    if (b.vensterTotMaand) setVensterTot(String(b.vensterTotMaand));
  };

  const resetForm = () => {
    setNaam("");
    setBouwsteenId("vrij");
    setOmschrijving("");
    setPrijsPerBeurt("");
    setGeschatteUren("");
    setRitmeKeuze("eenmalig");
    setFrequentiePerJaar("1");
    setIntervalWeken("2");
    setVensterVan("geen");
    setVensterTot("geen");
    setAttenderingDagen("14");
  };

  const handleSubmit = async () => {
    if (!naam.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const venster =
        vensterVan !== "geen" && vensterTot !== "geen"
          ? {
              vensterVanMaand: Number(vensterVan),
              vensterTotMaand: Number(vensterTot),
            }
          : {};
      const ritme =
        ritmeKeuze === "eenmalig"
          ? undefined
          : ritmeKeuze === "per_jaar"
            ? { frequentiePerJaar: Number(frequentiePerJaar) || 1, ...venster }
            : { intervalWeken: Number(intervalWeken) || 1, ...venster };

      await createLosseBeurt({
        klantId,
        naam: naam.trim(),
        bouwsteenRegels: [
          {
            bouwsteenId:
              bouwsteenId !== "vrij"
                ? (bouwsteenId as Id<"bouwstenen">)
                : undefined,
            omschrijving: omschrijving.trim() || naam.trim(),
            prijsPerBeurt: prijsPerBeurt
              ? parseFloat(prijsPerBeurt)
              : undefined,
          },
        ],
        geschatteUren: geschatteUren ? parseFloat(geschatteUren) : undefined,
        ritme,
        attenderingDagenVooraf:
          ritme && attenderingDagen ? parseInt(attenderingDagen) : undefined,
      });

      showSuccessToast("Losse beurt aangemaakt", {
        description: ritme
          ? "De beurt staat in de wachtrij; het ritme bepaalt de volgende voorziene datum."
          : "De beurt staat ongepland in de wachtrij.",
      });
      resetForm();
      setDialogOpen(false);
    } catch {
      showErrorToast("Kon losse beurt niet aanmaken");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Onderhoud</CardTitle>
            <CardDescription>
              Contracten en losse beurten — aparte regels, elk met eigen
              historie
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Losse beurt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Losse beurt aanmaken</DialogTitle>
                <DialogDescription>
                  Een onderhoudsbeurt zonder contract, direct onder deze
                  klant. Met een ritme weet het systeem wanneer de volgende
                  aan de beurt is — er wordt niets automatisch ingepland.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="lb-naam">Naam</Label>
                  <Input
                    id="lb-naam"
                    placeholder="bijv. Snoeibeurt voorjaar"
                    value={naam}
                    onChange={(e) => setNaam(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Bouwsteen</Label>
                    <Select value={bouwsteenId} onValueChange={handleBouwsteenKeuze}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vrij">Vrije omschrijving…</SelectItem>
                        {(bouwstenen ?? []).map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.naam}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lb-prijs">Prijs per beurt (excl.)</Label>
                    <Input
                      id="lb-prijs"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder={
                        gekozenBouwsteen?.defaultPrijsPerBeurt != null
                          ? String(gekozenBouwsteen.defaultPrijsPerBeurt)
                          : "0,00"
                      }
                      value={prijsPerBeurt}
                      onChange={(e) => setPrijsPerBeurt(e.target.value)}
                    />
                  </div>
                </div>
                {bouwsteenId === "vrij" && (
                  <div className="space-y-2">
                    <Label htmlFor="lb-omschrijving">Omschrijving</Label>
                    <Input
                      id="lb-omschrijving"
                      placeholder="bijv. Rozen snoeien"
                      value={omschrijving}
                      onChange={(e) => setOmschrijving(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="lb-uren">Geschatte uren</Label>
                    <Input
                      id="lb-uren"
                      type="number"
                      min={0}
                      step={0.5}
                      value={geschatteUren}
                      onChange={(e) => setGeschatteUren(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ritme</Label>
                    <Select
                      value={ritmeKeuze}
                      onValueChange={(v) => setRitmeKeuze(v as RitmeKeuze)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eenmalig">
                          Eenmalig (geen ritme)
                        </SelectItem>
                        <SelectItem value="per_jaar">n× per jaar</SelectItem>
                        <SelectItem value="interval">Elke n weken</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {ritmeKeuze !== "eenmalig" && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {ritmeKeuze === "per_jaar" ? (
                        <div className="space-y-2">
                          <Label htmlFor="lb-freq">Keer per jaar</Label>
                          <Input
                            id="lb-freq"
                            type="number"
                            min={1}
                            value={frequentiePerJaar}
                            onChange={(e) =>
                              setFrequentiePerJaar(e.target.value)
                            }
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="lb-interval">Interval (weken)</Label>
                          <Input
                            id="lb-interval"
                            type="number"
                            min={1}
                            max={52}
                            value={intervalWeken}
                            onChange={(e) => setIntervalWeken(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="lb-attendering">
                          Attendering (dagen vooraf)
                        </Label>
                        <Input
                          id="lb-attendering"
                          type="number"
                          min={0}
                          value={attenderingDagen}
                          onChange={(e) => setAttenderingDagen(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Venster van</Label>
                        <Select value={vensterVan} onValueChange={setVensterVan}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="geen">Geen venster</SelectItem>
                            {MAANDEN.map((m, i) => (
                              <SelectItem key={m} value={String(i + 1)}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Venster tot</Label>
                        <Select value={vensterTot} onValueChange={setVensterTot}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="geen">Geen venster</SelectItem>
                            {MAANDEN.map((m, i) => (
                              <SelectItem key={m} value={String(i + 1)}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Het systeem berekent de volgende voorziene datum, maar
                      plant niets automatisch in — kantoor beslist (attendering
                      volgt op het takenbord).
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!naam.trim() || isSubmitting}
                >
                  {isSubmitting ? "Opslaan..." : "Aanmaken"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {contracten === undefined || losseBeurten === undefined ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Laden...
          </p>
        ) : contracten.length === 0 && losseBeurten.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nog geen onderhoudscontracten of losse beurten
          </p>
        ) : (
          <>
            {contracten.map((c) => (
              <Link
                key={c._id}
                href={`/contracten/${c._id}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <ScrollText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.naam}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {c.contractNummer}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Contract · {formatDatum(c.startDatum)} –{" "}
                    {formatDatum(c.eindDatum)} ·{" "}
                    {formatCurrency(c.jaarlijksTarief)}/jaar
                  </p>
                </div>
                <Badge variant="outline">
                  {contractStatusLabels[c.status] ?? c.status}
                </Badge>
              </Link>
            ))}
            {losseBeurten.map((b) => (
              <Link
                key={b._id}
                href={`/projecten/${b._id}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <Sprout className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.naam}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Losse beurt
                    {b.ritme && (
                      <>
                        {" · "}
                        <CalendarClock className="h-3 w-3" />
                        {b.ritme.frequentiePerJaar
                          ? `${b.ritme.frequentiePerJaar}× per jaar`
                          : `elke ${b.ritme.intervalWeken} weken`}
                        {b.volgendeVoorzieneDatum &&
                          ` · volgende: ${formatDatum(b.volgendeVoorzieneDatum)}`}
                      </>
                    )}
                    {!b.ritme && " · eenmalig"}
                  </p>
                </div>
                <Badge variant="outline">
                  {beurtStatusLabels[b.status] ?? b.status}
                </Badge>
              </Link>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
