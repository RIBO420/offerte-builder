"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface FleetGoSettingsProps {
  initialApiKey?: string;
  isConfigured?: boolean;
  lastSyncTimestamp?: string | null;
  onSave?: (apiKey: string) => Promise<void>;
  onTestConnection?: (apiKey: string) => Promise<boolean>;
}

type ConnectionTestStatus = "idle" | "testing" | "success" | "error";

export function FleetGoSettings({
  initialApiKey = "",
  isConfigured = false,
  lastSyncTimestamp = null,
  onSave,
  onTestConnection,
}: FleetGoSettingsProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<ConnectionTestStatus>("idle");
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    setHasChanges(apiKey !== initialApiKey);
  }, [apiKey, initialApiKey]);

  // Mask API key for display
  const getMaskedApiKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "*".repeat(key.length);
    return key.slice(0, 4) + "*".repeat(key.length - 8) + key.slice(-4);
  };

  // Test connection
  const handleTestConnection = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Voer eerst een API key in");
      return;
    }

    setTestStatus("testing");

    try {
      if (onTestConnection) {
        const success = await onTestConnection(apiKey);
        if (success) {
          setTestStatus("success");
          toast.success("Verbinding succesvol!");
        } else {
          setTestStatus("error");
          toast.error("Verbinding mislukt");
        }
      } else {
        // Mock test connection - replace with actual implementation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Simulate success (in real implementation, make actual API call)
        // For demo: any key starting with "fleetgo_" is valid
        if (apiKey.startsWith("fleetgo_") && apiKey.length > 10) {
          setTestStatus("success");
          toast.success("Verbinding succesvol!");
        } else {
          setTestStatus("error");
          toast.error("Ongeldige API key");
        }
      }
    } catch (error) {
      setTestStatus("error");
      toast.error("Fout bij testen verbinding");
    }
  }, [apiKey, onTestConnection]);

  // Save API key
  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Voer een API key in");
      return;
    }

    setIsSaving(true);

    try {
      if (onSave) {
        await onSave(apiKey);
      } else {
        // Mock save - replace with actual implementation
        // Note: In a real implementation, this should be stored securely
        // on the backend, not in localStorage
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // For demo purposes only - real implementation needs secure backend storage
        console.warn(
          "FleetGo API key saved (demo mode). In production, store this securely on the server."
        );
      }

      toast.success("FleetGo instellingen opgeslagen");
      setHasChanges(false);
    } catch (error) {
      toast.error("Fout bij opslaan instellingen");
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, onSave]);

  // Format last sync
  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return "Nog nooit";
    const date = new Date(timestamp);
    return `${date.toLocaleDateString("nl-NL")} om ${date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                FleetGo Integratie
                {isConfigured ? (
                  <Badge variant="default" className="bg-green-600">
                    Geconfigureerd
                  </Badge>
                ) : (
                  <Badge variant="secondary">Niet geconfigureerd</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Synchroniseer voertuigen automatisch vanuit FleetGo
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="fleetgo-api-key">API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="fleetgo-api-key"
                type={showApiKey ? "text" : "password"}
                value={showApiKey ? apiKey : apiKey ? getMaskedApiKey(apiKey) : ""}
                onChange={(e) => {
                  if (showApiKey) {
                    setApiKey(e.target.value);
                    setTestStatus("idle");
                  }
                }}
                onFocus={() => {
                  if (!showApiKey) {
                    setShowApiKey(true);
                    // Small delay to allow the input to switch to text type
                    setTimeout(() => {
                      const input = document.getElementById("fleetgo-api-key") as HTMLInputElement;
                      if (input) input.select();
                    }, 50);
                  }
                }}
                placeholder="fleetgo_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!apiKey.trim() || testStatus === "testing"}
            >
              {testStatus === "testing" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : testStatus === "success" ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
              ) : testStatus === "error" ? (
                <XCircle className="mr-2 h-4 w-4 text-destructive" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Test
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Je API key wordt veilig opgeslagen en alleen gebruikt voor communicatie met FleetGo
          </p>
        </div>

        {/* Connection Test Result */}
        {testStatus === "success" && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">
              Verbinding gelukt
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              De API key is geldig en de verbinding met FleetGo is actief.
            </AlertDescription>
          </Alert>
        )}

        {testStatus === "error" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Verbinding mislukt</AlertTitle>
            <AlertDescription>
              Controleer of de API key correct is en probeer opnieuw.
            </AlertDescription>
          </Alert>
        )}

        {/* Last Sync Info */}
        {isConfigured && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
            <span className="text-muted-foreground">Laatste synchronisatie</span>
            <span className="font-medium">{formatLastSync(lastSyncTimestamp)}</span>
          </div>
        )}

        {/* Help Section */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>API key verkrijgen</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Om voertuigen te synchroniseren heb je een FleetGo API key nodig. Volg deze stappen:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Log in op je FleetGo dashboard</li>
              <li>Ga naar Instellingen &gt; API &amp; Integraties</li>
              <li>Klik op "Nieuwe API key genereren"</li>
              <li>Kopieer de key en plak deze hierboven</li>
            </ol>
            <Button variant="link" className="h-auto p-0 text-primary" asChild>
              <a
                href="https://app.fleetgo.nl/settings/api"
                target="_blank"
                rel="noopener noreferrer"
              >
                Naar FleetGo dashboard
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </AlertDescription>
        </Alert>

        {/* Security Note */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Beveiligingsopmerking
              </p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                De API key wordt veilig opgeslagen en is alleen zichtbaar voor beheerders.
                Voor productiegebruik wordt aanbevolen om de key in omgevingsvariabelen
                op de server op te slaan.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !apiKey.trim()}
          >
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
  );
}
