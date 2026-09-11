"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  Info,
  Loader2,
  Pencil,
  ShieldAlert,
  SlidersHorizontal,
  User,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SectieLegeStaat, SectiePaneel } from "@/components/ui/sectie-paneel";
import { Switch } from "@/components/ui/switch";
import { TextareaWithCount } from "@/components/ui/textarea-with-count";
import { AdresVeld } from "@/components/klanten/adres-veld";
import { Feit } from "@/components/klanten/klant-detail-primitieven";
import {
  isZakelijk,
  KLANT_TYPE_OPTIONS,
  type KlantType,
} from "@/components/klanten/nieuwe-klant-dialog";
import { LeadHistorieCard } from "@/components/leads/lead-historie-card";
import { useIsAdmin } from "@/hooks/use-users";
import { klantSchema } from "@/lib/validations/klant";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { adresRegel } from "@convex/lib/adres";
import { samengesteldeNaam, splitsNaam } from "@convex/lib/klantNaam";

/** Wat de server ook aanhoudt (`klanten.update`). */
const BIJZONDERHEDEN_MAX = 2000;

/**
 * De vaste uitleg bij het bijzonderheden-blok. Eén zin, letterlijk zoals hij
 * met kantoor is afgesproken: hij zegt zowel wát erin hoort als voor wie.
 */
const BIJZONDERHEDEN_UITLEG =
  "Vaste bijzonderheden die elke collega moet weten: sleutel, hond, toegang, vaste werkzaamheden.";

/**
 * Instellingen — alles wat je zelden aanraakt maar wél moet kunnen vinden:
 * de administratieve gegevens, de voorkeuren en het privacy-blok.
 *
 * Drie panelen in de volgorde van het prototype (Contactgegevens / Voorkeuren
 * / Privacy). Contactgegevens is een weergave met een knop "Wijzigen" in de
 * kopbalk; die klapt hetzelfde paneel om naar het bewerkformulier — inline,
 * geen modal, want je bent al op de plek waar de gegevens staan.
 */

/** Wat deze tab van de klant nodig heeft — bewust smal gehouden. */
export interface KlantInstellingenGegevens {
  _id: Id<"klanten">;
  /** De weergavenaam; bij een particulier afgeleid uit voor- + achternaam. */
  naam: string;
  voornaam?: string;
  achternaam?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  /** Afwijkend uitvoeradres: waar het werk is, niet waar de factuur heen gaat. */
  uitvoerAdres?: { adres: string; postcode: string; plaats: string };
  email?: string;
  telefoon?: string;
  telefoon2?: string;
  /** Vaste bijzonderheden; alleen intern — nooit in klantgerichte schermen. */
  bijzonderheden?: string;
  klantType?: KlantType;
  contactpersoon?: string;
  kvkNummer?: string;
  btwNummer?: string;
  website?: string;
  /** Relatienummer uit het bronsysteem; alleen tonen, nooit bewerken. */
  klantnummer?: string;
  /** Het oudere veld (§2.7) waar de mailtrigger in `werkitems.ts` op leest. */
  inplanBevestigingsMail?: boolean;
  /** De v13-velden uit de dossier-instellingen (§A8). */
  bevestigingsmailBijInplannen?: boolean;
  opnameToestemming?: boolean;
}

/** Eén regel, ook als het gegeven ontbreekt: "—" is een antwoord. */
function Waarde({ tekst }: { tekst?: string }) {
  if (!tekst) return <span className="text-muted-foreground">—</span>;
  return <>{tekst}</>;
}

function typeLabel(type: KlantType): string {
  return (
    KLANT_TYPE_OPTIONS.find((optie) => optie.value === type)?.label ??
    "Particulier"
  );
}

/* ── Weergave ─────────────────────────────────────────────────────────────── */

function ContactgegevensWeergave({
  klant,
}: {
  klant: KlantInstellingenGegevens;
}) {
  const klantType = klant.klantType ?? "particulier";
  const zakelijk = isZakelijk(klantType);
  // Klanten van vóór sep 2026 hebben alleen `naam`; die splitsen we hier net
  // zo als het formulier dat doet, zodat weergave en bewerkstand hetzelfde
  // zeggen zolang niemand de losse velden heeft aangeraakt.
  const naamdelen =
    klant.voornaam || klant.achternaam
      ? { voornaam: klant.voornaam ?? "", achternaam: klant.achternaam ?? "" }
      : splitsNaam(klant.naam);
  const uitvoerregel = klant.uitvoerAdres ? adresRegel(klant.uitvoerAdres) : "";

  return (
    <dl className="divide-y">
      {zakelijk ? (
        <Feit label="Naam">{klant.naam}</Feit>
      ) : (
        <>
          <Feit label="Voornaam">
            <Waarde tekst={naamdelen.voornaam} />
          </Feit>
          <Feit label="Achternaam">
            <Waarde tekst={naamdelen.achternaam} />
          </Feit>
        </>
      )}
      <Feit label="Type">{typeLabel(klantType)}</Feit>
      {/* TT-002: contactpersoon hoort bij een bedrijf/VvE, niet bij een
          particulier — daar is de naam de persoon zelf. */}
      {zakelijk && (
        <Feit label="Contactpersoon">
          <Waarde tekst={klant.contactpersoon} />
        </Feit>
      )}
      <Feit label="Telefoon">
        {klant.telefoon ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            {klant.telefoon}
            <CopyButton value={klant.telefoon} label="Kopieer telefoonnummer" />
          </span>
        ) : (
          <Waarde />
        )}
      </Feit>
      {/* Tweede nummer op dezelfde manier als het eerste: kantoor belt vaak
          het mobiele nummer als de vaste lijn niet opneemt. */}
      <Feit label="Telefoon 2">
        {klant.telefoon2 ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            {klant.telefoon2}
            <CopyButton
              value={klant.telefoon2}
              label="Kopieer tweede telefoonnummer"
            />
          </span>
        ) : (
          <Waarde />
        )}
      </Feit>
      <Feit label="E-mail">
        {klant.email ? (
          <span className="inline-flex items-center gap-1">
            {klant.email}
            <CopyButton value={klant.email} label="Kopieer e-mailadres" />
          </span>
        ) : (
          <Waarde />
        )}
      </Feit>
      <Feit label="Adres" uitlijnen="onder">
        <Waarde tekst={adresRegel(klant)} />
      </Feit>
      {/* Alleen als het werk ergens anders gebeurt dan waar de factuur heen
          gaat — anders is het een lege regel die niets toevoegt. */}
      {uitvoerregel && (
        <Feit label="Uitvoeradres" uitlijnen="onder">
          {uitvoerregel}
        </Feit>
      )}
      {klant.kvkNummer && (
        <Feit label="KvK">
          <span className="inline-flex items-center gap-1 tabular-nums">
            {klant.kvkNummer}
            <CopyButton value={klant.kvkNummer} label="Kopieer KvK-nummer" />
          </span>
        </Feit>
      )}
      {klant.btwNummer && (
        <Feit label="BTW">
          <span className="inline-flex items-center gap-1">
            {klant.btwNummer}
            <CopyButton value={klant.btwNummer} label="Kopieer BTW-nummer" />
          </span>
        </Feit>
      )}
      {klant.website && <Feit label="Website">{klant.website}</Feit>}
      {klant.klantnummer && (
        <Feit label="Klantnummer">
          <span className="tabular-nums">{klant.klantnummer}</span>
        </Feit>
      )}
    </dl>
  );
}

/* ── Bewerkformulier ──────────────────────────────────────────────────────── */

/**
 * Alleen de velden die de zod-validatie kent; de rest valideert de server.
 * De drie `uitvoerAdres.*`-sleutels zijn letterlijk het zod-pad
 * (`issue.path.join(".")`), zodat de foutmelding zonder vertaalslag bij het
 * juiste invoerveld belandt.
 */
type VeldFouten = Partial<
  Record<
    | "naam"
    | "voornaam"
    | "achternaam"
    | "adres"
    | "postcode"
    | "plaats"
    | "email"
    | "telefoon"
    | "telefoon2"
    | "uitvoerAdres.adres"
    | "uitvoerAdres.postcode"
    | "uitvoerAdres.plaats",
    string
  >
>;

const VELD_KLASSE = "grid gap-3 @[34rem]/sectie:grid-cols-2";

/**
 * Het paneel in bewerkstand. Losstaand geëxporteerd zodat de componenttest hem
 * kan renderen zonder de hele tab (en zonder GDPR-query) op te tuigen.
 *
 * Twee dingen zijn hier bewust zoals ze zijn:
 *
 * 1. **Dezelfde `klantSchema`-validatie als het aanmaakdialoog.** Postcode,
 *    e-mail en telefoon hebben één waarheid; een tweede regex hier zou vroeg
 *    of laat iets anders goedkeuren dan de server.
 * 2. **Zakelijke velden worden als lege string meegestuurd** zodra het type
 *    naar particulier gaat. `klanten.update` slaat `undefined` over, dus
 *    alleen zo wist een omgezet type ook echt het achtergebleven KvK-nummer.
 */
export function ContactgegevensFormulier({
  klant,
  onKlaar,
}: {
  klant: KlantInstellingenGegevens;
  onKlaar: () => void;
}) {
  const updateKlant = useMutation(api.klanten.update);

  const [klantType, setKlantType] = useState<KlantType>(
    klant.klantType ?? "particulier"
  );
  const [form, setForm] = useState(() => {
    // Geen losse naamvelden? Dan is de opgeslagen naam het beste voorstel —
    // zo hoeft niemand zijn eigen klantenbestand opnieuw in te typen.
    const delen = splitsNaam(klant.naam ?? "");
    return {
      naam: klant.naam ?? "",
      voornaam: klant.voornaam ?? delen.voornaam,
      achternaam: klant.achternaam ?? delen.achternaam,
      adres: klant.adres ?? "",
      postcode: klant.postcode ?? "",
      plaats: klant.plaats ?? "",
      email: klant.email ?? "",
      telefoon: klant.telefoon ?? "",
      telefoon2: klant.telefoon2 ?? "",
      uitvoerAdres: klant.uitvoerAdres?.adres ?? "",
      uitvoerPostcode: klant.uitvoerAdres?.postcode ?? "",
      uitvoerPlaats: klant.uitvoerAdres?.plaats ?? "",
      contactpersoon: klant.contactpersoon ?? "",
      kvkNummer: klant.kvkNummer ?? "",
      btwNummer: klant.btwNummer ?? "",
      website: klant.website ?? "",
    };
  });
  // Dicht is de normale staat: bijna elk werk gebeurt op het adres dat er al
  // staat. Heeft deze klant er wél een, dan staat het blok open — anders is
  // het een gegeven dat je alleen ziet als je ernaar zoekt.
  const [uitvoerOpen, setUitvoerOpen] = useState(Boolean(klant.uitvoerAdres));
  const [fouten, setFouten] = useState<VeldFouten>({});
  const [bezig, setBezig] = useState(false);

  const zakelijk = isZakelijk(klantType);

  /** Welke foutsleutel bij welk invoerveld hoort (alleen waar ze verschillen). */
  const FOUTSLEUTEL: Partial<Record<keyof typeof form, keyof VeldFouten>> = {
    uitvoerAdres: "uitvoerAdres.adres",
    uitvoerPostcode: "uitvoerAdres.postcode",
    uitvoerPlaats: "uitvoerAdres.plaats",
  };

  const setVeld = (veld: keyof typeof form, waarde: string) => {
    setForm((prev) => ({ ...prev, [veld]: waarde }));
    setFouten((prev) => ({ ...prev, [FOUTSLEUTEL[veld] ?? veld]: undefined }));
  };

  const opslaan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bezig) return;

    // Bij een particulier is de achternaam het enige naamveld in beeld. Beide
    // leeg laten zou de oude naam stilzwijgend laten staan (de server valt er
    // dan op terug) — dat lijkt op wissen en is het niet.
    if (!zakelijk && !form.voornaam.trim() && !form.achternaam.trim()) {
      setFouten({ achternaam: "Achternaam is verplicht" });
      return;
    }

    // `naam` blijft de weergavenaam en blijft verplicht; bij een particulier
    // is hij vanaf nu de afgeleide van voor- + achternaam (zelfde regel als
    // serverzijde in `klanten.update`).
    const naam = zakelijk
      ? form.naam
      : samengesteldeNaam({
          voornaam: form.voornaam,
          achternaam: form.achternaam,
          naam: klant.naam,
        });

    // Open én ergens iets ingevuld = het uitvoeradres telt mee, en dan moet
    // het compleet zijn (zod bewaakt dat). Open maar helemaal leeg leest als
    // "toch niet" — dat wist net als dichtklappen.
    const uitvoerIngevuld =
      uitvoerOpen &&
      Boolean(
        form.uitvoerAdres.trim() ||
          form.uitvoerPostcode.trim() ||
          form.uitvoerPlaats.trim()
      );

    const resultaat = klantSchema.safeParse({
      naam,
      ...(zakelijk
        ? {}
        : { voornaam: form.voornaam, achternaam: form.achternaam }),
      adres: form.adres,
      postcode: form.postcode,
      plaats: form.plaats,
      ...(uitvoerIngevuld
        ? {
            uitvoerAdres: {
              adres: form.uitvoerAdres,
              postcode: form.uitvoerPostcode,
              plaats: form.uitvoerPlaats,
            },
          }
        : {}),
      email: form.email,
      telefoon: form.telefoon,
      telefoon2: form.telefoon2,
    });
    if (!resultaat.success) {
      const nieuweFouten: VeldFouten = {};
      for (const issue of resultaat.error.issues) {
        // `uitvoerAdres.postcode` i.p.v. alleen `uitvoerAdres`: anders krijgen
        // de drie velden dezelfde melding onder het verkeerde vak.
        const veld = issue.path.join(".") as keyof VeldFouten;
        if (veld && !nieuweFouten[veld]) nieuweFouten[veld] = issue.message;
      }
      setFouten(nieuweFouten);
      return;
    }

    const data = resultaat.data;
    setBezig(true);
    try {
      await updateKlant({
        id: klant._id,
        naam: data.naam,
        // Zakelijk kent geen voor- en achternaam; wissen wat er ooit stond.
        voornaam: zakelijk ? "" : (data.voornaam ?? ""),
        achternaam: zakelijk ? "" : (data.achternaam ?? ""),
        adres: data.adres,
        postcode: data.postcode,
        plaats: data.plaats,
        // Drie lege velden is voor `uitvoerAdres` wat "" voor e-mail is: weg.
        uitvoerAdres: data.uitvoerAdres ?? {
          adres: "",
          postcode: "",
          plaats: "",
        },
        // Lege string i.p.v. undefined: zo wist een leeggemaakt veld ook echt.
        email: data.email ?? "",
        telefoon: data.telefoon ?? "",
        telefoon2: data.telefoon2 ?? "",
        klantType,
        contactpersoon: zakelijk ? form.contactpersoon.trim() : "",
        kvkNummer: zakelijk ? form.kvkNummer.trim() : "",
        btwNummer: zakelijk ? form.btwNummer.trim() : "",
        website: zakelijk ? form.website.trim() : "",
      });
      showSuccessToast("Contactgegevens bijgewerkt");
      onKlaar();
    } catch (error) {
      // KvK, BTW en postcode worden serverzijde nóg een keer gekeurd; die
      // melding is specifieker dan wat wij hier kunnen bedenken.
      showErrorToast(
        error instanceof Error ? error.message : "Bijwerken mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    // noValidate: de zod-keuring hieronder is de enige die telt. Zonder dit
    // onderschept de browser een ongeldig e-mailadres met een eigen (Engelse,
    // vluchtige) ballon en komt onze inline melding er nooit aan te pas.
    <form onSubmit={opslaan} noValidate className="space-y-3 px-3 py-3">
      {/* Type eerst: die keuze bepaalt welke velden hieronder verschijnen. */}
      <div className="space-y-1.5">
        <Label htmlFor="ki-type">Type klant</Label>
        <Select
          value={klantType}
          onValueChange={(waarde) => setKlantType(waarde as KlantType)}
        >
          <SelectTrigger id="ki-type" className="w-full">
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

      {/* Een bedrijf heeft één naam, een particulier twee. Het naamveld
          verandert dus mee met het type — en niet allebei tegelijk in beeld,
          want dan is het de vraag welke telt. */}
      <div className={VELD_KLASSE}>
        {zakelijk ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ki-naam">Bedrijfsnaam</Label>
              <Input
                id="ki-naam"
                value={form.naam}
                onChange={(e) => setVeld("naam", e.target.value)}
                aria-invalid={Boolean(fouten.naam)}
              />
              {fouten.naam && (
                <p className="text-xs text-destructive">{fouten.naam}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ki-contactpersoon">Contactpersoon</Label>
              <Input
                id="ki-contactpersoon"
                value={form.contactpersoon}
                onChange={(e) => setVeld("contactpersoon", e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ki-voornaam">Voornaam</Label>
              <Input
                id="ki-voornaam"
                value={form.voornaam}
                onChange={(e) => setVeld("voornaam", e.target.value)}
                aria-invalid={Boolean(fouten.voornaam)}
              />
              {fouten.voornaam && (
                <p className="text-xs text-destructive">{fouten.voornaam}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ki-achternaam">Achternaam</Label>
              <Input
                id="ki-achternaam"
                value={form.achternaam}
                onChange={(e) => setVeld("achternaam", e.target.value)}
                aria-invalid={Boolean(fouten.achternaam)}
              />
              {fouten.achternaam && (
                <p className="text-xs text-destructive">{fouten.achternaam}</p>
              )}
            </div>
          </>
        )}
      </div>

      {zakelijk && (
        <>
          <div className={VELD_KLASSE}>
            <div className="space-y-1.5">
              <Label htmlFor="ki-kvk">KvK-nummer</Label>
              <Input
                id="ki-kvk"
                inputMode="numeric"
                placeholder="12345678"
                value={form.kvkNummer}
                onChange={(e) => setVeld("kvkNummer", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ki-btw">BTW-nummer</Label>
              <Input
                id="ki-btw"
                placeholder="NL123456789B01"
                value={form.btwNummer}
                onChange={(e) => setVeld("btwNummer", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ki-website">Website</Label>
            <Input
              id="ki-website"
              placeholder="www.voorbeeld.nl"
              value={form.website}
              onChange={(e) => setVeld("website", e.target.value)}
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ki-adres">Adres</Label>
        <AdresVeld
          id="ki-adres"
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

      <div className={VELD_KLASSE}>
        <div className="space-y-1.5">
          <Label htmlFor="ki-postcode">Postcode</Label>
          <Input
            id="ki-postcode"
            placeholder="1234 AB"
            value={form.postcode}
            onChange={(e) => setVeld("postcode", e.target.value)}
            aria-invalid={Boolean(fouten.postcode)}
          />
          {fouten.postcode && (
            <p className="text-xs text-destructive">{fouten.postcode}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ki-plaats">Plaats</Label>
          <Input
            id="ki-plaats"
            placeholder="Landgraaf"
            value={form.plaats}
            onChange={(e) => setVeld("plaats", e.target.value)}
            aria-invalid={Boolean(fouten.plaats)}
          />
          {fouten.plaats && (
            <p className="text-xs text-destructive">{fouten.plaats}</p>
          )}
        </div>
      </div>

      {/* Het tweede adres hoort bij het eerste en staat er daarom onder, maar
          dichtgeklapt: de uitzondering mag het gewone geval niet in de weg
          zitten. Dichtklappen is tegelijk de manier om hem te wissen — dat is
          hieronder ook wat er gebeurt. */}
      <Collapsible open={uitvoerOpen} onOpenChange={setUitvoerOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${uitvoerOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
            Afwijkend uitvoeradres
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Alleen invullen als het werk ergens anders gebeurt dan op het adres
            hierboven. Het adres hierboven blijft het factuuradres; dichtklappen
            wist het uitvoeradres.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ki-uitvoer-adres">Adres (uitvoer)</Label>
            <AdresVeld
              id="ki-uitvoer-adres"
              waarde={form.uitvoerAdres}
              ongeldig={Boolean(fouten["uitvoerAdres.adres"])}
              onChange={(waarde) => setVeld("uitvoerAdres", waarde)}
              onAdresGekozen={(adres) => {
                setForm((prev) => ({
                  ...prev,
                  uitvoerAdres: adres.adres,
                  uitvoerPostcode: adres.postcode || prev.uitvoerPostcode,
                  uitvoerPlaats: adres.plaats || prev.uitvoerPlaats,
                }));
                setFouten((prev) => ({
                  ...prev,
                  "uitvoerAdres.adres": undefined,
                  "uitvoerAdres.postcode": undefined,
                  "uitvoerAdres.plaats": undefined,
                }));
              }}
            />
            {fouten["uitvoerAdres.adres"] && (
              <p className="text-xs text-destructive">
                {fouten["uitvoerAdres.adres"]}
              </p>
            )}
          </div>
          <div className={VELD_KLASSE}>
            <div className="space-y-1.5">
              <Label htmlFor="ki-uitvoer-postcode">Postcode (uitvoer)</Label>
              <Input
                id="ki-uitvoer-postcode"
                placeholder="1234 AB"
                value={form.uitvoerPostcode}
                onChange={(e) => setVeld("uitvoerPostcode", e.target.value)}
                aria-invalid={Boolean(fouten["uitvoerAdres.postcode"])}
              />
              {fouten["uitvoerAdres.postcode"] && (
                <p className="text-xs text-destructive">
                  {fouten["uitvoerAdres.postcode"]}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ki-uitvoer-plaats">Plaats (uitvoer)</Label>
              <Input
                id="ki-uitvoer-plaats"
                placeholder="Landgraaf"
                value={form.uitvoerPlaats}
                onChange={(e) => setVeld("uitvoerPlaats", e.target.value)}
                aria-invalid={Boolean(fouten["uitvoerAdres.plaats"])}
              />
              {fouten["uitvoerAdres.plaats"] && (
                <p className="text-xs text-destructive">
                  {fouten["uitvoerAdres.plaats"]}
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* De twee nummers naast elkaar: je vergelijkt ze bij het invoeren, en
          zo is meteen te zien welk nummer waar staat. E-mail eronder over de
          volle breedte — die waarde is lang. */}
      <div className={VELD_KLASSE}>
        <div className="space-y-1.5">
          <Label htmlFor="ki-telefoon">Telefoon</Label>
          <Input
            id="ki-telefoon"
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
          <Label htmlFor="ki-telefoon2">Telefoon 2</Label>
          <Input
            id="ki-telefoon2"
            placeholder="045-5710000"
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
        <Label htmlFor="ki-email">E-mail</Label>
        <Input
          id="ki-email"
          type="email"
          placeholder="naam@voorbeeld.nl"
          value={form.email}
          onChange={(e) => setVeld("email", e.target.value)}
          aria-invalid={Boolean(fouten.email)}
        />
        {fouten.email && (
          <p className="text-xs text-destructive">{fouten.email}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onKlaar}
          disabled={bezig}
        >
          Annuleren
        </Button>
        <Button type="submit" size="sm" disabled={bezig}>
          {bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Opslaan
        </Button>
      </div>
    </form>
  );
}

/* ── Bijzonderheden ───────────────────────────────────────────────────────── */

/**
 * Eén tekstvak met de vaste dingen die bij deze klant gelden: sleutel, hond,
 * toegang, vaste werkzaamheden. Bewust géén notitieveld met datums — dat is de
 * tijdlijn. Dit is wat er ook over een jaar nog waar is, en het staat daarom
 * ook als strook boven Actueel.
 *
 * Alleen intern: de tekst verschijnt nergens in het klantportaal, in een PDF
 * of in een mail.
 *
 * Los geëxporteerd zodat de componenttest hem zonder de hele tab kan renderen.
 */
export function BijzonderhedenPaneel({
  klant,
  magBewerken,
}: {
  klant: KlantInstellingenGegevens;
  magBewerken: boolean;
}) {
  const updateKlant = useMutation(api.klanten.update);
  const [bewerken, setBewerken] = useState(false);
  const [tekst, setTekst] = useState(klant.bijzonderheden ?? "");
  const [bezig, setBezig] = useState(false);

  const opgeslagen = klant.bijzonderheden?.trim() ?? "";

  const begin = () => {
    setTekst(klant.bijzonderheden ?? "");
    setBewerken(true);
  };

  const opslaan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bezig) return;
    setBezig(true);
    try {
      // Lege string wist, net als bij e-mail en telefoon; de server knipt
      // hem er dan uit.
      await updateKlant({ id: klant._id, bijzonderheden: tekst.trim() });
      showSuccessToast("Bijzonderheden bijgewerkt");
      setBewerken(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Bijwerken mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <SectiePaneel
      titel="Bijzonderheden"
      icoon={<Info />}
      kopbalk
      acties={
        magBewerken && !bewerken && opgeslagen ? (
          <Button variant="outline" size="sm" onClick={begin}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Wijzigen
          </Button>
        ) : undefined
      }
    >
      {bewerken ? (
        <form onSubmit={opslaan} className="space-y-3 px-3 py-3">
          <div className="space-y-1.5">
            <Label htmlFor="ki-bijzonderheden">Bijzonderheden</Label>
            <TextareaWithCount
              id="ki-bijzonderheden"
              rows={5}
              maxLength={BIJZONDERHEDEN_MAX}
              placeholder="Sleutel ligt onder de mat achter; hond loopt los."
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {BIJZONDERHEDEN_UITLEG}
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBewerken(false)}
              disabled={bezig}
            >
              Annuleren
            </Button>
            <Button type="submit" size="sm" disabled={bezig}>
              {bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </form>
      ) : opgeslagen ? (
        // `whitespace-pre-line`: kantoor typt hier regels onder elkaar
        // (sleutel, hond, toegang) en die volgorde is de leesbaarheid.
        <p className="px-3 py-3 text-sm whitespace-pre-line">{opgeslagen}</p>
      ) : (
        <>
          <SectieLegeStaat
            tekst="Nog niets vastgelegd."
            hint={BIJZONDERHEDEN_UITLEG}
          />
          {magBewerken && (
            <div className="px-3 pb-3">
              <Button variant="outline" size="sm" onClick={begin}>
                Bijzonderheden toevoegen
              </Button>
            </div>
          )}
        </>
      )}
    </SectiePaneel>
  );
}

/* ── Voorkeuren ───────────────────────────────────────────────────────────── */

/**
 * Eén schakelaar met uitleg eronder. De uitleg staat in beeld en niet in een
 * tooltip: een toestemming die je niet kunt nalezen is geen toestemming.
 */
function VoorkeurRegel({
  titel,
  uitleg,
  aan,
  onZet,
  meldingAan,
  meldingUit,
}: {
  titel: string;
  uitleg: string;
  aan: boolean;
  onZet: (aan: boolean) => Promise<unknown>;
  meldingAan: string;
  meldingUit: string;
}) {
  const [bezig, setBezig] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{titel}</p>
        <p className="mt-0.5 max-w-[64ch] text-xs text-muted-foreground">
          {uitleg}
        </p>
      </div>
      <Switch
        className="mt-0.5 shrink-0"
        checked={aan}
        disabled={bezig}
        onCheckedChange={async (waarde) => {
          setBezig(true);
          try {
            await onZet(waarde);
            showSuccessToast(waarde ? meldingAan : meldingUit);
          } catch (fout) {
            showErrorToast(
              fout instanceof Error ? fout.message : "Bijwerken mislukt"
            );
          } finally {
            setBezig(false);
          }
        }}
        aria-label={titel}
      />
    </div>
  );
}

/* ── Tab ──────────────────────────────────────────────────────────────────── */

export function TabInstellingen({
  klant,
  isAnonymized,
}: {
  klant: KlantInstellingenGegevens;
  isAnonymized: boolean;
}) {
  const isAdmin = useIsAdmin();
  const setToestemmingen = useMutation(api.klanten.setDossierToestemmingen);
  const gdprAnonymize = useMutation(api.klanten.gdprAnonymize);
  const gdprBlockers = useQuery(api.klanten.checkGdprBlockers, {
    id: klant._id,
  });
  const [bewerken, setBewerken] = useState(false);
  const [toonGdprDialog, setToonGdprDialog] = useState(false);
  const [bezigMetAnonimiseren, setBezigMetAnonimiseren] = useState(false);

  const heeftBlockers = gdprBlockers?.hasBlockers === true;
  // Na anonimiseren zijn de gegevens bewust weg; ze zijn dan ook niet meer te
  // bewerken (dat zou de GDPR-stap stilzwijgend terugdraaien).
  const magBewerken = !isAnonymized;

  const anonimiseer = async () => {
    setBezigMetAnonimiseren(true);
    try {
      await gdprAnonymize({ id: klant._id });
      showSuccessToast("Klantgegevens zijn geanonimiseerd", {
        description:
          "Alle persoonsgegevens zijn definitief verwijderd conform GDPR.",
      });
      setToonGdprDialog(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij anonimiseren"
      );
    } finally {
      setBezigMetAnonimiseren(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Contactgegevens ──────────────────────────────────────────────── */}
      <SectiePaneel
        titel="Contactgegevens"
        icoon={<User />}
        kopbalk
        acties={
          magBewerken && !bewerken ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBewerken(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Wijzigen
            </Button>
          ) : undefined
        }
      >
        {bewerken && magBewerken ? (
          <ContactgegevensFormulier
            klant={klant}
            onKlaar={() => setBewerken(false)}
          />
        ) : (
          <ContactgegevensWeergave klant={klant} />
        )}
      </SectiePaneel>

      {/* ── Bijzonderheden ───────────────────────────────────────────────── */}
      <BijzonderhedenPaneel klant={klant} magBewerken={magBewerken} />

      {/* ── Voorkeuren ───────────────────────────────────────────────────── */}
      <SectiePaneel titel="Voorkeuren" icoon={<SlidersHorizontal />} kopbalk>
        <div className="divide-y">
          {/* §A8 / §2.7: opt-in inplanning-bevestigingsmail (default uit) —
              zet bij inplannen een concept-mail klaar; kantoor keurt goed.

              Deze schakelaar schrijft het v13-veld
              `bevestigingsmailBijInplannen`; de mailtrigger
              (`wilInplanBevestigingsmail` in convex/werkitems.ts) leest dat
              veld als leidend met het oudere `inplanBevestigingsMail` als
              terugval. Dezelfde terugval hieronder in de weergave, zodat een
              bestaande opt-in niet plots "uit" lijkt. */}
          <VoorkeurRegel
            titel="Bevestigingsmail bij inplannen"
            uitleg="Zet een concept-mail klaar in Concept-mails zodra er werk voor deze klant ingepland wordt."
            aan={
              klant.bevestigingsmailBijInplannen ??
              klant.inplanBevestigingsMail ??
              false
            }
            onZet={(aan) =>
              setToestemmingen({
                id: klant._id,
                bevestigingsmailBijInplannen: aan,
              })
            }
            meldingAan="Bevestigingsmail bij inplannen aangezet"
            meldingUit="Bevestigingsmail bij inplannen uitgezet"
          />

          {/* Harde eis 3 blijft overeind: deze vlag legt alleen vast dát de
              klant mondeling akkoord ging. De gesprekscomposer toont nog
              steeds de meldingsstap en start pas na de bevestiging. */}
          <VoorkeurRegel
            titel="Gesprekken mogen opgenomen worden"
            uitleg="De klant gaf hier mondeling toestemming voor. Melden blijft verplicht: de app vraagt vóór elke opname opnieuw om de bevestiging dat je het gezegd hebt."
            aan={klant.opnameToestemming === true}
            onZet={(aan) =>
              setToestemmingen({ id: klant._id, opnameToestemming: aan })
            }
            meldingAan="Toestemming voor opnemen vastgelegd"
            meldingUit="Toestemming voor opnemen ingetrokken"
          />
        </div>
      </SectiePaneel>

      {/* Lead-historie (PRD §1.3): herkomst en activiteiten van de
          gepromoveerde lead. Rendert niets zonder lead-verleden. */}
      <LeadHistorieCard klantId={klant._id} />

      {/* ── Privacy ──────────────────────────────────────────────────────── */}
      {isAdmin && !isAnonymized && (
        <SectiePaneel titel="Privacy" icoon={<ShieldAlert />} kopbalk>
          <div className="flex flex-wrap items-start gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">GDPR-verwijderverzoek</p>
              <p className="mt-0.5 max-w-[52ch] text-xs text-muted-foreground">
                Anonimiseert alle persoonsgegevens van deze klant. Financiële
                gegevens blijven bewaard voor de boekhouding.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setToonGdprDialog(true)}
            >
              Verzoek starten
            </Button>
          </div>
        </SectiePaneel>
      )}

      {/* CRM-008: bevestiging vóór de onomkeerbare stap */}
      <AlertDialog open={toonGdprDialog} onOpenChange={setToonGdprDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GDPR Verwijderverzoek</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Alle persoonsgegevens van deze klant worden definitief
                  geanonimiseerd. Dit kan niet ongedaan gemaakt worden.
                </p>
                <p>Financiele gegevens blijven bewaard voor de boekhouding.</p>

                {heeftBlockers && gdprBlockers?.blockers && (
                  <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="mb-2 text-sm font-medium text-destructive">
                      Anonimisering is niet mogelijk vanwege:
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                      {gdprBlockers.blockers.map((blocker, i) => (
                        <li key={i}>{blocker.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bezigMetAnonimiseren}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={anonimiseer}
              disabled={bezigMetAnonimiseren || heeftBlockers}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bezigMetAnonimiseren ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig met anonimiseren...
                </>
              ) : (
                "Definitief anonimiseren"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
