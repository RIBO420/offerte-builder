"use client";
import { klantNaam, klantVeld } from "@convex/lib/offerteKlant";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FolderKanban, Leaf, FileText, Plus, Trash2, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { api } from "../../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../../convex/_generated/dataModel";

type ToewijzingType = "project" | "onderhoudsbeurt" | "contract";

interface Toewijzing {
  key: string;
  type: ToewijzingType;
  naam: string;
  regelIds: string[];
  /** Alleen bij type "contract": bouwsteen + frequentie per regel */
  contractRegels?: Array<{
    regelId: string;
    bouwsteenId: string;
    frequentiePerJaar: number;
  }>;
}

interface KoppelWerkitemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerte: Doc<"offertes">;
  /** Wordt aangeroepen nadat de werkitems zijn aangemaakt — accepteert de offerte */
  onGekoppeld: () => Promise<void> | void;
}

/**
 * Koppel-dialoog bij acceptatie van een vrije offerte (route 2, PRD §2.5):
 * kantoor wijst regels toe aan één of meer werkitems — een nieuw eenmalig
 * project, een nieuwe losse onderhoudsbeurt, of (regels gekoppeld aan een
 * bouwsteen mét frequentie) een concept-contract. Zonder koppeling weigert
 * de status-mutation de acceptatie.
 */
export function KoppelWerkitemsDialog({
  open,
  onOpenChange,
  offerte,
  onGekoppeld,
}: KoppelWerkitemsDialogProps) {
  const createWerkitem = useMutation(api.werkitems.createWerkitem);
  const updateBouwsteenRegels = useMutation(api.offertes.updateBouwsteenRegels);
  const bouwstenen = useQuery(api.bouwstenen.list, open ? {} : "skip");
  const actieveBouwstenen = useMemo(
    () => (bouwstenen ?? []).filter((b) => b.actief),
    [bouwstenen]
  );

  const [toewijzingen, setToewijzingen] = useState<Toewijzing[]>([]);
  const [nieuwType, setNieuwType] = useState<ToewijzingType>("project");
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);

  const toegewezenRegelIds = useMemo(
    () => new Set(toewijzingen.flatMap((t) => t.regelIds)),
    [toewijzingen]
  );

  const wisselRegel = (regelId: string) => {
    setGeselecteerd((prev) => {
      const next = new Set(prev);
      if (next.has(regelId)) next.delete(regelId);
      else next.add(regelId);
      return next;
    });
  };

  const voegToewijzingToe = () => {
    if (geselecteerd.size === 0 || !nieuwNaam.trim()) return;
    const regelIds = [...geselecteerd];
    setToewijzingen((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        type: nieuwType,
        naam: nieuwNaam.trim(),
        regelIds,
        contractRegels:
          nieuwType === "contract"
            ? regelIds.map((regelId) => ({
                regelId,
                bouwsteenId: "",
                frequentiePerJaar: 1,
              }))
            : undefined,
      },
    ]);
    setGeselecteerd(new Set());
    setNieuwNaam("");
  };

  const contractToewijzingCompleet = (t: Toewijzing) =>
    t.type !== "contract" ||
    (t.contractRegels ?? []).every((cr) => cr.bouwsteenId !== "");

  const kanKoppelen =
    toewijzingen.length > 0 &&
    toewijzingen.every(contractToewijzingCompleet) &&
    !bezig;

  const koppelEnAccepteer = async () => {
    if (!offerte.klantId) {
      toast.error("Koppel de offerte eerst aan een klant");
      return;
    }
    setBezig(true);
    try {
      // 1. Contract-toewijzingen: bouwsteenRegels op de offerte zetten;
      //    de acceptatie maakt daarna automatisch het concept-contract aan.
      const contractToewijzingen = toewijzingen.filter(
        (t) => t.type === "contract"
      );
      if (contractToewijzingen.length > 0) {
        const bouwsteenRegels = contractToewijzingen.flatMap((t) =>
          (t.contractRegels ?? []).map((cr) => {
            const bouwsteen = actieveBouwstenen.find(
              (b) => b._id === cr.bouwsteenId
            )!;
            const regel = offerte.regels.find((r) => r.id === cr.regelId);
            const frequentie = Math.max(1, cr.frequentiePerJaar);
            return {
              bouwsteenId: bouwsteen._id,
              naam: bouwsteen.naam,
              soort: bouwsteen.soort,
              frequentiePerJaar: frequentie,
              prijsPerBeurt:
                Math.round(((regel?.totaal ?? 0) / frequentie) * 100) / 100,
              prijsPerBeurtHandmatig: true,
              btwCode: (regel?.btwCode ?? 21) as 9 | 21,
              eenmalig: false,
            };
          })
        );
        await updateBouwsteenRegels({ id: offerte._id, bouwsteenRegels });
      }

      // 2. Project- en losse-beurt-toewijzingen als werkitems aanmaken,
      //    gekoppeld aan offerte + toegewezen regels.
      for (const t of toewijzingen) {
        if (t.type === "contract") continue;
        await createWerkitem({
          type: t.type,
          klantId: offerte.klantId as Id<"klanten">,
          naam: t.naam,
          offerteId: offerte._id,
          offerteRegelIds: t.regelIds,
          adres: klantVeld(offerte.klant, "adres"),
        });
      }

      // 3. Acceptatie: de harde validatie ziet nu de keten-uitgang
      await onGekoppeld();
      onOpenChange(false);
      setToewijzingen([]);
    } catch (e) {
      const data = (e as { data?: string })?.data;
      toast.error("Koppelen mislukt", {
        description:
          typeof data === "string"
            ? data
            : e instanceof Error
              ? e.message
              : undefined,
      });
    } finally {
      setBezig(false);
    }
  };

  const typeLabel: Record<ToewijzingType, string> = {
    project: "Eenmalig project",
    onderhoudsbeurt: "Losse onderhoudsbeurt",
    contract: "Concept-contract",
  };
  const typeIcoon: Record<ToewijzingType, typeof FolderKanban> = {
    project: FolderKanban,
    onderhoudsbeurt: Leaf,
    contract: FileText,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Regels koppelen aan werkitems
          </DialogTitle>
          <DialogDescription>
            Een offerte kan niet op &quot;geaccepteerd&quot; zonder ten minste
            één werkitem (PRD §2.5). Wijs de regels toe aan een eenmalig
            project, een losse onderhoudsbeurt of een concept-contract.
          </DialogDescription>
        </DialogHeader>

        {/* Regels selecteren */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Regels</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {offerte.regels.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Deze offerte heeft geen regels.
              </p>
            )}
            {offerte.regels.map((regel) => {
              const toegewezen = toegewezenRegelIds.has(regel.id);
              return (
                <label
                  key={regel.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={geselecteerd.has(regel.id)}
                    disabled={toegewezen}
                    onCheckedChange={() => wisselRegel(regel.id)}
                    aria-label={`Selecteer regel ${regel.omschrijving}`}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-xs text-muted-foreground">
                      [{regel.scope}]
                    </span>{" "}
                    {regel.omschrijving || "(zonder omschrijving)"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(regel.totaal)}
                  </span>
                  {toegewezen && (
                    <Badge variant="secondary" className="text-xs">
                      toegewezen
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Nieuwe toewijzing */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={nieuwType}
            onValueChange={(t) => setNieuwType(t as ToewijzingType)}
          >
            <SelectTrigger className="sm:w-56" aria-label="Soort werkitem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Eenmalig project</SelectItem>
              <SelectItem value="onderhoudsbeurt">
                Losse onderhoudsbeurt
              </SelectItem>
              <SelectItem value="contract">
                Concept-contract (bouwsteen + frequentie)
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={nieuwNaam}
            onChange={(e) => setNieuwNaam(e.target.value)}
            placeholder={`Naam (bv. ${
              nieuwType === "project"
                ? `Project ${offerte.offerteNummer}`
                : nieuwType === "onderhoudsbeurt"
                  ? "Snoeibeurt najaar"
                  : `Onderhoudscontract ${klantNaam(offerte.klant)}`
            })`}
            aria-label="Naam werkitem"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={voegToewijzingToe}
            disabled={geselecteerd.size === 0 || !nieuwNaam.trim()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Toewijzen
          </Button>
        </div>

        {/* Toewijzingen */}
        {toewijzingen.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Werkitems bij acceptatie</p>
            {toewijzingen.map((t) => {
              const Icoon = typeIcoon[t.type];
              return (
                <div key={t.key} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Icoon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-medium">{t.naam}</span>
                    <Badge variant="outline">{typeLabel[t.type]}</Badge>
                    <Badge variant="secondary">
                      {t.regelIds.length} regel(s)
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Toewijzing verwijderen"
                      onClick={() =>
                        setToewijzingen((prev) =>
                          prev.filter((x) => x.key !== t.key)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {t.type === "contract" && (
                    <div className="mt-2 space-y-2 border-t pt-2">
                      {(t.contractRegels ?? []).map((cr) => {
                        const regel = offerte.regels.find(
                          (r) => r.id === cr.regelId
                        );
                        return (
                          <div
                            key={cr.regelId}
                            className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_220px_110px]"
                          >
                            <span className="truncate text-xs text-muted-foreground">
                              {regel?.omschrijving ?? cr.regelId}
                            </span>
                            <Select
                              value={cr.bouwsteenId || undefined}
                              onValueChange={(bouwsteenId) => {
                                const bouwsteen = actieveBouwstenen.find(
                                  (b) => b._id === bouwsteenId
                                );
                                setToewijzingen((prev) =>
                                  prev.map((x) =>
                                    x.key === t.key
                                      ? {
                                          ...x,
                                          contractRegels: x.contractRegels?.map(
                                            (y) =>
                                              y.regelId === cr.regelId
                                                ? {
                                                    ...y,
                                                    bouwsteenId,
                                                    frequentiePerJaar:
                                                      bouwsteen?.defaultFrequentiePerJaar ??
                                                      y.frequentiePerJaar,
                                                  }
                                                : y
                                          ),
                                        }
                                      : x
                                  )
                                );
                              }}
                            >
                              <SelectTrigger aria-label="Kies bouwsteen">
                                <SelectValue placeholder="Kies bouwsteen…" />
                              </SelectTrigger>
                              <SelectContent>
                                {actieveBouwstenen.map((b) => (
                                  <SelectItem key={b._id} value={b._id}>
                                    {b.naam}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <NumberInput
                              value={cr.frequentiePerJaar}
                              min={1}
                              onChange={(frequentiePerJaar) =>
                                setToewijzingen((prev) =>
                                  prev.map((x) =>
                                    x.key === t.key
                                      ? {
                                          ...x,
                                          contractRegels: x.contractRegels?.map(
                                            (y) =>
                                              y.regelId === cr.regelId
                                                ? { ...y, frequentiePerJaar }
                                                : y
                                          ),
                                        }
                                      : x
                                  )
                                )
                              }
                              aria-label="Frequentie per jaar"
                              suffix="×/jr"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bezig}
          >
            Annuleren
          </Button>
          <Button type="button" onClick={koppelEnAccepteer} disabled={!kanKoppelen}>
            {bezig ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Koppel en accepteer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
