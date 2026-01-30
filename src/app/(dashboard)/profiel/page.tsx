"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  FileText,
  Save,
  Loader2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
}

export default function ProfielPage() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { instellingen, isLoading: isSettingsLoading, update } = useInstellingen();

  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [bedrijfsgegevens, setBedrijfsgegevens] = useState({
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    kvk: "",
    btw: "",
    iban: "",
    email: "",
    telefoon: "",
  });

  const [offerteSettings, setOfferteSettings] = useState({
    offerteNummerPrefix: "OFF-",
  });

  // Load settings into form when data arrives
  useEffect(() => {
    if (instellingen) {
      setBedrijfsgegevens({
        naam: instellingen.bedrijfsgegevens.naam || "",
        adres: instellingen.bedrijfsgegevens.adres || "",
        postcode: instellingen.bedrijfsgegevens.postcode || "",
        plaats: instellingen.bedrijfsgegevens.plaats || "",
        kvk: instellingen.bedrijfsgegevens.kvk || "",
        btw: instellingen.bedrijfsgegevens.btw || "",
        iban: instellingen.bedrijfsgegevens.iban || "",
        email: instellingen.bedrijfsgegevens.email || "",
        telefoon: instellingen.bedrijfsgegevens.telefoon || "",
      });
      setOfferteSettings({
        offerteNummerPrefix: instellingen.offerteNummerPrefix,
      });
    }
  }, [instellingen]);

  const isLoading = isUserLoading || isSettingsLoading || !isClerkLoaded;

  const handleSaveBedrijfsgegevens = async () => {
    setIsSaving(true);
    try {
      await update({
        bedrijfsgegevens: {
          naam: bedrijfsgegevens.naam,
          adres: bedrijfsgegevens.adres,
          postcode: bedrijfsgegevens.postcode,
          plaats: bedrijfsgegevens.plaats,
          kvk: bedrijfsgegevens.kvk || undefined,
          btw: bedrijfsgegevens.btw || undefined,
          iban: bedrijfsgegevens.iban || undefined,
          email: bedrijfsgegevens.email || undefined,
          telefoon: bedrijfsgegevens.telefoon || undefined,
        },
      });
      toast.success("Bedrijfsgegevens opgeslagen");
    } catch (error) {
      toast.error("Fout bij opslaan bedrijfsgegevens");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOfferteSettings = async () => {
    setIsSaving(true);
    try {
      await update({
        offerteNummerPrefix: offerteSettings.offerteNummerPrefix,
      });
      toast.success("Offerte instellingen opgeslagen");
    } catch (error) {
      toast.error("Fout bij opslaan offerte instellingen");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const userDisplayName = clerkUser?.fullName || clerkUser?.firstName || "Gebruiker";
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  const userInitials = getInitials(userDisplayName);

  if (isLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Profiel</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Profiel</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* User Profile Header */}
        <div className="flex items-center gap-4">
          {clerkUser?.imageUrl ? (
            <img
              src={clerkUser.imageUrl}
              alt={userDisplayName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
              {userInitials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {userDisplayName}
            </h1>
            {userEmail && (
              <p className="text-muted-foreground">{userEmail}</p>
            )}
          </div>
        </div>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="bedrijf" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Bedrijf
            </TabsTrigger>
            <TabsTrigger value="offerte" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Offerte
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account informatie</CardTitle>
                <CardDescription>
                  Je persoonlijke accountgegevens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Naam</Label>
                    <Input
                      value={userDisplayName}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Beheerd door je login provider
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>E-mailadres</Label>
                    <Input
                      value={userEmail || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Beheerd door je login provider
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bedrijfsgegevens Tab */}
          <TabsContent value="bedrijf" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bedrijfsgegevens</CardTitle>
                <CardDescription>
                  Deze gegevens worden gebruikt op je offertes en facturen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bedrijfsnaam">Bedrijfsnaam</Label>
                    <Input
                      id="bedrijfsnaam"
                      placeholder="Top Tuinen B.V."
                      value={bedrijfsgegevens.naam}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, naam: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kvk">KvK-nummer</Label>
                    <Input
                      id="kvk"
                      placeholder="12345678"
                      value={bedrijfsgegevens.kvk}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, kvk: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adres">Adres</Label>
                  <Input
                    id="adres"
                    placeholder="Hoofdstraat 1"
                    value={bedrijfsgegevens.adres}
                    onChange={(e) =>
                      setBedrijfsgegevens({ ...bedrijfsgegevens, adres: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      placeholder="1234 AB"
                      value={bedrijfsgegevens.postcode}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, postcode: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="plaats">Plaats</Label>
                    <Input
                      id="plaats"
                      placeholder="Amsterdam"
                      value={bedrijfsgegevens.plaats}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, plaats: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mailadres</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="info@toptuinen.nl"
                      value={bedrijfsgegevens.email}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefoon">Telefoonnummer</Label>
                    <Input
                      id="telefoon"
                      placeholder="020-1234567"
                      value={bedrijfsgegevens.telefoon}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, telefoon: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="btwnummer">BTW-nummer</Label>
                    <Input
                      id="btwnummer"
                      placeholder="NL123456789B01"
                      value={bedrijfsgegevens.btw}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, btw: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      placeholder="NL12 ABCD 0123 4567 89"
                      value={bedrijfsgegevens.iban}
                      onChange={(e) =>
                        setBedrijfsgegevens({ ...bedrijfsgegevens, iban: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveBedrijfsgegevens} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Opslaan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Offerte Tab */}
          <TabsContent value="offerte" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Offerte instellingen</CardTitle>
                <CardDescription>
                  Configureer offerte nummering en standaard teksten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="prefix">Offertenummer prefix</Label>
                    <Input
                      id="prefix"
                      placeholder="OFF-"
                      value={offerteSettings.offerteNummerPrefix}
                      onChange={(e) =>
                        setOfferteSettings({
                          ...offerteSettings,
                          offerteNummerPrefix: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Bijv. OFF-2026-001
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startnummer">Volgend nummer</Label>
                    <Input
                      id="startnummer"
                      type="number"
                      value={(instellingen?.laatsteOfferteNummer || 0) + 1}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Automatisch verhoogd bij nieuwe offerte
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveOfferteSettings} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Opslaan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
