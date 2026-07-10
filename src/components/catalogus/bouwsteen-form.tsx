"use client";

/**
 * Formulier voor aanmaken/bewerken van een bouwsteen (PRD §2.5f).
 *
 * Bevat de uur/vast-schakelaar met live-berekening bij "uren":
 * "X uur × €65 = €Y per beurt" (leermodus, principe 6) en per rekenveld
 * een (i)-toelichting van maximaal twee zinnen.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format/currency";
import {
  BOUWSTEEN_CATEGORIEEN,
  BOUWSTEEN_SOORTEN,
  CATEGORIE_LABELS,
  MAAND_LABELS,
  SOORT_LABELS,
  type BouwsteenCategorie,
  type BouwsteenSoort,
} from "@/lib/catalogus";

// ─── (i)-toelichting (leermodus, principe 6: max twee zinnen) ────────────────

function InfoHint({ tekst }: { tekst: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Toelichting"
          className="inline-flex text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">{tekst}</TooltipContent>
    </Tooltip>
  );
}

// ─── Zod-schema (invoer als tekst, geconverteerd bij submit) ─────────────────

const getalPatroon = /^\d+([.,]\d+)?$/;
const optioneelGetal = z
  .string()
  .refine((s) => s.trim() === "" || getalPatroon.test(s.trim()), {
    message: "Vul een geldig getal in",
  });

const bouwsteenFormSchema = z
  .object({
    naam: z.string().min(1, "Naam is verplicht"),
    code: z
      .string()
      .regex(/^[a-zA-Z0-9]{1,6}$/, "1-6 letters of cijfers (bv. HS)"),
    categorie: z.enum(BOUWSTEEN_CATEGORIEEN),
    soort: z.enum(BOUWSTEEN_SOORTEN),
    prijsmodel: z.enum(["uren", "vast"]),
    urenPerBeurt: optioneelGetal,
    vastBedragPerBeurt: optioneelGetal,
    optiePrijsVoegzand: optioneelGetal,
    optiePrijsStraatzand: optioneelGetal,
    defaultFrequentiePerJaar: optioneelGetal,
    seizoensvensterVan: z.string(),
    seizoensvensterTot: z.string(),
    btwCode: z.enum(["9", "21"]),
    normurenPerEenheid: optioneelGetal,
    eenheid: z.string(),
    receptuur: z.string(),
    opmerking: z.string(),
  })
  .refine(
    (d) =>
      (d.seizoensvensterVan === "") === (d.seizoensvensterTot === ""),
    {
      message: "Vul zowel van- als tot-maand in, of laat beide leeg",
      path: ["seizoensvensterTot"],
    }
  );

export type BouwsteenFormValues = z.infer<typeof bouwsteenFormSchema>;

export interface BouwsteenSubmitData {
  naam: string;
  code: string;
  categorie: BouwsteenCategorie;
  soort: BouwsteenSoort;
  prijsmodel: "uren" | "vast";
  urenPerBeurt?: number;
  vastBedragPerBeurt?: number;
  optiePrijsVoegzand?: number;
  optiePrijsStraatzand?: number;
  defaultFrequentiePerJaar?: number;
  seizoensvensterVan?: number;
  seizoensvensterTot?: number;
  btwCode: 9 | 21;
  normurenPerEenheid?: number;
  eenheid?: string;
  receptuurstappen?: { volgorde: number; omschrijving: string }[];
  opmerking?: string;
}

export interface BouwsteenFormInitial {
  naam: string;
  code: string;
  categorie: BouwsteenCategorie;
  soort: BouwsteenSoort;
  prijsmodel: "uren" | "vast";
  urenPerBeurt?: number;
  vastBedragPerBeurt?: number;
  optiePrijsVoegzand?: number;
  optiePrijsStraatzand?: number;
  defaultFrequentiePerJaar?: number;
  seizoensvensterVan?: number;
  seizoensvensterTot?: number;
  btwCode: 9 | 21;
  normurenPerEenheid?: number;
  eenheid?: string;
  receptuurstappen?: { volgorde: number; omschrijving: string }[];
  opmerking?: string;
}

function parseGetal(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  return Number(t.replace(",", "."));
}

function naarFormValues(b?: BouwsteenFormInitial): BouwsteenFormValues {
  return {
    naam: b?.naam ?? "",
    code: b?.code ?? "",
    categorie: b?.categorie ?? "gras_gazon",
    soort: b?.soort ?? "terugkerend",
    prijsmodel: b?.prijsmodel ?? "uren",
    urenPerBeurt: b?.urenPerBeurt !== undefined ? String(b.urenPerBeurt) : "",
    vastBedragPerBeurt:
      b?.vastBedragPerBeurt !== undefined ? String(b.vastBedragPerBeurt) : "",
    optiePrijsVoegzand:
      b?.optiePrijsVoegzand !== undefined ? String(b.optiePrijsVoegzand) : "",
    optiePrijsStraatzand:
      b?.optiePrijsStraatzand !== undefined
        ? String(b.optiePrijsStraatzand)
        : "",
    defaultFrequentiePerJaar:
      b?.defaultFrequentiePerJaar !== undefined
        ? String(b.defaultFrequentiePerJaar)
        : "",
    seizoensvensterVan:
      b?.seizoensvensterVan !== undefined ? String(b.seizoensvensterVan) : "",
    seizoensvensterTot:
      b?.seizoensvensterTot !== undefined ? String(b.seizoensvensterTot) : "",
    btwCode: b?.btwCode === 9 ? "9" : "21",
    normurenPerEenheid:
      b?.normurenPerEenheid !== undefined ? String(b.normurenPerEenheid) : "",
    eenheid: b?.eenheid ?? "",
    receptuur:
      b?.receptuurstappen
        ?.slice()
        .sort((a, z2) => a.volgorde - z2.volgorde)
        .map((s) => s.omschrijving)
        .join("\n") ?? "",
    opmerking: b?.opmerking ?? "",
  };
}

interface BouwsteenFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BouwsteenSubmitData) => Promise<void>;
  initial?: BouwsteenFormInitial;
  huidigUurtarief: number | null;
  isSaving: boolean;
}

export function BouwsteenForm({
  open,
  onClose,
  onSubmit,
  initial,
  huidigUurtarief,
  isSaving,
}: BouwsteenFormProps) {
  const form = useForm<BouwsteenFormValues>({
    resolver: zodResolver(bouwsteenFormSchema),
    defaultValues: naarFormValues(initial),
  });

  useEffect(() => {
    if (open) {
      form.reset(naarFormValues(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const prijsmodel = form.watch("prijsmodel");
  const soort = form.watch("soort");
  const urenTekst = form.watch("urenPerBeurt");
  const uren = parseGetal(urenTekst ?? "");
  const liveBedrag =
    prijsmodel === "uren" &&
    uren !== undefined &&
    Number.isFinite(uren) &&
    huidigUurtarief !== null
      ? uren * huidigUurtarief
      : null;

  const handleSubmit = form.handleSubmit(async (values) => {
    const receptuurstappen = values.receptuur
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((omschrijving, i) => ({ volgorde: i + 1, omschrijving }));

    await onSubmit({
      naam: values.naam.trim(),
      code: values.code.trim().toUpperCase(),
      categorie: values.categorie,
      soort: values.soort,
      prijsmodel: values.prijsmodel,
      urenPerBeurt: parseGetal(values.urenPerBeurt),
      vastBedragPerBeurt: parseGetal(values.vastBedragPerBeurt),
      optiePrijsVoegzand:
        values.soort === "keuzeregel"
          ? parseGetal(values.optiePrijsVoegzand)
          : undefined,
      optiePrijsStraatzand:
        values.soort === "keuzeregel"
          ? parseGetal(values.optiePrijsStraatzand)
          : undefined,
      defaultFrequentiePerJaar: parseGetal(values.defaultFrequentiePerJaar),
      seizoensvensterVan: parseGetal(values.seizoensvensterVan),
      seizoensvensterTot: parseGetal(values.seizoensvensterTot),
      btwCode: values.btwCode === "9" ? 9 : 21,
      normurenPerEenheid: parseGetal(values.normurenPerEenheid),
      eenheid: values.eenheid.trim() || undefined,
      receptuurstappen:
        receptuurstappen.length > 0 ? receptuurstappen : undefined,
      opmerking: values.opmerking.trim() || undefined,
    });
  });

  const maandOpties = MAAND_LABELS.map((label, i) => ({
    value: String(i + 1),
    label,
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Bouwsteen bewerken" : "Nieuwe bouwsteen"}
          </DialogTitle>
          <DialogDescription>
            Een bouwsteen toevoegen of wijzigen is een record beheren — geen
            code, geen deploy.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <FormField
                control={form.control}
                name="naam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naam</FormLabel>
                    <FormControl>
                      <Input placeholder="bv. Heggen snoeien" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Code
                      <InfoHint tekst="Korte unieke code voor compacte weergave op dagkaart en planbord. Bijvoorbeeld HS voor heggen snoeien." />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="HS" maxLength={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="categorie"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categorie</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BOUWSTEEN_CATEGORIEEN.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORIE_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="soort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Soort
                      <InfoHint tekst="Terugkerend plant zich per frequentie in, eenmalig en op afroep niet. Kosten-, keuzeregels en bundels zijn offerte-regels, geen los werk." />
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BOUWSTEEN_SOORTEN.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SOORT_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prijsmodel: uur/vast-schakelaar met live-berekening */}
            <div className="space-y-3 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="prijsmodel"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-1">
                      Prijsmodel: {field.value === "uren" ? "op uren" : "vaste prijs"}
                      <InfoHint tekst="Op uren rekent geschatte uren × het geldende uurtarief. Vaste prijs is een vast bedrag per beurt; op elke offerteregel blijft de prijs handmatig overschrijfbaar." />
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            field.value === "uren"
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          Uren
                        </span>
                        <Switch
                          checked={field.value === "vast"}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? "vast" : "uren")
                          }
                          aria-label="Wissel tussen uurbasis en vaste prijs"
                        />
                        <span
                          className={
                            field.value === "vast"
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          Vast
                        </span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {prijsmodel === "uren" ? (
                <>
                  <FormField
                    control={form.control}
                    name="urenPerBeurt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Geschatte uren per beurt
                          <InfoHint tekst="Uren × het geldende uurtarief bepaalt de prijs per beurt. Leeg laten mag: dan wordt de prijs later per offerte geschat." />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="bv. 2,5"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="live-berekening"
                  >
                    {liveBedrag !== null && huidigUurtarief !== null ? (
                      <>
                        {String(uren).replace(".", ",")} uur ×{" "}
                        {formatCurrency(huidigUurtarief)} ={" "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(liveBedrag)}
                        </span>{" "}
                        per beurt
                      </>
                    ) : huidigUurtarief !== null ? (
                      <>
                        Vul uren in om de prijs per beurt te zien (uurtarief:{" "}
                        {formatCurrency(huidigUurtarief)} ex btw).
                      </>
                    ) : (
                      <>Er is nog geen uurtarief ingesteld.</>
                    )}
                  </p>
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="vastBedragPerBeurt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Vast bedrag per beurt (ex btw)
                        <InfoHint tekst="Vast bedrag dat per beurt wordt gerekend, ongeacht de bestede uren. Leeg laten mag: dan vult kantoor de prijs later in." />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="bv. 150"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Keuzeregel (bijlage A #17, zand): default prijs per optie —
                de wizard vult hiermee de twee zichtbare zandprijzen voor */}
            {soort === "keuzeregel" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="optiePrijsVoegzand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Prijs onkruidvrij voegzand (ex btw)
                        <InfoHint tekst="Default prijs per beurt voor de optie onkruidvrij voegzand. De offerte-wizard toont beide prijzen; de klantkeuze bepaalt de prijs." />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="bv. 95"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="optiePrijsStraatzand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Prijs straatzand (ex btw)
                        <InfoHint tekst="Default prijs per beurt voor de optie straatzand. De offerte-wizard toont beide prijzen; de klantkeuze bepaalt de prijs." />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="bv. 75"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="defaultFrequentiePerJaar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Frequentie/jaar
                      <InfoHint tekst="Standaard aantal beurten per jaar; de offerte rekent frequentie × prijs per beurt door naar jaarprijs. Per contract aanpasbaar." />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="bv. 26"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seizoensvensterVan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seizoen van</FormLabel>
                    <Select
                      value={field.value === "" ? "geen" : field.value}
                      onValueChange={(val) =>
                        field.onChange(val === "geen" ? "" : val)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="geen">—</SelectItem>
                        {maandOpties.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seizoensvensterTot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Seizoen tot
                      <InfoHint tekst="Maanden waarbinnen deze bouwsteen wordt ingepland, bijvoorbeeld maart tot november voor maaien. Leeg = het hele jaar." />
                    </FormLabel>
                    <Select
                      value={field.value === "" ? "geen" : field.value}
                      onValueChange={(val) =>
                        field.onChange(val === "geen" ? "" : val)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="geen">—</SelectItem>
                        {maandOpties.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="btwCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Btw
                      <InfoHint tekst="9% geldt voor levende planten en sierteelt. Arbeid en materialen vallen onder 21%." />
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="21">21%</SelectItem>
                        <SelectItem value="9">9%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="normurenPerEenheid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Normuren/eenheid
                      <InfoHint tekst="Optionele hulpsuggestie: uren per eenheid (bv. per meter haag) voor de urenschatting. Groeit later vanzelf uit de nacalculatie." />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="bv. 0,1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eenheid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Eenheid</FormLabel>
                    <FormControl>
                      <Input placeholder="bv. m, m²" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="receptuur"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Receptuurstappen (één per regel, optioneel)
                    <InfoHint tekst="Vaste stapvolgorde die ook op de werkbon komt, zoals borstelen, reinigen, invegen. Alleen invullen voor recepturen zoals de reinigingsbeurt." />
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={
                        "Onkruid machinaal borstelen\nReinigen (Biomix of hogedruk)\nInvegen"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="opmerking"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opmerking (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Bijzonderheden, bv. buiten broedseizoen"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {initial ? "Opslaan" : "Toevoegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
