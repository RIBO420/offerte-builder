"use client";

import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";
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

/**
 * Anatomie van één regel — de volgorde waarin een hovenier hem invult:
 *
 * ```
 * ┌ omschrijving (dominant, groeit) ── soort ── verwijder ┐
 * └ rekenstrook: aantal × eenheid │ inkoop → marge → verkoop → korting → btw │ TOTAAL ┘
 * ```
 *
 * Drie keuzes die je anders opnieuw maakt:
 *
 * 1. **Geen steppers op geld en percentages.** `NumberInput` zet standaard een
 *    −/+ knop van 40px aan wéérszijden van het veld; zeven van die clusters
 *    naast elkaar was de klacht ("nogal op elkaar gecropt"). Niemand klikt
 *    €1.250 bij elkaar, en ook `Aantal` is hier vaak een gemeten waarde
 *    (34,5 m², 6,25 uur) in plaats van een telling — dus overal
 *    `showStepper={false}`. Ophogen kan nog steeds met ↑/↓: `handleKeyDown` in
 *    `NumberInput` staat los van de knoppen. Dat scheelt ~560px aan chrome,
 *    precies de ruimte die de velden zelf nodig hadden.
 * 2. **Getallen rechts, `tabular-nums`.** De cijferkolommen liggen daarmee
 *    onder elkaar uit; via `[&_input]` omdat `NumberInput` zijn `className` op
 *    de wikkel zet, niet op de `<input type="text" inputmode="decimal">`.
 * 3. **Nooit zijwaarts scrollen.** De strook is `flex-wrap` (harde regel 1) en
 *    het regeltotaal hangt aan een container-query op de rij zelf — dezelfde
 *    rij staat in de brede offertekolom én in de smallere factuur-opzet.
 */
const CEL_LABEL =
  "flex items-center gap-1 text-[11px] leading-none font-medium uppercase tracking-wide";

/** Getalveld: rechts uitgelijnd en tabulair, zodat de kolom onder elkaar valt. */
const GETAL_VELD = "[&_input]:text-right [&_input]:tabular-nums";

/**
 * Eén cel in de rekenstrook: het label staat strak boven zijn eigen veld (niet
 * los boven een cluster) en de cel bepaalt de breedte, niet het veld.
 * De toegankelijke naam komt uit de `aria-label` van het veld zelf, dus dit is
 * bewust een `<div>`: een `<label>` om een select-trigger schakelt dubbel.
 */
function Cel({
  label,
  breedte,
  nadruk,
  uitleg,
  children,
}: {
  label: string;
  /** Tailwind-breedte; `max-w-full` houdt hem binnen een smalle container. */
  breedte: string;
  /** Het veld dat de prijs draagt (verkoop) mag zwaarder wegen dan zijn buren. */
  nadruk?: boolean;
  uitleg?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 max-w-full flex-col gap-1.5", breedte)}>
      <span
        className={cn(
          CEL_LABEL,
          nadruk ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {uitleg}
      </span>
      {children}
    </div>
  );
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
          <Card key={hoofdstuk} className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/30 px-4 py-2.5 [.border-b]:pb-2.5">
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="tracking-tight">{hoofdstuk}</span>
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  Subtotaal{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(subtotalen.get(hoofdstuk) ?? 0)}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {hoofdstukRegels.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Nog geen regels in dit hoofdstuk.
                </p>
              )}
              {/* Regels als lijst met haarlijnen: een doos-in-een-doos per regel
                  gaf zeven randen boven elkaar en géén hiërarchie. */}
              <div className="divide-y">
                {hoofdstukRegels.map((regel) => {
                  const geenMarge =
                    regel.prijsOpRegel === true ||
                    isPrijsOpRegel(regel.inkoopprijsPerEenheid);
                  return (
                    <div
                      key={regel.id}
                      // @container/regel: dezelfde rij staat in de brede
                      // offertekolom én in de smalle factuur-opzet.
                      className="@container/regel px-4 py-3"
                      data-testid="vrije-regel"
                    >
                      {/* 1 — wát je levert. De omschrijving is de regel, dus die
                          krijgt de breedte en het enige niet-gedempte gewicht. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={regel.omschrijving}
                          onChange={(e) =>
                            updateRegel(regel.id, {
                              omschrijving: e.target.value,
                            })
                          }
                          placeholder="Omschrijving"
                          aria-label="Omschrijving"
                          className="h-10 min-w-[11rem] flex-1 text-sm font-medium sm:h-9"
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
                          <SelectTrigger
                            size="sm"
                            className="w-[8.5rem] @max-[24rem]/regel:flex-1"
                            aria-label="Soort regel"
                          >
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
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* 2 — wat het kost. Eén rustige strook i.p.v. zeven
                          losse clusters; het totaal sluit hem rechts af. */}
                      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2.5 rounded-md bg-muted/40 px-3 py-2.5">
                        {/* aantal × eenheid horen bij elkaar: kleinere tussenruimte */}
                        <div className="flex items-end gap-1.5">
                          <Cel label="Aantal" breedte="w-[4.75rem]">
                            <NumberInput
                              value={regel.hoeveelheid}
                              onChange={(hoeveelheid) =>
                                updateRegel(regel.id, { hoeveelheid })
                              }
                              min={0}
                              showStepper={false}
                              className={GETAL_VELD}
                              aria-label="Aantal"
                            />
                          </Cel>
                          <Cel label="Eenheid" breedte="w-[5.25rem]">
                            <Input
                              value={regel.eenheid}
                              onChange={(e) =>
                                updateRegel(regel.id, {
                                  eenheid: e.target.value,
                                })
                              }
                              aria-label="Eenheid"
                              className="h-10 text-sm sm:h-9"
                            />
                          </Cel>
                        </div>

                        <div className="flex flex-wrap items-end gap-x-2.5 gap-y-2.5">
                          <Cel label="Inkoop €" breedte="w-[6rem]">
                            <NumberInput
                              value={regel.inkoopprijsPerEenheid ?? 0}
                              onChange={(inkoop) => wijzigInkoop(regel, inkoop)}
                              min={0}
                              step={0.01}
                              showStepper={false}
                              className={GETAL_VELD}
                              aria-label="Inkoopprijs per eenheid"
                            />
                          </Cel>
                          <Cel
                            label="Marge %"
                            breedte="w-[5.75rem]"
                            uitleg={<MargefactorInfo />}
                          >
                            {geenMarge ? (
                              // Geen inkoopprijs → geen marge. "prijs op regel"
                              // paste niet in het veld en werd afgekapt; de
                              // uitleg staat nu in de tooltip van het veld.
                              <Input
                                value="n.v.t."
                                readOnly
                                disabled
                                title="Prijs op regel — zonder inkoopprijs valt er geen marge te berekenen"
                                aria-label="Marge niet beschikbaar: prijs op regel"
                                className="h-10 text-right text-sm sm:h-9"
                              />
                            ) : (
                              <NumberInput
                                value={regel.margePercentage ?? 0}
                                onChange={(marge) => wijzigMarge(regel, marge)}
                                min={0}
                                max={99.9}
                                step={0.1}
                                showStepper={false}
                                className={GETAL_VELD}
                                aria-label="Marge percentage"
                              />
                            )}
                          </Cel>
                          <Cel label="Verkoop €" breedte="w-[6rem]" nadruk>
                            <NumberInput
                              value={regel.prijsPerEenheid}
                              onChange={(verkoop) =>
                                wijzigVerkoop(regel, verkoop)
                              }
                              min={0}
                              step={0.01}
                              showStepper={false}
                              className={GETAL_VELD}
                              aria-label="Verkoopprijs per eenheid"
                            />
                          </Cel>
                          <Cel label="Korting %" breedte="w-[5.75rem]">
                            <NumberInput
                              value={regel.kortingPercentage ?? 0}
                              onChange={(korting) =>
                                updateRegel(regel.id, {
                                  kortingPercentage:
                                    korting > 0 ? korting : undefined,
                                })
                              }
                              min={0}
                              max={100}
                              showStepper={false}
                              className={GETAL_VELD}
                              aria-label="Korting percentage per regel"
                            />
                          </Cel>
                          <Cel label="Btw" breedte="w-[5rem]">
                            <Select
                              value={String(regel.btwCode ?? 21)}
                              onValueChange={(code) =>
                                updateRegel(regel.id, {
                                  btwCode: Number(code) as 9 | 21,
                                })
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-full"
                                aria-label="Btw-code"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="9">9%</SelectItem>
                                <SelectItem value="21">21%</SelectItem>
                              </SelectContent>
                            </Select>
                          </Cel>
                        </div>

                        {/* De uitkomst van de keten, in dezelfde strook. Past
                            hij er niet naast, dan wordt het een eigen regel
                            mét scheidingslijn — nooit zijwaarts scrollen. */}
                        <div className="ml-auto flex flex-col items-end gap-1.5 @max-[40rem]/regel:w-full @max-[40rem]/regel:flex-row @max-[40rem]/regel:items-center @max-[40rem]/regel:justify-between @max-[40rem]/regel:gap-2 @max-[40rem]/regel:border-t @max-[40rem]/regel:border-border/70 @max-[40rem]/regel:pt-2">
                          <span className={cn(CEL_LABEL, "text-muted-foreground")}>
                            Regeltotaal
                          </span>
                          <span className="flex h-10 items-center text-[15px] font-semibold tabular-nums sm:h-9">
                            {formatCurrency(regel.totaal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 border-t px-4 py-3">
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
