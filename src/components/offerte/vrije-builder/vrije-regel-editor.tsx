"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Package, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { ArtikelPicker } from "./artikel-picker";
import { MargefactorInfo } from "./margefactor-info";
import {
  berekenHoofdstukSubtotalen,
  berekenRegelTotaal,
  margeUitVerkoopprijs,
  productNaarRegel,
  verkoopprijsUitMarge,
  isPrijsOpRegel,
  type PickerProduct,
  type VrijeRegel,
} from "../../../../convex/vrijeOfferteBerekening";

/**
 * Vrije regel-editor (route 2, PRD §2.5b). Bewust een zelfstandige component
 * zonder offerte-context: props in, regels uit. Dezelfde editor gaat in §2.8
 * losse facturen maken.
 */
export interface VrijeRegelEditorProps {
  regels: VrijeRegel[];
  onChange: (regels: VrijeRegel[]) => void;
  /** Default-marge voor artikelen zonder verkoopprijs in het bestand */
  standaardMargePercentage?: number;
}

const nieuwId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `regel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_HOOFDSTUK = "Werkzaamheden";

function herbereken(regel: VrijeRegel): VrijeRegel {
  return {
    ...regel,
    totaal: berekenRegelTotaal(
      regel.hoeveelheid,
      regel.prijsPerEenheid,
      regel.kortingPercentage
    ),
  };
}

export function VrijeRegelEditor({
  regels,
  onChange,
  standaardMargePercentage = 30,
}: VrijeRegelEditorProps) {
  const [extraHoofdstukken, setExtraHoofdstukken] = useState<string[]>([]);
  const [nieuwHoofdstuk, setNieuwHoofdstuk] = useState("");
  const [pickerHoofdstuk, setPickerHoofdstuk] = useState<string | null>(null);

  const hoofdstukken = useMemo(() => {
    const uitRegels = regels.map((r) => r.scope);
    const alles = [...uitRegels, ...extraHoofdstukken];
    const uniek: string[] = [];
    for (const h of alles) if (!uniek.includes(h)) uniek.push(h);
    return uniek.length > 0 ? uniek : [DEFAULT_HOOFDSTUK];
  }, [regels, extraHoofdstukken]);

  const subtotalen = useMemo(
    () => new Map(berekenHoofdstukSubtotalen(regels).map((s) => [s.hoofdstuk, s.subtotaal])),
    [regels]
  );

  const updateRegel = (id: string, patch: Partial<VrijeRegel>) => {
    onChange(
      regels.map((r) => (r.id === id ? herbereken({ ...r, ...patch }) : r))
    );
  };

  /** Marge invullen → verkoopprijs (PRD: live, beide kanten op) */
  const wijzigMarge = (regel: VrijeRegel, marge: number) => {
    const inkoop = regel.inkoopprijsPerEenheid;
    if (regel.prijsOpRegel || isPrijsOpRegel(inkoop)) return; // geen marge-berekening
    try {
      const verkoop = verkoopprijsUitMarge(inkoop!, marge, false);
      updateRegel(regel.id, { margePercentage: marge, prijsPerEenheid: verkoop });
    } catch {
      updateRegel(regel.id, { margePercentage: marge });
    }
  };

  /** Verkoopprijs invullen → marge */
  const wijzigVerkoop = (regel: VrijeRegel, verkoop: number) => {
    const inkoop = regel.inkoopprijsPerEenheid;
    if (regel.prijsOpRegel || isPrijsOpRegel(inkoop) || verkoop <= 0) {
      updateRegel(regel.id, { prijsPerEenheid: verkoop });
      return;
    }
    try {
      const marge = margeUitVerkoopprijs(inkoop!, verkoop, false);
      updateRegel(regel.id, { prijsPerEenheid: verkoop, margePercentage: marge });
    } catch {
      updateRegel(regel.id, { prijsPerEenheid: verkoop });
    }
  };

  /** Inkoopprijs wijzigen: marge vasthouden waar mogelijk */
  const wijzigInkoop = (regel: VrijeRegel, inkoop: number) => {
    if (isPrijsOpRegel(inkoop)) {
      updateRegel(regel.id, {
        inkoopprijsPerEenheid: undefined,
        prijsOpRegel: true,
        margePercentage: undefined,
      });
      return;
    }
    const patch: Partial<VrijeRegel> = {
      inkoopprijsPerEenheid: inkoop,
      prijsOpRegel: undefined,
    };
    if (regel.prijsPerEenheid > 0) {
      try {
        patch.margePercentage = margeUitVerkoopprijs(
          inkoop,
          regel.prijsPerEenheid,
          false
        );
      } catch {
        /* marge blijft zoals hij was */
      }
    }
    updateRegel(regel.id, patch);
  };

  const voegVrijeRegelToe = (hoofdstuk: string) => {
    onChange([
      ...regels,
      {
        id: nieuwId(),
        scope: hoofdstuk,
        omschrijving: "",
        eenheid: "stuk",
        hoeveelheid: 1,
        prijsPerEenheid: 0,
        totaal: 0,
        type: "materiaal",
        btwCode: 21,
      },
    ]);
  };

  const voegArtikelToe = (hoofdstuk: string, product: PickerProduct) => {
    const regel = productNaarRegel(
      product,
      hoofdstuk,
      nieuwId(),
      standaardMargePercentage
    );
    onChange([...regels, regel]);
  };

  const verwijderRegel = (id: string) => {
    onChange(regels.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      {hoofdstukken.map((hoofdstuk) => {
        const hoofdstukRegels = regels.filter((r) => r.scope === hoofdstuk);
        return (
          <Card key={hoofdstuk}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{hoofdstuk}</span>
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  Subtotaal {formatCurrency(subtotalen.get(hoofdstuk) ?? 0)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hoofdstukRegels.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nog geen regels in dit hoofdstuk.
                </p>
              )}
              {hoofdstukRegels.map((regel) => (
                <div
                  key={regel.id}
                  className="rounded-md border p-3 space-y-2"
                  data-testid="vrije-regel"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={regel.omschrijving}
                      onChange={(e) =>
                        updateRegel(regel.id, { omschrijving: e.target.value })
                      }
                      placeholder="Omschrijving"
                      aria-label="Omschrijving"
                      className="flex-1"
                    />
                    <Select
                      value={regel.type}
                      onValueChange={(type) =>
                        updateRegel(regel.id, {
                          type: type as VrijeRegel["type"],
                          eenheid: type === "arbeid" ? "uur" : regel.eenheid,
                        })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-32" aria-label="Soort regel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materiaal">Materiaal</SelectItem>
                        <SelectItem value="arbeid">Arbeid</SelectItem>
                        <SelectItem value="machine">Machine</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => verwijderRegel(regel.id)}
                      aria-label="Regel verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Aantal
                      <NumberInput
                        value={regel.hoeveelheid}
                        onChange={(hoeveelheid) =>
                          updateRegel(regel.id, { hoeveelheid })
                        }
                        min={0}
                        aria-label="Aantal"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Eenheid
                      <Input
                        value={regel.eenheid}
                        onChange={(e) =>
                          updateRegel(regel.id, { eenheid: e.target.value })
                        }
                        aria-label="Eenheid"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Inkoop €
                      <NumberInput
                        value={regel.inkoopprijsPerEenheid ?? 0}
                        onChange={(inkoop) => wijzigInkoop(regel, inkoop)}
                        min={0}
                        step={0.01}
                        aria-label="Inkoopprijs per eenheid"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Marge % <MargefactorInfo />
                      </span>
                      {regel.prijsOpRegel ||
                      isPrijsOpRegel(regel.inkoopprijsPerEenheid) ? (
                        <Input
                          value="prijs op regel"
                          disabled
                          aria-label="Marge niet beschikbaar: prijs op regel"
                        />
                      ) : (
                        <NumberInput
                          value={regel.margePercentage ?? 0}
                          onChange={(marge) => wijzigMarge(regel, marge)}
                          min={0}
                          max={99.9}
                          step={0.1}
                          aria-label="Marge percentage"
                        />
                      )}
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Verkoop €
                      <NumberInput
                        value={regel.prijsPerEenheid}
                        onChange={(verkoop) => wijzigVerkoop(regel, verkoop)}
                        min={0}
                        step={0.01}
                        aria-label="Verkoopprijs per eenheid"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Korting %
                      <NumberInput
                        value={regel.kortingPercentage ?? 0}
                        onChange={(korting) =>
                          updateRegel(regel.id, {
                            kortingPercentage: korting > 0 ? korting : undefined,
                          })
                        }
                        min={0}
                        max={100}
                        aria-label="Korting percentage per regel"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Btw
                      <Select
                        value={String(regel.btwCode ?? 21)}
                        onValueChange={(code) =>
                          updateRegel(regel.id, {
                            btwCode: Number(code) as 9 | 21,
                          })
                        }
                      >
                        <SelectTrigger aria-label="Btw-code">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9">9%</SelectItem>
                          <SelectItem value="21">21%</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <p className="text-right text-sm font-medium tabular-nums">
                    Regeltotaal {formatCurrency(regel.totaal)}
                  </p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerHoofdstuk(hoofdstuk)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Artikel uit bestand
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => voegVrijeRegelToe(hoofdstuk)}
                >
                  <PenLine className="mr-2 h-4 w-4" />
                  Vrije regel
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <Input
          value={nieuwHoofdstuk}
          onChange={(e) => setNieuwHoofdstuk(e.target.value)}
          placeholder="Nieuw hoofdstuk (bv. Beplanting)"
          aria-label="Naam nieuw hoofdstuk"
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={
            !nieuwHoofdstuk.trim() || hoofdstukken.includes(nieuwHoofdstuk.trim())
          }
          onClick={() => {
            setExtraHoofdstukken((prev) => [...prev, nieuwHoofdstuk.trim()]);
            setNieuwHoofdstuk("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Hoofdstuk
        </Button>
      </div>

      <ArtikelPicker
        open={pickerHoofdstuk !== null}
        onOpenChange={(open) => !open && setPickerHoofdstuk(null)}
        onSelect={(product) =>
          pickerHoofdstuk && voegArtikelToe(pickerHoofdstuk, product)
        }
      />
    </div>
  );
}
