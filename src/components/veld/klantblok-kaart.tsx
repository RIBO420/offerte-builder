"use client";

/**
 * KlantblokKaart — één geplande klus op de veld-dag (PRD §2.6, stap 9a):
 * takenlijst (code + normtijd), route-knop met materiaaldelta-checklist
 * (§8.5: eerst afvinken, dan pas Maps), afrondingsflow op taakniveau (§8.8),
 * meerwerk-verzoek en foto's naar de klanttijdlijn.
 */

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  MapPin,
  Plus,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type VeldDagData = NonNullable<
  FunctionReturnType<typeof api.urenSegmenten.getVeldDag>
>;
type VeldStop = VeldDagData["stops"][number];

type TaakStatus = "afgerond" | "begonnen_niet_af" | "niet_gestart";

const STATUS_VOLGORDE: TaakStatus[] = [
  "niet_gestart",
  "begonnen_niet_af",
  "afgerond",
];

const STATUS_WEERGAVE: Record<
  TaakStatus,
  { label: string; icoon: typeof Circle }
> = {
  afgerond: { label: "Afgerond", icoon: CheckCircle2 },
  begonnen_niet_af: { label: "Begonnen, niet af", icoon: CircleDot },
  niet_gestart: { label: "Niet gestart", icoon: Circle },
};

export function KlantblokKaart({
  stop,
  datum,
  magBewerken,
}: {
  stop: VeldStop;
  datum: string;
  magBewerken: boolean;
}) {
  const isAfgerond =
    stop.status === "uitgevoerd" ||
    stop.status === "afgerond" ||
    stop.status === "deels_uitgevoerd";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {stop.klantNaam ?? stop.naam}
          </CardTitle>
          <div className="flex items-center gap-2">
            {stop.klaarVoorFacturatie && (
              <Badge variant="secondary">Klaar voor facturatie</Badge>
            )}
            <Badge variant={isAfgerond ? "secondary" : "outline"}>
              {stop.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
        {stop.adres && (
          <p className="text-sm text-muted-foreground">{stop.adres}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Takenlijst: bouwstenen met code + normtijd (§8.8) */}
        {stop.taken.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {stop.taken.map((taak, i) => (
              <li key={i} className="flex items-center gap-2">
                {taak.code && (
                  <Badge variant="outline" className="font-mono">
                    {taak.code}
                  </Badge>
                )}
                <span>{taak.omschrijving}</span>
                {taak.normUren !== null && (
                  <span className="text-xs text-muted-foreground">
                    ±{taak.normUren} u
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <RouteMetDeltaKnop stop={stop} datum={datum} />
          {magBewerken && !isAfgerond && (
            <AfrondDialog stop={stop} />
          )}
          {magBewerken && <MeerwerkDialog stop={stop} />}
          {magBewerken && <FotoKnop stop={stop} />}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Route-knop (§8.5): toont éérst de materiaaldelta-checklist (benodigd uit de
 * bouwsteen-koppelingen mínus businventaris), afvinken wordt gelogd, en pas
 * daarna de link naar Maps (gewone URL, geen API).
 */
function RouteMetDeltaKnop({ stop, datum }: { stop: VeldStop; datum: string }) {
  const [open, setOpen] = useState(false);
  const delta = useQuery(
    api.materiaalDelta.getDeltaChecklist,
    open ? { werkitemId: stop.werkitemId, datum } : "skip"
  );
  const vinkAf = useMutation(api.materiaalDelta.vinkAf);

  const handleVink = async (item: string, ongedaan: boolean) => {
    try {
      await vinkAf({ werkitemId: stop.werkitemId, datum, item, ongedaan });
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Afvinken is mislukt");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="mr-1 h-4 w-4" aria-hidden />
          Route
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check je bus eerst</DialogTitle>
          <DialogDescription>
            Dit heb je voor deze klus nodig bovenop de standaardinventaris van
            de bus. Vink af — wie afvinkt wordt gelogd.
          </DialogDescription>
        </DialogHeader>
        {delta === undefined ? (
          <p className="text-sm text-muted-foreground">Checklist laden…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {delta.voertuig && (
              <p className="text-xs text-muted-foreground">
                Bus: {delta.voertuig.merk} ({delta.voertuig.kenteken})
              </p>
            )}
            {delta.delta.length === 0 ? (
              <p className="text-sm">
                Alles voor deze klus zit in de standaardinventaris. Goede reis!
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {delta.delta.map((item) => (
                  <li key={item.naam} className="flex items-center gap-2">
                    <Checkbox
                      id={`delta-${stop.werkitemId}-${item.naam}`}
                      checked={item.afgevinkt}
                      onCheckedChange={(aangevinkt) =>
                        handleVink(item.naam, aangevinkt !== true)
                      }
                    />
                    <Label
                      htmlFor={`delta-${stop.werkitemId}-${item.naam}`}
                      className="flex-1 capitalize"
                    >
                      {item.naam}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({item.soort})
                      </span>
                    </Label>
                    {item.afgevinkt && item.afgevinktDoor && (
                      <span className="text-xs text-muted-foreground">
                        ✓ {item.afgevinktDoor}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button
            asChild
            disabled={
              delta === undefined ||
              (delta.delta.length > 0 && !delta.allesAfgevinkt)
            }
          >
            <a
              href={delta?.mapsUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={
                delta === undefined ||
                (delta.delta.length > 0 && !delta.allesAfgevinkt)
              }
              onClick={(e) => {
                if (
                  delta === undefined ||
                  !delta.mapsUrl ||
                  (delta.delta.length > 0 && !delta.allesAfgevinkt)
                ) {
                  e.preventDefault();
                  toast.info("Vink eerst de checklist af");
                }
              }}
            >
              <MapPin className="mr-1 h-4 w-4" aria-hidden />
              Open route in Maps
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Afrondingsflow bij het uitklokken: per taak ✓ / ◐ / ○ + notitie (§8.8). */
function AfrondDialog({ stop }: { stop: VeldStop }) {
  const rondAf = useMutation(api.afronding.rondWerkitemAf);
  const [open, setOpen] = useState(false);
  const taken = stop.taken.length > 0 ? stop.taken : [{ omschrijving: stop.naam, code: null, normUren: null, bouwsteenId: null }];
  const [statussen, setStatussen] = useState<TaakStatus[]>(
    () => taken.map(() => "afgerond" as TaakStatus)
  );
  const [notities, setNotities] = useState<string[]>(() => taken.map(() => ""));

  const wisselStatus = (index: number) => {
    setStatussen((huidige) => {
      const volgende = [...huidige];
      const positie = STATUS_VOLGORDE.indexOf(volgende[index]);
      volgende[index] =
        STATUS_VOLGORDE[(positie + 1) % STATUS_VOLGORDE.length];
      return volgende;
    });
  };

  const nietAf = statussen.filter((s) => s !== "afgerond").length;

  const handleAfronden = async () => {
    try {
      const resultaat = await rondAf({
        werkitemId: stop.werkitemId,
        taken: taken.map((_, i) => ({
          index: i,
          status: statussen[i],
          notitie: notities[i].trim() || undefined,
        })),
      });
      setOpen(false);
      if (resultaat.status === "deels_uitgevoerd") {
        toast.success(
          "Deels uitgevoerd — de openstaande taken staan als rest-opdracht in de wachtrij"
        );
      } else {
        toast.success("Afgerond — klaar voor facturatie");
      }
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Afronden is mislukt");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardCheck className="mr-1 h-4 w-4" aria-hidden />
          Afronden
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Klus afronden — {stop.klantNaam ?? stop.naam}</DialogTitle>
          <DialogDescription>
            Zet per taak de status. Alles afgerond → klaar voor facturatie.
            Niet af → automatisch als rest-opdracht terug in de wachtrij.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {taken.map((taak, i) => {
            const weergave = STATUS_WEERGAVE[statussen[i]];
            const Icoon = weergave.icoon;
            return (
              <div key={i} className="flex flex-col gap-1 rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    {taak.code && (
                      <Badge variant="outline" className="font-mono">
                        {taak.code}
                      </Badge>
                    )}
                    <span>{taak.omschrijving}</span>
                    {taak.normUren !== null && (
                      <span className="text-xs text-muted-foreground">
                        ±{taak.normUren} u
                      </span>
                    )}
                  </div>
                  <Button
                    variant={statussen[i] === "afgerond" ? "default" : "outline"}
                    size="sm"
                    onClick={() => wisselStatus(i)}
                    aria-label={`Status van ${taak.omschrijving}: ${weergave.label}. Klik om te wisselen.`}
                  >
                    <Icoon className="mr-1 h-4 w-4" aria-hidden />
                    {weergave.label}
                  </Button>
                </div>
                {statussen[i] !== "afgerond" && (
                  <Input
                    value={notities[i]}
                    onChange={(e) =>
                      setNotities((huidige) => {
                        const volgende = [...huidige];
                        volgende[i] = e.target.value;
                        return volgende;
                      })
                    }
                    placeholder="Korte notitie (optioneel)"
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {nietAf > 0 && (
            <p className="text-xs text-muted-foreground">
              {nietAf} taak{nietAf === 1 ? "" : "en"} gaat als rest-opdracht
              terug naar kantoor.
            </p>
          )}
          <Button onClick={handleAfronden}>Klus afronden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Meerwerk-verzoek vanuit de dagkaart: taak + geschatte tijd (§2.6). */
function MeerwerkDialog({ stop }: { stop: VeldStop }) {
  const maakVerzoek = useMutation(api.meerwerk.maakVeldVerzoek);
  const [open, setOpen] = useState(false);
  const [omschrijving, setOmschrijving] = useState("");
  const [minuten, setMinuten] = useState("30");

  const handleVersturen = async () => {
    try {
      await maakVerzoek({
        werkitemId: stop.werkitemId,
        omschrijving,
        geschatteMinuten: Number(minuten),
      });
      setOpen(false);
      setOmschrijving("");
      toast.success(
        "Meerwerk-verzoek verstuurd — planning keurt goed vóór je begint"
      );
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Versturen is mislukt");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Meerwerk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meerwerk aanvragen</DialogTitle>
          <DialogDescription>
            Meerwerk kan alleen ná akkoord van planning. Beschrijf de taak en
            schat de tijd; kantoor plust de tijd bij of plant het apart in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`meerwerk-omschrijving-${stop.werkitemId}`}>
              Taakomschrijving
            </Label>
            <Input
              id={`meerwerk-omschrijving-${stop.werkitemId}`}
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              placeholder="bijv. extra haag aan de achterzijde snoeien"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`meerwerk-minuten-${stop.werkitemId}`}>
              Geschatte tijd (minuten)
            </Label>
            <Input
              id={`meerwerk-minuten-${stop.werkitemId}`}
              type="number"
              min={1}
              max={1440}
              value={minuten}
              onChange={(e) => setMinuten(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleVersturen} disabled={!omschrijving.trim()}>
            Verstuur naar planning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Foto's per opdracht → bijlage op de klanttijdlijn bij het werkitem (§2.3). */
function FotoKnop({ stop }: { stop: VeldStop }) {
  const generateUploadUrl = useMutation(api.fotoStorage.generateUploadUrl);
  const voegFotoToe = useMutation(api.urenSegmenten.voegVeldFotoToe);
  const inputRef = useRef<HTMLInputElement>(null);
  const [bezig, setBezig] = useState(false);

  const handleBestanden = async (bestanden: FileList | null) => {
    if (!bestanden || bestanden.length === 0) return;
    setBezig(true);
    try {
      const storageIds: Id<"_storage">[] = [];
      for (const bestand of Array.from(bestanden)) {
        const uploadUrl = await generateUploadUrl();
        const respons = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": bestand.type },
          body: bestand,
        });
        if (!respons.ok) throw new Error("Upload mislukt");
        const { storageId } = (await respons.json()) as {
          storageId: Id<"_storage">;
        };
        storageIds.push(storageId);
      }
      await voegFotoToe({ werkitemId: stop.werkitemId, bijlagen: storageIds });
      toast.success(
        `${storageIds.length} foto${storageIds.length === 1 ? "" : "'s"} op de klanttijdlijn gezet`
      );
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Foto's uploaden is mislukt"
      );
    } finally {
      setBezig(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleBestanden(e.target.files)}
        aria-label="Foto's toevoegen"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={bezig}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="mr-1 h-4 w-4" aria-hidden />
        {bezig ? "Bezig…" : "Foto's"}
      </Button>
    </>
  );
}
