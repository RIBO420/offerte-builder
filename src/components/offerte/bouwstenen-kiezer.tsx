"use client";

/**
 * De bouwstenenkiezer: het onderhoudscontract binnen de offerte
 * (PRD §2.5a + bijlage A).
 *
 * Pakket-tegels (Onderhoud Tuin / Reiniging / Compleet) bovenin,
 * daaronder de actieve catalogus-bouwstenen als aan/uit-regels met
 * frequentie en prijs per beurt (default uit de catalogus, handmatig
 * overschrijfbaar), de reinigingsreceptuur met vaste stapvolgorde en
 * de zand-keuzeregel met twee prijzen. Onderaan live jaarprijs,
 * maandbedrag en eenmalig totaal.
 *
 * Dit is een laag BOVENOP de scope-calculatie: overslaan mag, de bestaande
 * engine blijft ongewijzigd doorlopen. Zat eerder als wizardstap
 * "Bouwstenen & Pakketten" in de onderhoud-wizard; in het werkblad is het een
 * sectie in het document.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyInput, QuantityInput } from "@/components/ui/number-input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Info,
  Loader2,
  ListOrdered,
  Package,
  Sparkles,
  SprayCan,
  Trees,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  BOUWSTEEN_CATEGORIEEN,
  CATEGORIE_LABELS,
  SOORT_LABELS,
  formatSeizoensvenster,
} from "@/lib/catalogus";
import {
  PAKKETTEN,
  ZAND_LABELS,
  berekenCatalogusTotalen,
  bouwOfferteBouwsteenRegels,
  defaultOptiePrijs,
  defaultPrijsToelichting,
  effectievePrijsPerBeurt,
  isEenmaligeSoort,
  pasPakketToe,
  type BouwsteenDefault,
  type CatalogusRegelState,
  type CatalogusSelectie,
  type PakketId,
  type ZandKeuze,
} from "@/lib/bouwsteen-offerte";

const PAKKET_ICONS: Record<PakketId, typeof Package> = {
  onderhoud: Trees,
  reiniging: SprayCan,
  compleet: Sparkles,
};

interface BouwstenenKiezerProps {
  bouwstenen: BouwsteenDefault[] | undefined;
  catalogus: CatalogusSelectie;
  setCatalogus: (
    updater:
      | CatalogusSelectie
      | ((prev: CatalogusSelectie) => CatalogusSelectie)
  ) => void;
}

export function BouwstenenKiezer({
  bouwstenen,
  catalogus,
  setCatalogus,
}: BouwstenenKiezerProps) {
  const isLoading = bouwstenen === undefined;
  const lijst = bouwstenen ?? [];

  const regelState = (b: BouwsteenDefault): CatalogusRegelState =>
    catalogus.regels[b._id] ?? {
      aan: false,
      frequentiePerJaar: b.defaultFrequentiePerJaar ?? 1,
      prijsPerBeurt: null,
    };

  const patchRegel = (
    b: BouwsteenDefault,
    patch: Partial<CatalogusRegelState>
  ) => {
    setCatalogus((prev) => {
      const huidige = prev.regels[b._id] ?? {
        aan: false,
        frequentiePerJaar: b.defaultFrequentiePerJaar ?? 1,
        prijsPerBeurt: null,
      };
      return {
        ...prev,
        regels: { ...prev.regels, [b._id]: { ...huidige, ...patch } },
      };
    });
  };

  const kiesPakket = (pakketId: PakketId) => {
    const pakket = PAKKETTEN.find((p) => p.id === pakketId);
    if (!pakket) return;
    setCatalogus((prev) => pasPakketToe(prev, pakket, lijst));
  };

  const setZandKeuze = (keuze: ZandKeuze) => {
    setCatalogus((prev) => ({ ...prev, zandKeuze: keuze }));
  };

  const setZandPrijs = (optie: ZandKeuze, prijs: number) => {
    setCatalogus((prev) => ({
      ...prev,
      zandPrijzen: { ...prev.zandPrijzen, [optie]: prijs },
    }));
  };

  // Live doorrekening over de actieve regels (frequentie × prijs per beurt)
  const actieveRegels = bouwOfferteBouwsteenRegels(lijst, catalogus);
  const totalen = berekenCatalogusTotalen(actieveRegels);
  const aantalAan = lijst.filter((b) => regelState(b).aan).length;

  const perCategorie = BOUWSTEEN_CATEGORIEEN.map((categorie) => ({
    categorie,
    bouwstenen: lijst.filter((b) => b.categorie === categorie),
  })).filter((groep) => groep.bouwstenen.length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Pakket-tegels (bijlage A) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pakketten</CardTitle>
            <CardDescription className="text-xs">
              Een pakket zet de bijbehorende bouwstenen aan — daarna per
              regel vrij aan te passen
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 sm:grid-cols-3">
              {PAKKETTEN.map((pakket) => {
                const Icon = PAKKET_ICONS[pakket.id];
                const geselecteerd = catalogus.pakket === pakket.id;
                return (
                  <button
                    key={pakket.id}
                    type="button"
                    onClick={() => kiesPakket(pakket.id)}
                    aria-pressed={geselecteerd}
                    className={`rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      geselecteerd ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
                    <div className="font-medium">{pakket.naam}</div>
                    <div className="text-xs text-muted-foreground">
                      {pakket.beschrijving}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bouwstenen als aan/uit-regels */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Catalogus laden…
            </CardContent>
          </Card>
        ) : lijst.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Catalogus is leeg</AlertTitle>
            <AlertDescription>
              Er zijn nog geen actieve bouwstenen. Beheer de catalogus onder
              Instellingen → Catalogus onderhoud.
            </AlertDescription>
          </Alert>
        ) : (
          perCategorie.map((groep) => (
            <Card key={groep.categorie}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {CATEGORIE_LABELS[groep.categorie]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {groep.bouwstenen.map((b) => {
                  const state = regelState(b);
                  const isKeuzeregel = b.soort === "keuzeregel";
                  const eenmalig = isEenmaligeSoort(b.soort);
                  const prijs = effectievePrijsPerBeurt(b, state, catalogus);
                  const venster = formatSeizoensvenster(
                    b.vensterVanMaand,
                    b.vensterTotMaand
                  );
                  const jaarprijs =
                    state.aan && prijs !== null
                      ? eenmalig
                        ? prijs
                        : state.frequentiePerJaar * prijs
                      : null;

                  return (
                    <div
                      key={b._id}
                      className={`rounded-lg border p-3 space-y-3 ${
                        state.aan ? "" : "opacity-70"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Switch
                          checked={state.aan}
                          onCheckedChange={(aan) => patchRegel(b, { aan })}
                          aria-label={`${b.naam} aan/uit`}
                        />
                        <span className="font-medium">{b.naam}</span>
                        <Badge variant="outline" className="text-xs">
                          {SOORT_LABELS[b.soort]}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {b.btwCode}% btw
                        </Badge>
                        {venster && (
                          <Badge variant="outline" className="text-xs">
                            Seizoen: {venster}
                          </Badge>
                        )}
                        {jaarprijs !== null && (
                          <span className="ml-auto text-sm font-medium tabular-nums">
                            {formatCurrency(jaarprijs)}
                            <span className="text-xs font-normal text-muted-foreground">
                              {eenmalig ? " eenmalig" : " /jaar"}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Reinigingsreceptuur: vaste stapvolgorde (bijlage A #16) */}
                      {b.receptuurstappen && b.receptuurstappen.length > 0 && (
                        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                          <div className="mb-1 flex items-center gap-1 font-medium">
                            <ListOrdered className="h-3 w-3" />
                            Vaste stapvolgorde (komt ook op de werkbon)
                          </div>
                          <ol className="ml-4 list-decimal space-y-0.5">
                            {[...b.receptuurstappen]
                              .sort((x, y) => x.volgorde - y.volgorde)
                              .map((stap) => (
                                <li key={stap.volgorde}>{stap.omschrijving}</li>
                              ))}
                          </ol>
                        </div>
                      )}

                      {state.aan && !isKeuzeregel && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {!eenmalig && (
                            <div className="space-y-1">
                              <Label
                                htmlFor={`freq-${b._id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Frequentie per jaar
                              </Label>
                              <QuantityInput
                                id={`freq-${b._id}`}
                                value={state.frequentiePerJaar}
                                min={1}
                                onChange={(frequentiePerJaar) =>
                                  patchRegel(b, {
                                    frequentiePerJaar: Math.max(
                                      1,
                                      Math.round(frequentiePerJaar)
                                    ),
                                  })
                                }
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label
                                htmlFor={`prijs-${b._id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Prijs per beurt (ex btw)
                              </Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`Toelichting default-prijs ${b.naam}`}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {defaultPrijsToelichting(b)}
                                  {state.prijsPerBeurt !== null &&
                                    " Deze regel gebruikt een handmatige prijs."}
                                </TooltipContent>
                              </Tooltip>
                              {state.prijsPerBeurt !== null && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-xs"
                                  onClick={() =>
                                    patchRegel(b, { prijsPerBeurt: null })
                                  }
                                >
                                  Herstel default
                                </Button>
                              )}
                            </div>
                            <CurrencyInput
                              id={`prijs-${b._id}`}
                              value={prijs ?? 0}
                              min={0}
                              onChange={(prijsPerBeurt) =>
                                patchRegel(b, { prijsPerBeurt })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Zand-keuzeregel (bijlage A #17): twee prijzen zichtbaar */}
                      {state.aan && isKeuzeregel && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Klant kiest het zand — beide prijzen staan in de
                            offerte, de keuze bepaalt de prijs van de
                            invegen-regel.
                          </p>
                          <RadioGroup
                            value={catalogus.zandKeuze}
                            onValueChange={(v) => setZandKeuze(v as ZandKeuze)}
                            className="grid gap-2 sm:grid-cols-2"
                          >
                            {(Object.keys(ZAND_LABELS) as ZandKeuze[]).map(
                              (optie) => (
                                <div
                                  key={optie}
                                  className={`flex items-center gap-2 rounded-md border p-2 ${
                                    catalogus.zandKeuze === optie
                                      ? "border-primary"
                                      : ""
                                  }`}
                                >
                                  <RadioGroupItem
                                    value={optie}
                                    id={`zand-${optie}`}
                                  />
                                  <Label
                                    htmlFor={`zand-${optie}`}
                                    className="flex-1 text-xs"
                                  >
                                    {ZAND_LABELS[optie]}
                                  </Label>
                                  <div className="w-28">
                                    <CurrencyInput
                                      aria-label={`Prijs ${ZAND_LABELS[optie]}`}
                                      value={
                                        catalogus.zandPrijzen[optie] ??
                                        defaultOptiePrijs(b, optie) ??
                                        b.defaultPrijsPerBeurt ??
                                        0
                                      }
                                      min={0}
                                      onChange={(prijsOptie) =>
                                        setZandPrijs(optie, prijsOptie)
                                      }
                                    />
                                  </div>
                                </div>
                              )
                            )}
                          </RadioGroup>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label
                                htmlFor={`freq-${b._id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Frequentie per jaar
                              </Label>
                              <QuantityInput
                                id={`freq-${b._id}`}
                                value={state.frequentiePerJaar}
                                min={1}
                                onChange={(frequentiePerJaar) =>
                                  patchRegel(b, {
                                    frequentiePerJaar: Math.max(
                                      1,
                                      Math.round(frequentiePerJaar)
                                    ),
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Live doorrekening van het contract */}
      <div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Doorrekening</CardTitle>
            <CardDescription className="text-xs">
              Frequentie × prijs per beurt, live meegerekend
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Actieve bouwstenen
                </span>
                <span className="font-medium tabular-nums">{aantalAan}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Jaarprijs</span>
                <span
                  className="font-medium tabular-nums"
                  data-testid="catalogus-jaarprijs"
                >
                  {formatCurrency(totalen.jaarprijs)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Maandbedrag (÷ 12)
                </span>
                <span
                  className="font-medium tabular-nums"
                  data-testid="catalogus-maandbedrag"
                >
                  {formatCurrency(totalen.maandbedrag)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Eenmalig</span>
                <span
                  className="font-medium tabular-nums"
                  data-testid="catalogus-eenmalig"
                >
                  {formatCurrency(totalen.eenmalig)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Eenmalige bouwstenen tellen niet mee in het maandbedrag.
                Bedragen ex btw.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
