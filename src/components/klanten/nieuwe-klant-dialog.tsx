"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, UserPlus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { klantSchema } from "@/lib/validations/klant";
import { samengesteldeNaam, splitsNaam } from "@convex/lib/klantNaam";
import { BedrijfZoeken } from "@/components/klanten/bedrijf-zoeken";
import { AdresVeld } from "@/components/klanten/adres-veld";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

/**
 * Eén lijst klanttypes met hun Nederlandse naam. Geëxporteerd omdat het
 * bewerkformulier in het klantdossier (Instellingen-tab) exact dezelfde keuze
 * aanbiedt — twee lijstjes die uit elkaar lopen is precies hoe "Zakelijk" op
 * de ene plek "Bedrijf" gaat heten op de andere.
 */
export const KLANT_TYPE_OPTIONS: { value: KlantType; label: string }[] = [
  { value: "particulier", label: "Particulier" },
  { value: "zakelijk", label: "Zakelijk" },
  { value: "vve", label: "VvE" },
  { value: "gemeente", label: "Gemeente" },
  { value: "overig", label: "Overig" },
];

/** De klant zoals de offerte-flows hem verwachten (zelfde vorm als klanten.list). */
export interface AangemaakteKlant {
  _id: Id<"klanten">;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
}

export interface NieuweKlantWaarden {
  naam?: string;
  /**
   * Naamdelen van een particulier. Optioneel: geeft een aanroeper alleen
   * `naam` mee (offerte-wizard, lead), dan splitst de dialog die zelf.
   */
  voornaam?: string;
  achternaam?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  email?: string;
  telefoon?: string;
  telefoon2?: string;
}

interface NieuweKlantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Wat de gebruiker al had ingetypt in de offerte-wizard — zo gaat er niets
   * verloren als hij halverwege besluit de klant echt aan te maken.
   */
  initialValues?: NieuweKlantWaarden;
  /** Wordt aangeroepen met de zojuist aangemaakte klant, klaar om te selecteren. */
  onCreated: (klant: AangemaakteKlant) => void;
}

type VeldFouten = Partial<Record<keyof NieuweKlantWaarden, string>>;

const LEEG = {
  naam: "",
  voornaam: "",
  achternaam: "",
  adres: "",
  postcode: "",
  plaats: "",
  email: "",
  telefoon: "",
  telefoon2: "",
  contactpersoon: "",
  kvkNummer: "",
  btwNummer: "",
};

/** Particulieren hebben geen contactpersoon, KvK of BTW-nummer. */
export function isZakelijk(type: KlantType): boolean {
  return type !== "particulier";
}

/**
 * Klant aanmaken zónder de offerte-flow te verlaten (voorheen moest de klant
 * eerst via /klanten worden aangemaakt). De klant landt gewoon in het
 * klantenbestand; de aanroeper selecteert hem daarna direct.
 */
export function NieuweKlantDialog({
  open,
  onOpenChange,
  initialValues,
  onCreated,
}: NieuweKlantDialogProps) {
  const createKlant = useMutation(api.klanten.create);

  const [form, setForm] = useState({ ...LEEG });
  const [klantType, setKlantType] = useState<KlantType>("particulier");
  const [fouten, setFouten] = useState<VeldFouten>({});
  const [bezig, setBezig] = useState(false);

  // Prefill bij openen (en resetten bij sluiten), zodat een tweede klant niet
  // de gegevens van de vorige overneemt.
  useEffect(() => {
    if (!open) return;

    /**
     * De dialog opent altijd als particulier, en daar zijn voor- en achternaam
     * de velden op het scherm. Krijgen we alleen een samengestelde `naam` mee
     * (offerte-wizard, lead), dan splitsen we die hier, zodat de voorvulling
     * niet in een onzichtbaar veld verdwijnt.
     */
    const gesplitst =
      initialValues?.voornaam || initialValues?.achternaam
        ? {
            voornaam: initialValues.voornaam ?? "",
            achternaam: initialValues.achternaam ?? "",
          }
        : splitsNaam(initialValues?.naam ?? "");

    setForm({
      naam: initialValues?.naam ?? "",
      voornaam: gesplitst.voornaam,
      achternaam: gesplitst.achternaam,
      adres: initialValues?.adres ?? "",
      postcode: initialValues?.postcode ?? "",
      plaats: initialValues?.plaats ?? "",
      email: initialValues?.email ?? "",
      telefoon: initialValues?.telefoon ?? "",
      telefoon2: initialValues?.telefoon2 ?? "",
      contactpersoon: "",
      kvkNummer: "",
      btwNummer: "",
    });
    setKlantType("particulier");
    setFouten({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen prefillen op het moment van openen
  }, [open]);

  const setVeld = (veld: keyof typeof LEEG, waarde: string) => {
    setForm((prev) => ({ ...prev, [veld]: waarde }));
    setFouten((prev) => ({ ...prev, [veld]: undefined }));
  };

  const handleSubmit = async () => {
    const particulier = !isZakelijk(klantType);

    /**
     * `naam` blijft de weergavenaam en is bij een particulier afgeleid van de
     * twee velden op het scherm. Bewust met een lege `naam` als basis: heeft
     * de gebruiker beide velden leeggemaakt, dan moet de melding "verplicht"
     * verschijnen en niet stilletjes de voorgevulde naam terugkomen.
     */
    const naam = particulier
      ? samengesteldeNaam({
          voornaam: form.voornaam,
          achternaam: form.achternaam,
          naam: "",
        })
      : form.naam;

    // Dezelfde zod-validatie als de klantenpagina — één waarheid over wat een
    // geldige klant is (postcode-formaat, e-mail, telefoon).
    const { contactpersoon, kvkNummer, btwNummer, ...adresVelden } = form;
    const resultaat = klantSchema.safeParse({ ...adresVelden, naam });
    if (!resultaat.success) {
      const nieuweFouten: VeldFouten = {};
      for (const issue of resultaat.error.issues) {
        const veld = issue.path[0] as keyof NieuweKlantWaarden | undefined;
        if (veld && !nieuweFouten[veld]) nieuweFouten[veld] = issue.message;
      }
      // Een particulier ziet geen naamveld: de melding hoort bij achternaam.
      if (particulier && nieuweFouten.naam) {
        nieuweFouten.achternaam ??= "Achternaam is verplicht";
        delete nieuweFouten.naam;
      }
      setFouten(nieuweFouten);
      return;
    }

    const data = resultaat.data;
    setBezig(true);
    try {
      const id = await createKlant({
        naam: data.naam,
        // Alleen bij een particulier: bij een bedrijf zou de backend `naam`
        // uit de naamdelen afleiden en zo de bedrijfsnaam overschrijven.
        voornaam: particulier ? data.voornaam : undefined,
        achternaam: particulier ? data.achternaam : undefined,
        adres: data.adres,
        postcode: data.postcode,
        plaats: data.plaats,
        email: data.email,
        telefoon: data.telefoon,
        telefoon2: data.telefoon2,
        klantType,
        // Alleen meesturen als ze bij dit klanttype horen, zodat een
        // achtergebleven waarde na wisselen van type niet stilletjes meegaat.
        contactpersoon: isZakelijk(klantType) ? contactpersoon || undefined : undefined,
        kvkNummer: isZakelijk(klantType) ? kvkNummer || undefined : undefined,
        btwNummer: isZakelijk(klantType) ? btwNummer || undefined : undefined,
      });

      onCreated({
        _id: id,
        naam: data.naam,
        adres: data.adres,
        postcode: data.postcode,
        plaats: data.plaats,
        email: data.email,
        telefoon: data.telefoon,
      });
      showSuccessToast(`Klant ${data.naam} aangemaakt en geselecteerd`);
      onOpenChange(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij aanmaken klant"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(volgende) => {
        if (!volgende && bezig) return;
        onOpenChange(volgende);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Nieuwe klant aanmaken
          </DialogTitle>
          <DialogDescription>
            Wordt direct toegevoegd aan je klantenbestand.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* TT-006: zoeken vult de velden hieronder, handmatig kan altijd. */}
          <BedrijfZoeken
            onGevonden={(bedrijf) => {
              setForm((prev) => ({
                ...prev,
                naam: bedrijf.naam || prev.naam,
                adres: bedrijf.adres || prev.adres,
                postcode: bedrijf.postcode || prev.postcode,
                plaats: bedrijf.plaats || prev.plaats,
                telefoon: bedrijf.telefoon || prev.telefoon,
              }));
              setFouten({});
            }}
          />

          {/* Type eerst: die keuze bepaalt welke velden hieronder verschijnen. */}
          <div className="space-y-1.5">
            <Label htmlFor="nk-type">Type klant *</Label>
            <Select
              value={klantType}
              onValueChange={(waarde) => setKlantType(waarde as KlantType)}
            >
              <SelectTrigger id="nk-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KLANT_TYPE_OPTIONS.map((optie) => (
                  <SelectItem key={optie.value} value={optie.value}>
                    {optie.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Particulier: voor- en achternaam apart — de klantenlijst sorteert
              op achternaam. Andere typen houden bedrijfsnaam + contactpersoon. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {isZakelijk(klantType) ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="nk-naam">Bedrijfsnaam *</Label>
                  <Input
                    id="nk-naam"
                    placeholder="De Groene Tuin B.V."
                    value={form.naam}
                    onChange={(e) => setVeld("naam", e.target.value)}
                    aria-invalid={Boolean(fouten.naam)}
                  />
                  {fouten.naam && (
                    <p className="text-xs text-destructive">{fouten.naam}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nk-contactpersoon">Contactpersoon</Label>
                  <Input
                    id="nk-contactpersoon"
                    placeholder="Jan Jansen"
                    value={form.contactpersoon}
                    onChange={(e) => setVeld("contactpersoon", e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="nk-voornaam">Voornaam</Label>
                  <Input
                    id="nk-voornaam"
                    placeholder="Jan"
                    value={form.voornaam}
                    onChange={(e) => setVeld("voornaam", e.target.value)}
                    aria-invalid={Boolean(fouten.voornaam)}
                  />
                  {fouten.voornaam && (
                    <p className="text-xs text-destructive">{fouten.voornaam}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nk-achternaam">Achternaam *</Label>
                  <Input
                    id="nk-achternaam"
                    placeholder="van der Berg"
                    value={form.achternaam}
                    onChange={(e) => setVeld("achternaam", e.target.value)}
                    aria-invalid={Boolean(fouten.achternaam)}
                  />
                  {fouten.achternaam && (
                    <p className="text-xs text-destructive">
                      {fouten.achternaam}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {isZakelijk(klantType) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nk-kvk">KvK-nummer</Label>
                <Input
                  id="nk-kvk"
                  inputMode="numeric"
                  placeholder="12345678"
                  value={form.kvkNummer}
                  onChange={(e) => setVeld("kvkNummer", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nk-btw">BTW-nummer</Label>
                <Input
                  id="nk-btw"
                  placeholder="NL123456789B01"
                  value={form.btwNummer}
                  onChange={(e) => setVeld("btwNummer", e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nk-adres">Adres *</Label>
            {/* Suggesties in het veld zelf: bij een particulier begin je bij
                het adres, niet bij een bedrijfsnaam. */}
            <AdresVeld
              id="nk-adres"
              waarde={form.adres}
              ongeldig={Boolean(fouten.adres)}
              onChange={(waarde) => setVeld("adres", waarde)}
              onAdresGekozen={(adres) => {
                setForm((prev) => ({
                  ...prev,
                  adres: adres.adres,
                  // Alleen overschrijven als Places het weet; anders houdt hij
                  // wat er al stond.
                  postcode: adres.postcode || prev.postcode,
                  plaats: adres.plaats || prev.plaats,
                }));
                setFouten({});
              }}
            />
            {fouten.adres && (
              <p className="text-xs text-destructive">{fouten.adres}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nk-postcode">Postcode *</Label>
              <Input
                id="nk-postcode"
                placeholder="1234 AB"
                value={form.postcode}
                onChange={(e) => setVeld("postcode", e.target.value)}
                aria-invalid={Boolean(fouten.postcode)}
              />
              {fouten.postcode && (
                <p className="text-xs text-destructive">{fouten.postcode}</p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nk-plaats">Plaats *</Label>
              <Input
                id="nk-plaats"
                placeholder="Amsterdam"
                value={form.plaats}
                onChange={(e) => setVeld("plaats", e.target.value)}
                aria-invalid={Boolean(fouten.plaats)}
              />
              {fouten.plaats && (
                <p className="text-xs text-destructive">{fouten.plaats}</p>
              )}
            </div>
          </div>

          {/* Twee nummers naast elkaar (vast naast mobiel, of dat van de
              partner) — zelfde validatie en melding. E-mail eronder over de
              volle breedte, want die is het langst. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nk-telefoon">Telefoon</Label>
              <Input
                id="nk-telefoon"
                placeholder="06-12345678"
                value={form.telefoon}
                onChange={(e) => setVeld("telefoon", e.target.value)}
                aria-invalid={Boolean(fouten.telefoon)}
              />
              {fouten.telefoon && (
                <p className="text-xs text-destructive">{fouten.telefoon}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nk-telefoon2">Telefoon 2</Label>
              <Input
                id="nk-telefoon2"
                placeholder="0522-123456"
                value={form.telefoon2}
                onChange={(e) => setVeld("telefoon2", e.target.value)}
                aria-invalid={Boolean(fouten.telefoon2)}
              />
              {fouten.telefoon2 && (
                <p className="text-xs text-destructive">{fouten.telefoon2}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nk-email">E-mail</Label>
            <Input
              id="nk-email"
              type="email"
              placeholder="jan@voorbeeld.nl"
              value={form.email}
              onChange={(e) => setVeld("email", e.target.value)}
              aria-invalid={Boolean(fouten.email)}
            />
            {fouten.email && (
              <p className="text-xs text-destructive">{fouten.email}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bezig}
          >
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={bezig}>
            {bezig ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Klant aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
