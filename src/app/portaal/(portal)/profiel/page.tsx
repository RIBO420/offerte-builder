"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { UserProfile } from "@clerk/nextjs";
import { toast } from "sonner";
import { User, Shield, Sun, Moon, Save } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortaalTheme } from "@/components/portaal/portaal-theme-provider";
import { klantSchema } from "@/lib/validations";

/**
 * Dezelfde vijf velden die `portaal.updateProfile` accepteert, langs dezelfde
 * regels als het kantoorformulier. Eén waarheid: `klantSchema` levert ook de
 * Nederlandse meldingen ("Adres is verplicht", "Ongeldige postcode (bijv.
 * 1234 AB)") die hier onder het veld verschijnen.
 */
const profielSchema = klantSchema.pick({
  naam: true,
  telefoon: true,
  adres: true,
  postcode: true,
  plaats: true,
});

type ProfielVeld = "naam" | "telefoon" | "adres" | "postcode" | "plaats";
type VeldFouten = Partial<Record<ProfielVeld, string>>;

export default function PortaalProfielPage() {
  const profiel = useQuery(api.portaal.getMijnProfiel);
  const updateProfile = useMutation(api.portaal.updateProfile);
  const { theme, toggleTheme } = usePortaalTheme();

  const [naam, setNaam] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [adres, setAdres] = useState("");
  const [postcode, setPostcode] = useState("");
  const [plaats, setPlaats] = useState("");
  const [fouten, setFouten] = useState<VeldFouten>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  /**
   * Voorvullen met wat er in het klantdossier staat — niet alleen de naam.
   * Adres, postcode en plaats zijn serverzijde verplicht; stonden ze hier leeg,
   * dan kreeg de klant "Adres is verplicht" zodra hij alleen zijn telefoon
   * wilde wijzigen. Eén keer: daarna is de invoer van de klant de waarheid, ook
   * als de query intussen opnieuw binnenkomt.
   */
  useEffect(() => {
    if (profiel && !prefilled) {
      setNaam(profiel.naam);
      setTelefoon(profiel.telefoon);
      setAdres(profiel.adres);
      setPostcode(profiel.postcode);
      setPlaats(profiel.plaats);
      setPrefilled(true);
    }
  }, [profiel, prefilled]);

  /** Typen in een veld haalt de foutmelding eronder weg. */
  const wisFout = (veld: ProfielVeld) =>
    setFouten((prev) => ({ ...prev, [veld]: undefined }));

  const handleSave = async () => {
    if (!profiel || saving) return;

    const resultaat = profielSchema.safeParse({
      naam,
      telefoon,
      adres,
      postcode,
      plaats,
    });
    if (!resultaat.success) {
      const nieuweFouten: VeldFouten = {};
      for (const issue of resultaat.error.issues) {
        const veld = issue.path[0] as ProfielVeld | undefined;
        if (veld && !nieuweFouten[veld]) nieuweFouten[veld] = issue.message;
      }
      setFouten(nieuweFouten);
      return;
    }

    // Alleen wat de klant écht veranderd heeft gaat mee: `updateProfile` slaat
    // een `undefined` veld over, dus een ongewijzigd adres hoeft de klantrij
    // niet aan te raken. De vergelijking loopt over de genormaliseerde waarden
    // (postcode met spatie, telefoon zonder opmaak) — anders is "1234ab" altijd
    // een wijziging.
    const data = resultaat.data;
    const nieuweTelefoon = data.telefoon ?? "";
    const wijzigingen = {
      naam: data.naam === profiel.naam ? undefined : data.naam,
      telefoon:
        nieuweTelefoon === profiel.telefoon ? undefined : nieuweTelefoon,
      adres: data.adres === profiel.adres ? undefined : data.adres,
      postcode: data.postcode === profiel.postcode ? undefined : data.postcode,
      plaats: data.plaats === profiel.plaats ? undefined : data.plaats,
    };

    setSaving(true);
    setSaved(false);
    try {
      if (Object.values(wijzigingen).some((waarde) => waarde !== undefined)) {
        await updateProfile(wijzigingen);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Opslaan is niet gelukt",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!profiel) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          Mijn profiel
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Beheer uw persoonlijke gegevens en beveiligingsinstellingen.
        </p>
      </div>

      {/* Personal details card */}
      <Card className="bg-card border-border">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-semibold text-foreground">
              Persoonlijke gegevens
            </h2>
          </div>
        </div>
        <Separator className="bg-border" />
        <div className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="profiel-naam"
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                Naam
              </Label>
              <Input
                id="profiel-naam"
                value={naam}
                onChange={(e) => {
                  setNaam(e.target.value);
                  wisFout("naam");
                }}
                placeholder="Uw naam"
                aria-invalid={Boolean(fouten.naam)}
                className="bg-muted border-border text-sm"
              />
              {fouten.naam && (
                <p className="text-xs text-destructive">{fouten.naam}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="profiel-email"
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                E-mailadres{" "}
                <span className="text-[10px] text-gray-500">
                  (niet wijzigbaar)
                </span>
              </Label>
              <Input
                id="profiel-email"
                value={profiel.email}
                disabled
                className="bg-muted border-border text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="profiel-telefoon"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Telefoon
            </Label>
            <Input
              id="profiel-telefoon"
              value={telefoon}
              onChange={(e) => {
                setTelefoon(e.target.value);
                wisFout("telefoon");
              }}
              placeholder="06-12345678"
              aria-invalid={Boolean(fouten.telefoon)}
              className="bg-muted border-border text-sm"
            />
            {fouten.telefoon && (
              <p className="text-xs text-destructive">{fouten.telefoon}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="profiel-adres"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Adres
            </Label>
            <Input
              id="profiel-adres"
              value={adres}
              onChange={(e) => {
                setAdres(e.target.value);
                wisFout("adres");
              }}
              placeholder="Straatnaam 1"
              aria-invalid={Boolean(fouten.adres)}
              className="bg-muted border-border text-sm"
            />
            {fouten.adres && (
              <p className="text-xs text-destructive">{fouten.adres}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="profiel-postcode"
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                Postcode
              </Label>
              <Input
                id="profiel-postcode"
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value);
                  wisFout("postcode");
                }}
                placeholder="1234 AB"
                aria-invalid={Boolean(fouten.postcode)}
                className="bg-muted border-border text-sm"
              />
              {fouten.postcode && (
                <p className="text-xs text-destructive">{fouten.postcode}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="profiel-plaats"
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                Plaats
              </Label>
              <Input
                id="profiel-plaats"
                value={plaats}
                onChange={(e) => {
                  setPlaats(e.target.value);
                  wisFout("plaats");
                }}
                placeholder="Plaatsnaam"
                aria-invalid={Boolean(fouten.plaats)}
                className="bg-muted border-border text-sm"
              />
              {fouten.plaats && (
                <p className="text-xs text-destructive">{fouten.plaats}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-foreground hover:bg-foreground/90 text-background dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/85"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
            {saved && (
              <span className="text-sm text-primary">Opgeslagen!</span>
            )}
          </div>
        </div>
      </Card>

      {/* Appearance card */}
      <Card className="bg-card border-border">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-accent-warm" />
              ) : (
                <Moon className="h-4 w-4 text-(--portal-info)" />
              )}
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">
                  Weergave
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {theme === "light" ? "Licht thema actief" : "Donker thema actief"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-gray-500" />
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
              />
              <Moon className="h-3.5 w-3.5 text-gray-500" />
            </div>
          </div>
        </div>
      </Card>

      {/* Security card */}
      <Card className="bg-card border-border">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-(--portal-info)" />
            <h2 className="text-[15px] font-semibold text-foreground">
              Beveiliging
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Beheer uw wachtwoord en tweefactorauthenticatie (2FA).
          </p>
        </div>
        <Separator className="bg-border" />
        <div className="p-5">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "shadow-none w-full",
                card: "shadow-none border-0 p-0 w-full",
                navbar: "hidden",
                navbarMobileMenuButton: "hidden",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                profileSectionPrimaryButton:
                  "text-foreground dark:text-primary",
              },
            }}
          />
        </div>
      </Card>
    </div>
  );
}
