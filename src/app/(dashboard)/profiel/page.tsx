"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
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
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  FileText,
  Save,
  Loader2,
  User,
  Trees,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

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
  const { isLoading: isUserLoading } = useCurrentUser();
  const { instellingen, isLoading: isSettingsLoading, update } = useInstellingen();

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);

  // GDPR queries and mutations
  const personalData = useQuery(api.users.exportPersonalData);
  const requestDataDeletionMutation = useMutation(api.users.requestDataDeletion);

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
    } catch {
      toast.error("Fout bij opslaan bedrijfsgegevens");
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
    } catch {
      toast.error("Fout bij opslaan offerte instellingen");
    } finally {
      setIsSaving(false);
    }
  };

  // GDPR: Export personal data as JSON file
  const handleExportData = async () => {
    if (!personalData) {
      toast.error("Gegevens worden nog geladen. Probeer het opnieuw.");
      return;
    }

    setIsExporting(true);
    try {
      // Create a JSON blob with all personal data
      const dataStr = JSON.stringify(personalData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename with date
      const date = new Date().toISOString().split("T")[0];
      link.download = `mijn-gegevens-export-${date}.json`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Je gegevens zijn gedownload!");
    } catch {
      toast.error("Fout bij exporteren van gegevens");
    } finally {
      setIsExporting(false);
    }
  };

  // GDPR: Request data deletion
  const handleRequestDeletion = async () => {
    setIsRequestingDeletion(true);
    try {
      const result = await requestDataDeletionMutation({
        reason: deletionReason || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setShowDeletionDialog(false);
        setDeletionReason("");
      }
    } catch {
      toast.error("Fout bij indienen verwijderingsverzoek");
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const userDisplayName = clerkUser?.fullName || clerkUser?.firstName || "Gebruiker";
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  const userInitials = getInitials(userDisplayName);

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

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-1 items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative"
            >
              {/* Pulsing glow effect */}
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 blur-xl"
                animate={{
                  opacity: [0.4, 0.7, 0.4],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Icon container */}
              <motion.div
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30"
                animate={{
                  y: [0, -4, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <User className="h-8 w-8 text-white" />
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
          >
            {/* User Profile Header */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex items-center gap-4"
            >
              {clerkUser?.imageUrl ? (
                <motion.img
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  src={clerkUser.imageUrl}
                  alt={userDisplayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-semibold"
                >
                  {userInitials}
                </motion.div>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {userDisplayName}
                </h1>
                {userEmail && (
                  <p className="text-muted-foreground">{userEmail}</p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
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
                  <TabsTrigger value="privacy" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Privacy
                  </TabsTrigger>
                </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
            </motion.div>
          </TabsContent>

          {/* Bedrijfsgegevens Tab */}
          <TabsContent value="bedrijf" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
            </motion.div>
          </TabsContent>

          {/* Offerte Tab */}
          <TabsContent value="offerte" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
            </motion.div>
          </TabsContent>

          {/* Privacy Tab (GDPR) */}
          <TabsContent value="privacy" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
            {/* Data Export Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download mijn gegevens
                </CardTitle>
                <CardDescription>
                  Volgens de AVG (GDPR Artikel 15) heb je het recht om een kopie van al je persoonlijke gegevens op te vragen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="font-medium mb-2">Wat wordt er geexporteerd?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Je accountgegevens (naam, e-mail, rol)</li>
                    <li>Bedrijfsinstellingen</li>
                    <li>Alle klanten en offertes</li>
                    <li>Projecten, facturen en urenregistraties</li>
                    <li>Producten en normuren</li>
                    <li>Voertuigen en machines</li>
                    <li>E-mail logs en notificaties</li>
                    {personalData?._meta && (
                      <li className="text-primary font-medium mt-2">
                        Totaal: {personalData._meta.totalKlanten} klanten, {personalData._meta.totalOffertes} offertes, {personalData._meta.totalProjecten} projecten
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleExportData}
                    disabled={isExporting || !personalData}
                  >
                    {isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isExporting ? "Bezig met exporteren..." : "Download mijn gegevens"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data Deletion Card */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Verzoek tot verwijdering
                </CardTitle>
                <CardDescription>
                  Volgens de AVG (GDPR Artikel 17) heb je het recht om verwijdering van al je persoonlijke gegevens te verzoeken.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-destructive mb-1">Let op!</h4>
                      <p className="text-sm text-muted-foreground">
                        Bij een verwijderingsverzoek worden <strong>alle</strong> gegevens permanent verwijderd,
                        inclusief offertes, klanten, projecten en facturen. Dit kan niet ongedaan worden gemaakt.
                        Een beheerder zal je verzoek beoordelen en contact met je opnemen.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <AlertDialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Verzoek tot verwijdering
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                          <p>
                            Je staat op het punt een verzoek in te dienen om al je persoonlijke gegevens te laten verwijderen.
                            Dit omvat:
                          </p>
                          <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                            <li>Je accountgegevens</li>
                            <li>Alle klanten en contactpersonen</li>
                            <li>Alle offertes en projecten</li>
                            <li>Alle facturen en urenregistraties</li>
                            <li>Alle bedrijfsinstellingen</li>
                          </ul>
                          <div className="pt-2">
                            <Label htmlFor="deletion-reason">Reden voor verwijdering (optioneel)</Label>
                            <Textarea
                              id="deletion-reason"
                              placeholder="Geef eventueel een reden op..."
                              value={deletionReason}
                              onChange={(e) => setDeletionReason(e.target.value)}
                              className="mt-2"
                              rows={3}
                            />
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRequestingDeletion}>
                          Annuleren
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRequestDeletion}
                          disabled={isRequestingDeletion}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isRequestingDeletion ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          {isRequestingDeletion ? "Bezig..." : "Verzoek indienen"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Jouw privacy rechten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">Artikel 15 - Recht op inzage</h4>
                    <p className="text-sm text-muted-foreground">
                      Je hebt het recht om een kopie van je persoonlijke gegevens op te vragen.
                      Gebruik de knop hierboven om je gegevens te downloaden.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Artikel 16 - Recht op rectificatie</h4>
                    <p className="text-sm text-muted-foreground">
                      Je hebt het recht om onjuiste gegevens te laten corrigeren.
                      Je kunt je gegevens zelf aanpassen via de andere tabs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Artikel 17 - Recht op verwijdering</h4>
                    <p className="text-sm text-muted-foreground">
                      Je hebt het recht om verwijdering van je gegevens te verzoeken.
                      Gebruik de knop hierboven om een verzoek in te dienen.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Artikel 20 - Recht op overdraagbaarheid</h4>
                    <p className="text-sm text-muted-foreground">
                      Je hebt het recht om je gegevens in een gestructureerd formaat te ontvangen.
                      De export functie biedt je gegevens in JSON formaat.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </TabsContent>
              </Tabs>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
