"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { UserProfile } from "@clerk/nextjs";
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

export default function PortaalProfielPage() {
  const overzicht = useQuery(api.portaal.getOverzicht);
  const updateProfile = useMutation(api.portaal.updateProfile);
  const { theme, toggleTheme } = usePortaalTheme();

  const [naam, setNaam] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [adres, setAdres] = useState("");
  const [postcode, setPostcode] = useState("");
  const [plaats, setPlaats] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill form from klant data
  useEffect(() => {
    if (overzicht && !prefilled) {
      setNaam(overzicht.klantNaam ?? "");
      setPrefilled(true);
    }
  }, [overzicht, prefilled]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({
        naam: naam || undefined,
        telefoon: telefoon || undefined,
        adres: adres || undefined,
        postcode: postcode || undefined,
        plaats: plaats || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!overzicht) {
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
        <h1 className="text-xl md:text-2xl font-bold text-[#1a2e1a] dark:text-white">
          Mijn profiel
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Beheer uw persoonlijke gegevens en beveiligingsinstellingen.
        </p>
      </div>

      {/* Personal details card */}
      <Card className="bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#4ADE80]" />
            <h2 className="text-[15px] font-semibold text-[#1a2e1a] dark:text-white">
              Persoonlijke gegevens
            </h2>
          </div>
        </div>
        <Separator className="bg-gray-100 dark:bg-[#2a3e2a]" />
        <div className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Naam</Label>
              <Input
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                placeholder="Uw naam"
                className="bg-gray-50 dark:bg-[#111a11] border-gray-200 dark:border-[#2a3e2a] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 dark:text-gray-400">
                E-mailadres{" "}
                <span className="text-[10px] text-gray-500">(niet wijzigbaar)</span>
              </Label>
              <Input
                value={overzicht.klantNaam ? `${overzicht.klantNaam.toLowerCase().replace(/\s+/g, ".")}@...` : ""}
                disabled
                className="bg-gray-100 dark:bg-[#0a0f0a] border-gray-200 dark:border-[#2a3e2a] text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 dark:text-gray-400">Telefoon</Label>
            <Input
              value={telefoon}
              onChange={(e) => setTelefoon(e.target.value)}
              placeholder="06-12345678"
              className="bg-gray-50 dark:bg-[#111a11] border-gray-200 dark:border-[#2a3e2a] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 dark:text-gray-400">Adres</Label>
            <Input
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              placeholder="Straatnaam 1"
              className="bg-gray-50 dark:bg-[#111a11] border-gray-200 dark:border-[#2a3e2a] text-sm"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Postcode</Label>
              <Input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="1234 AB"
                className="bg-gray-50 dark:bg-[#111a11] border-gray-200 dark:border-[#2a3e2a] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Plaats</Label>
              <Input
                value={plaats}
                onChange={(e) => setPlaats(e.target.value)}
                placeholder="Plaatsnaam"
                className="bg-gray-50 dark:bg-[#111a11] border-gray-200 dark:border-[#2a3e2a] text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1a2e1a] hover:bg-[#2a3e2a] text-white dark:bg-[#4ADE80] dark:text-black dark:hover:bg-[#3bce70]"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
            {saved && (
              <span className="text-sm text-[#4ADE80]">Opgeslagen!</span>
            )}
          </div>
        </div>
      </Card>

      {/* Appearance card */}
      <Card className="bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-[#F59E0B]" />
              ) : (
                <Moon className="h-4 w-4 text-[#60A5FA]" />
              )}
              <div>
                <h2 className="text-[15px] font-semibold text-[#1a2e1a] dark:text-white">
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
      <Card className="bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#60A5FA]" />
            <h2 className="text-[15px] font-semibold text-[#1a2e1a] dark:text-white">
              Beveiliging
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Beheer uw wachtwoord en tweefactorauthenticatie (2FA).
          </p>
        </div>
        <Separator className="bg-gray-100 dark:bg-[#2a3e2a]" />
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
                  "text-[#1a2e1a] dark:text-[#4ADE80]",
              },
            }}
          />
        </div>
      </Card>
    </div>
  );
}
