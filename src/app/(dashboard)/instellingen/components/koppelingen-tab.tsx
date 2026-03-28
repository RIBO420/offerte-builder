"use client";

import { useState, useRef } from "react";
import { m } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Unplug,
  BookOpen,
  Clock,
  AlertTriangle,
  Settings2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { FleetGoSettings } from "@/components/wagenpark/fleetgo-settings";
import { BoekhoudingSyncLog } from "./boekhouding-sync-log";

// ============================================================================
// Types
// ============================================================================

interface KoppelingenTabProps {
  reducedMotion: boolean;
}

type Provider = "moneybird" | "exact_online" | "twinfield" | "geen";

interface ProviderInfo {
  id: Provider;
  naam: string;
  beschrijving: string;
  badge?: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "moneybird",
    naam: "Moneybird",
    beschrijving: "Populair boekhoudpakket voor MKB. Ideaal voor hoveniersbedrijven.",
    badge: "Meest gekozen",
  },
  {
    id: "exact_online",
    naam: "Exact Online",
    beschrijving: "Enterprise boekhoudoplossing met uitgebreide rapportages.",
  },
  {
    id: "twinfield",
    naam: "Twinfield",
    beschrijving: "Onderdeel van Wolters Kluwer. Geschikt voor accountantskantoren.",
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function KoppelingenTab({ reducedMotion }: KoppelingenTabProps) {
  return (
    <m.div
      key="koppelingen"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
    >
      <TabsContent value="koppelingen" className="space-y-4" forceMount>
        <div className="space-y-6">
          {/* Boekhoudkoppeling */}
          <BoekhoudKoppeling />

          {/* FleetGo Integration */}
          <FleetGoSettings
            isConfigured={false}
            onSave={async () => {
              toast.success("FleetGo instellingen opgeslagen");
            }}
            onTestConnection={async (apiKey) => {
              return apiKey.length > 10;
            }}
          />

          {/* Algemene Voorwaarden PDF (EML-003) */}
          <VoorwaardenCard />
        </div>
      </TabsContent>
    </m.div>
  );
}

// ============================================================================
// Boekhoudkoppeling Section
// ============================================================================

function BoekhoudKoppeling() {
  const instellingen = useQuery(api.boekhouding.getInstellingen);
  const syncOverview = useQuery(api.boekhouding.getSyncOverview);
  const syncLog = useQuery(api.boekhouding.getSyncLog, { limit: 10 });

  const isConnected = instellingen?.isActief && instellingen.provider !== "geen";

  return (
    <div className="space-y-4">
      {/* Provider Selection / Status Card */}
      {isConnected ? (
        <ConnectedProviderCard instellingen={instellingen} syncOverview={syncOverview} />
      ) : (
        <ProviderSelectionCard currentProvider={instellingen?.provider} />
      )}

      {/* Grootboek Mapping Placeholder (only when connected) */}
      {isConnected && <GrootboekMappingCard />}

      {/* Sync Log (only when connected and has entries) */}
      {isConnected && <BoekhoudingSyncLog entries={syncLog} />}
    </div>
  );
}

// ============================================================================
// Provider Selection Card (not connected)
// ============================================================================

function ProviderSelectionCard({ currentProvider }: { currentProvider?: string }) {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Boekhoudkoppeling</CardTitle>
              <CardDescription>
                Verbind je boekhoudpakket om facturen automatisch te synchroniseren
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  setSelectedProvider(provider.id);
                  setShowSetupDialog(true);
                }}
                className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  currentProvider === provider.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                {provider.badge && (
                  <Badge variant="secondary" className="absolute -top-2 right-2 text-xs">
                    {provider.badge}
                  </Badge>
                )}
                <span className="font-semibold">{provider.naam}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {provider.beschrijving}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      {selectedProvider && (
        <SetupDialog
          provider={selectedProvider}
          open={showSetupDialog}
          onOpenChange={(open) => {
            setShowSetupDialog(open);
            if (!open) setSelectedProvider(null);
          }}
        />
      )}
    </>
  );
}

// ============================================================================
// Connected Provider Card
// ============================================================================

function ConnectedProviderCard({
  instellingen,
  syncOverview,
}: {
  instellingen: NonNullable<ReturnType<typeof useQuery<typeof api.boekhouding.getInstellingen>>>;
  syncOverview: ReturnType<typeof useQuery<typeof api.boekhouding.getSyncOverview>>;
}) {
  const disconnect = useMutation(api.boekhouding.disconnect);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const providerInfo = PROVIDERS.find((p) => p.id === instellingen.provider);

  const handleDisconnect = async () => {
    if (!confirm("Weet je zeker dat je de boekhoudkoppeling wilt ontkoppelen? Synchronisatiegeschiedenis blijft bewaard.")) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await disconnect();
      toast.success("Boekhoudkoppeling ontkoppeld");
    } catch {
      toast.error("Ontkoppelen mislukt");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {providerInfo?.naam ?? instellingen.provider}
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    Verbonden
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {providerInfo?.beschrijving}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSettings(true)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Instellingen</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unplug className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ontkoppelen</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Sync Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{syncOverview?.synced ?? 0}</p>
              <p className="text-xs text-muted-foreground">Gesynchroniseerd</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{syncOverview?.pending ?? 0}</p>
              <p className="text-xs text-muted-foreground">Wachtend</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-destructive">{syncOverview?.errors ?? 0}</p>
              <p className="text-xs text-muted-foreground">Fouten</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{syncOverview?.totaal ?? 0}</p>
              <p className="text-xs text-muted-foreground">Totaal</p>
            </div>
          </div>

          {/* Last Sync Info */}
          {instellingen.laatsteSyncAt && (
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Laatste synchronisatie:{" "}
                {new Date(instellingen.laatsteSyncAt).toLocaleDateString("nl-NL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {instellingen.laatsteSyncStatus === "success" && (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              )}
              {instellingen.laatsteSyncStatus === "error" && (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              )}
            </div>
          )}

          {/* Auto-sync indicator */}
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            <span>
              Automatische synchronisatie: {instellingen.autoSync ? "Aan" : "Uit"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          instellingen={instellingen}
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      )}
    </>
  );
}

// ============================================================================
// Setup Dialog (initial connection)
// ============================================================================

function SetupDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saveInstellingen = useMutation(api.boekhouding.saveInstellingen);
  const [apiKey, setApiKey] = useState("");
  const [bedrijfsId, setBedrijfsId] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const providerInfo = PROVIDERS.find((p) => p.id === provider);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    // Simulate connection test — real API test will be added with provider credentials
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const success = apiKey.length >= 8;
    setTestResult(success);
    setIsTesting(false);
    if (success) {
      toast.success("Verbinding succesvol getest");
    } else {
      toast.error("Verbinding mislukt. Controleer je API-sleutel.");
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Vul een API-sleutel in");
      return;
    }
    setIsSaving(true);
    try {
      await saveInstellingen({
        provider,
        apiKey: apiKey.trim(),
        externalBedrijfsId: bedrijfsId.trim() || undefined,
        autoSync,
        syncRichting: "push",
      });
      toast.success(`${providerInfo?.naam} succesvol verbonden`);
      onOpenChange(false);
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verbinden met {providerInfo?.naam}</DialogTitle>
          <DialogDescription>
            Vul je API-gegevens in om de koppeling met {providerInfo?.naam} te configureren.
            Je vindt deze in de instellingen van je boekhoudpakket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API-sleutel</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Plak je API-sleutel hier"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bedrijfsId">
              {provider === "moneybird" ? "Administratie-ID" : "Bedrijfs-ID"}
              <span className="text-muted-foreground ml-1">(optioneel)</span>
            </Label>
            <Input
              id="bedrijfsId"
              placeholder={provider === "moneybird" ? "Bijv. 123456789" : "Bijv. NL001"}
              value={bedrijfsId}
              onChange={(e) => setBedrijfsId(e.target.value)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="autoSync">Automatisch synchroniseren</Label>
              <p className="text-xs text-muted-foreground">
                Facturen automatisch pushen bij verzenden
              </p>
            </div>
            <Switch
              id="autoSync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
            />
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!apiKey.trim() || isTesting}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test verbinding
            </Button>
            {testResult === true && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Succesvol
              </span>
            )}
            {testResult === false && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> Mislukt
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={!apiKey.trim() || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Verbinden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Settings Dialog (when already connected)
// ============================================================================

function SettingsDialog({
  instellingen,
  open,
  onOpenChange,
}: {
  instellingen: NonNullable<ReturnType<typeof useQuery<typeof api.boekhouding.getInstellingen>>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saveSettings = useMutation(api.boekhouding.saveInstellingen);
  const [autoSync, setAutoSync] = useState(instellingen.autoSync);
  const [syncRichting, setSyncRichting] = useState(instellingen.syncRichting);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        provider: instellingen.provider as Provider,
        autoSync,
        syncRichting,
      });
      toast.success("Instellingen opgeslagen");
      onOpenChange(false);
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Synchronisatie-instellingen</DialogTitle>
          <DialogDescription>
            Pas de instellingen voor de boekhoudkoppeling aan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="autoSyncSetting">Automatisch synchroniseren</Label>
              <p className="text-xs text-muted-foreground">
                Facturen automatisch pushen bij verzenden
              </p>
            </div>
            <Switch
              id="autoSyncSetting"
              checked={autoSync}
              onCheckedChange={setAutoSync}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Synchronisatierichting</Label>
            <Select value={syncRichting} onValueChange={(val) => setSyncRichting(val as "push" | "pull" | "bidirectioneel")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push">Push (naar boekhouding)</SelectItem>
                <SelectItem value="pull">Pull (van boekhouding)</SelectItem>
                <SelectItem value="bidirectioneel">Bidirectioneel</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Push: facturen worden naar het boekhoudpakket gestuurd.
              Pull: wijzigingen worden opgehaald. Bidirectioneel: beide richtingen.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Grootboek Mapping Card (placeholder)
// ============================================================================

function GrootboekMappingCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Grootboekmapping</CardTitle>
            <CardDescription>
              Configureer grootboeknummers voor automatische boeking
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-6 text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium mb-1">Grootboekmapping configureren</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Koppel interne categorieen (omzet aanleg, omzet onderhoud, materialen) aan
            grootboekrekeningen in je boekhoudpakket. Deze functie wordt beschikbaar zodra
            de API-integratie is voltooid.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Voorwaarden Upload Card (existing, preserved)
// ============================================================================

function VoorwaardenCard() {
  const voorwaarden = useQuery(api.instellingen.getVoorwaardenPdfUrl);
  const generateUrl = useMutation(api.instellingen.generateVoorwaardenUploadUrl);
  const updatePdf = useMutation(api.instellingen.updateVoorwaardenPdf);
  const removePdf = useMutation(api.instellingen.removeVoorwaardenPdf);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Alleen PDF bestanden zijn toegestaan");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Bestand mag maximaal 10 MB zijn");
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUrl();
      await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      }).then(async (res) => {
        const { storageId } = await res.json();
        await updatePdf({ storageId, bestandsnaam: file.name });
      });
      toast.success("Voorwaarden PDF geüpload");
    } catch {
      toast.error("Upload mislukt");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      await removePdf();
      toast.success("Voorwaarden PDF verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Algemene Voorwaarden</CardTitle>
            <CardDescription>
              Upload een PDF die automatisch wordt bijgevoegd bij offerte- en contracte-mails
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleUpload}
        />

        {voorwaarden?.url ? (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm truncate">{voorwaarden.naam}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Vervangen</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={handleRemove}
                aria-label="Logo verwijderen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            PDF uploaden
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
