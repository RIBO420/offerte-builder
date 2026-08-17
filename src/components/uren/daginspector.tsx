"use client";

/**
 * De daginspector — het zijpaneel achter "Corrigeren".
 *
 * Eén dag van één mens: de dagbalk als bewijs, daaronder de segmenten als
 * regels, en onderaan het logboek. Alles wat hier gebeurt loopt over de
 * bestáánde mutations (`updateSegment`, `verwijderSegment`, `heropenDag`) —
 * kantoor mag op een ingediende dag schrijven, en `urenSegmenten` schrijft die
 * correctie zelf naar `urenLogboek`. Er is dus geen tweede correctiepad.
 *
 * De categorie staat hier als tékst naast de tijd, niet als kleurblok: in de
 * balk is kleur de snelle blik, in de inspector is taal de waarheid (kleur is
 * nergens de enige drager).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatHours } from "@/lib/format";
import { getStatusConfig } from "@/lib/constants/statuses";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import {
  CATEGORIE_LABEL,
  minutenVanTijd,
  type SegmentCategorie,
} from "./controle-types";
import { Dagbalk } from "./dagbalk";
import { dagLabelLang } from "./week";

/** Welke dag staat open. `null` = het paneel is dicht. */
export interface InspectorDag {
  medewerkerId: string;
  datum: string;
  naam: string;
}

const LOGBOEK_LABEL: Record<string, string> = {
  dag_ingediend: "Dag ingediend",
  dag_heropend: "Dag heropend",
  segment_gecorrigeerd: "Segment gecorrigeerd",
  dag_akkoord: "Akkoord bevonden",
};

export function Daginspector({
  dag,
  onSluit,
}: {
  dag: InspectorDag | null;
  onSluit: () => void;
}) {
  return (
    <Sheet open={dag !== null} onOpenChange={(open) => !open && onSluit()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
      >
        {dag && <InspectorInhoud dag={dag} />}
      </SheetContent>
    </Sheet>
  );
}

function InspectorInhoud({ dag }: { dag: InspectorDag }) {
  const veldDag = useQuery(api.urenSegmenten.getVeldDag, {
    datum: dag.datum,
    medewerkerId: dag.medewerkerId as Id<"medewerkers">,
  });
  const logboek = useQuery(api.urenSegmenten.getUrenLogboek, {
    medewerkerId: dag.medewerkerId as Id<"medewerkers">,
    datum: dag.datum,
  });
  const heropenDag = useMutation(api.urenSegmenten.heropenDag);
  const [bezig, setBezig] = useState(false);

  const segmenten = veldDag?.segmenten ?? [];
  const totaalUren = segmenten.reduce((som, segment) => {
    const begin = minutenVanTijd(segment.beginTijd);
    const eind = minutenVanTijd(segment.eindTijd);
    if (begin === null || eind === null || eind <= begin) return som;
    return som + (eind - begin) / 60;
  }, 0);

  const statusConfig = getStatusConfig(
    veldDag?.dagStatus === "ingediend" ? "ingediend" : "concept",
    "uren"
  );

  const stopNaam = (werkitemId: string | null | undefined) => {
    if (!werkitemId) return null;
    const stop = veldDag?.stops.find((s) => s.werkitemId === werkitemId);
    return stop?.klantNaam ?? stop?.naam ?? null;
  };

  const handleHeropenen = async () => {
    setBezig(true);
    try {
      await heropenDag({
        medewerkerId: dag.medewerkerId as Id<"medewerkers">,
        datum: dag.datum,
      });
      showSuccessToast(`Dag staat weer open voor ${dag.naam}`);
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Heropenen is mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <>
      <SheetHeader className="gap-1 border-b px-4 py-4">
        <SheetTitle className="font-display text-[17px] leading-6 font-semibold tracking-tight">
          {dag.naam}
        </SheetTitle>
        <SheetDescription className="text-[13px]">
          {dagLabelLang(dag.datum)} · {formatHours(totaalUren)} uur ·{" "}
          {veldDag?.dagStatus === "ingediend"
            ? "ingediend en op slot"
            : "nog open bij de medewerker"}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-4 py-4">
        <section aria-label="Dagbalk">
          <Dagbalk
            segmenten={segmenten}
            formaat="hero"
            label={`${dag.naam}, ${dagLabelLang(dag.datum)}`}
            legenda
          />
        </section>

        <section aria-label="Segmenten" className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Segmenten
            </h3>
            <Badge variant="outline" className="text-[11px]">
              {statusConfig.label}
            </Badge>
          </div>

          {veldDag === undefined ? (
            <p className="text-xs text-muted-foreground">Segmenten laden…</p>
          ) : segmenten.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Deze dag heeft geen segmenten.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {segmenten.map((segment) => (
                <li key={segment._id}>
                  <SegmentRegel
                    segmentId={segment._id}
                    beginTijd={segment.beginTijd}
                    eindTijd={segment.eindTijd}
                    categorie={segment.categorie}
                    klus={stopNaam(segment.werkitemId)}
                    notitie={segment.notitie ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Dagacties">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleHeropenen}
            disabled={bezig || veldDag?.dagStatus !== "ingediend"}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Dag heropenen
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Heropenen zet de dag terug bij de medewerker. Het logboek houdt bij
            wie dat wanneer deed.
          </p>
        </section>

        <section aria-label="Logboek" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Logboek
          </h3>
          {logboek === undefined ? (
            <p className="text-xs text-muted-foreground">Logboek laden…</p>
          ) : logboek.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Er is nog niets met deze dag gebeurd.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {[...logboek]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((regel) => (
                  <li
                    key={regel._id}
                    className="rounded-md border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <p className="font-medium">
                      {LOGBOEK_LABEL[regel.actie] ?? regel.actie}
                    </p>
                    <p className="text-muted-foreground">{regel.details}</p>
                    <time
                      dateTime={new Date(regel.createdAt).toISOString()}
                      className="text-[11px] text-muted-foreground/80"
                    >
                      {new Intl.DateTimeFormat("nl-NL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(regel.createdAt))}
                    </time>
                  </li>
                ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * Eén segmentregel, met bijstellen ter plekke. Bewust geen dialoog: een tijd
 * verzetten is één handeling van vijf seconden en hoort geen venster te openen.
 */
function SegmentRegel({
  segmentId,
  beginTijd,
  eindTijd,
  categorie,
  klus,
  notitie,
}: {
  segmentId: Id<"urenSegmenten">;
  beginTijd: string;
  eindTijd: string;
  categorie: SegmentCategorie;
  klus: string | null;
  notitie: string | null;
}) {
  const updateSegment = useMutation(api.urenSegmenten.updateSegment);
  const verwijderSegment = useMutation(api.urenSegmenten.verwijderSegment);
  const [bewerken, setBewerken] = useState(false);
  const [begin, setBegin] = useState(beginTijd);
  const [eind, setEind] = useState(eindTijd);
  const [nieuweCategorie, setNieuweCategorie] =
    useState<SegmentCategorie>(categorie);
  const [bezig, setBezig] = useState(false);

  const handleOpslaan = async () => {
    setBezig(true);
    try {
      await updateSegment({
        id: segmentId,
        beginTijd: begin,
        eindTijd: eind,
        categorie: nieuweCategorie,
      });
      showSuccessToast("Segment bijgesteld");
      setBewerken(false);
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Bijstellen is mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  const handleVerwijderen = async () => {
    setBezig(true);
    try {
      await verwijderSegment({ id: segmentId });
      showSuccessToast("Segment verwijderd");
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Verwijderen is mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  if (bewerken) {
    return (
      <div className="flex flex-col gap-2 rounded-md border bg-card px-2.5 py-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor={`begin-${segmentId}`} className="text-[11px]">
              Begin
            </Label>
            <Input
              id={`begin-${segmentId}`}
              type="time"
              value={begin}
              onChange={(e) => setBegin(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`eind-${segmentId}`} className="text-[11px]">
              Eind
            </Label>
            <Input
              id={`eind-${segmentId}`}
              type="time"
              value={eind}
              onChange={(e) => setEind(e.target.value)}
              className="h-8"
            />
          </div>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`categorie-${segmentId}`} className="text-[11px]">
            Categorie
          </Label>
          <Select
            value={nieuweCategorie}
            onValueChange={(waarde) =>
              setNieuweCategorie(waarde as SegmentCategorie)
            }
          >
            <SelectTrigger id={`categorie-${segmentId}`} className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.keys(CATEGORIE_LABEL) as SegmentCategorie[]
              ).map((waarde) => (
                <SelectItem key={waarde} value={waarde}>
                  {CATEGORIE_LABEL[waarde]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 gap-1"
            onClick={handleOpslaan}
            disabled={bezig}
          >
            <Check className="size-3.5" aria-hidden />
            Opslaan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 font-normal"
            onClick={() => setBewerken(false)}
            disabled={bezig}
          >
            <X className="size-3.5" aria-hidden />
            Annuleren
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-[13px]">
      <span className="shrink-0 font-mono text-xs tabular-nums">
        {beginTijd}–{eindTijd}
      </span>
      <span className="shrink-0 font-medium">
        {CATEGORIE_LABEL[categorie]}
      </span>
      {klus && (
        <span className="min-w-0 truncate text-muted-foreground" title={klus}>
          {klus}
        </span>
      )}
      {notitie && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          „{notitie}”
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setBewerken(true)}
          aria-label={`Segment ${beginTijd}–${eindTijd} bijstellen`}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={handleVerwijderen}
          disabled={bezig}
          aria-label={`Segment ${beginTijd}–${eindTijd} verwijderen`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
