"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Truck,
  Settings,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";

// Mock type for FleetGo vehicle data
export interface FleetGoVehicle {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  type: string;
  vin?: string;
  mileage?: number;
  lastUpdated?: string;
  status: "active" | "inactive" | "maintenance";
}

interface FleetGoSyncProps {
  onImport?: (vehicles: FleetGoVehicle[]) => Promise<void>;
  onOpenSettings?: () => void;
  isApiKeyConfigured?: boolean;
  lastSyncTimestamp?: string | null;
}

type ConnectionStatus = "unknown" | "checking" | "connected" | "error" | "not_configured";
type SyncStatus = "idle" | "syncing" | "success" | "error";

export function FleetGoSync({
  onImport,
  onOpenSettings,
  isApiKeyConfigured = false,
  lastSyncTimestamp = null,
}: FleetGoSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    isApiKeyConfigured ? "unknown" : "not_configured"
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncProgress, setSyncProgress] = useState(0);
  const [vehicles, setVehicles] = useState<FleetGoVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check connection when dialog opens
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open && isApiKeyConfigured && connectionStatus === "unknown") {
      checkConnection();
    }
    if (!open) {
      // Reset state when closing
      setSyncStatus("idle");
      setSyncProgress(0);
      setError(null);
    }
  }, [isApiKeyConfigured, connectionStatus]); // eslint-disable-line react-hooks/exhaustive-deps -- checkConnection is defined below

  // Mock connection check - replace with actual API call
  const checkConnection = useCallback(async () => {
    setConnectionStatus("checking");
    setError(null);

    try {
      // TODO: Replace with actual FleetGo API connection check
      // const response = await fetch('/api/fleetgo/status');
      // if (!response.ok) throw new Error('Connection failed');

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate success (in real implementation, check API response)
      setConnectionStatus("connected");
    } catch (err) {
      setConnectionStatus("error");
      setError("Kan geen verbinding maken met FleetGo. Controleer je API key.");
    }
  }, []);

  // Mock sync function - replace with actual API call
  const handleSync = useCallback(async () => {
    if (!isApiKeyConfigured) {
      toast.error("API key niet geconfigureerd");
      return;
    }

    setSyncStatus("syncing");
    setSyncProgress(0);
    setError(null);
    setVehicles([]);
    setSelectedVehicles(new Set());

    try {
      // TODO: Replace with actual FleetGo API sync
      // Simulate progress
      for (let i = 0; i <= 100; i += 20) {
        setSyncProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Mock vehicle data - replace with actual API response
      const mockVehicles: FleetGoVehicle[] = [
        {
          id: "fg-001",
          licensePlate: "AB-123-CD",
          brand: "Mercedes-Benz",
          model: "Sprinter 316 CDI",
          type: "Bestelbus",
          vin: "WDB9066331S123456",
          mileage: 45230,
          lastUpdated: new Date().toISOString(),
          status: "active",
        },
        {
          id: "fg-002",
          licensePlate: "EF-456-GH",
          brand: "Volkswagen",
          model: "Transporter T6.1",
          type: "Bestelbus",
          vin: "WV2ZZZ7HZLH123456",
          mileage: 32150,
          lastUpdated: new Date().toISOString(),
          status: "active",
        },
        {
          id: "fg-003",
          licensePlate: "IJ-789-KL",
          brand: "Ford",
          model: "Transit Custom",
          type: "Bestelbus",
          vin: "WF0XXXGCDXLY12345",
          mileage: 67890,
          lastUpdated: new Date().toISOString(),
          status: "maintenance",
        },
        {
          id: "fg-004",
          licensePlate: "MN-012-OP",
          brand: "Iveco",
          model: "Daily 35S16",
          type: "Vrachtwagen",
          vin: "ZCFC135B405123456",
          mileage: 89450,
          lastUpdated: new Date().toISOString(),
          status: "active",
        },
        {
          id: "fg-005",
          licensePlate: "QR-345-ST",
          brand: "Renault",
          model: "Master L3H2",
          type: "Bestelbus",
          vin: "VF1MA000X61234567",
          mileage: 54320,
          lastUpdated: new Date().toISOString(),
          status: "inactive",
        },
      ];

      setVehicles(mockVehicles);
      // Select all active vehicles by default
      setSelectedVehicles(
        new Set(mockVehicles.filter((v) => v.status === "active").map((v) => v.id))
      );
      setSyncStatus("success");
      setSyncProgress(100);
    } catch (err) {
      setSyncStatus("error");
      setError("Fout bij ophalen voertuiggegevens van FleetGo.");
      toast.error("Sync mislukt");
    }
  }, [isApiKeyConfigured]);

  // Toggle vehicle selection
  const toggleVehicle = useCallback((vehicleId: string) => {
    setSelectedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  }, []);

  // Select/deselect all
  const toggleAll = useCallback(() => {
    if (selectedVehicles.size === vehicles.length) {
      setSelectedVehicles(new Set());
    } else {
      setSelectedVehicles(new Set(vehicles.map((v) => v.id)));
    }
  }, [vehicles, selectedVehicles]);

  // Import selected vehicles
  const handleImport = useCallback(async () => {
    if (selectedVehicles.size === 0) {
      toast.error("Selecteer minimaal 1 voertuig");
      return;
    }

    setIsImporting(true);

    try {
      const vehiclesToImport = vehicles.filter((v) => selectedVehicles.has(v.id));

      if (onImport) {
        await onImport(vehiclesToImport);
      }

      toast.success(`${vehiclesToImport.length} voertuig(en) geimporteerd`);
      setIsOpen(false);
    } catch (err) {
      toast.error("Fout bij importeren voertuigen");
    } finally {
      setIsImporting(false);
    }
  }, [vehicles, selectedVehicles, onImport]);

  // Format last sync timestamp
  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return "Nog nooit gesynchroniseerd";
    const date = new Date(timestamp);
    return `Laatst gesynchroniseerd: ${date.toLocaleDateString("nl-NL")} om ${date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Get status badge for vehicle
  const getStatusBadge = (status: FleetGoVehicle["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600">Actief</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactief</Badge>;
      case "maintenance":
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Onderhoud</Badge>;
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Sync met FleetGo
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              FleetGo Synchronisatie
            </DialogTitle>
            <DialogDescription>
              Importeer voertuigen vanuit je FleetGo account naar het wagenpark
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {connectionStatus === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {connectionStatus === "connected" && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  {connectionStatus === "error" && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {connectionStatus === "not_configured" && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                  {connectionStatus === "unknown" && (
                    <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />
                  )}
                  <span className="text-sm font-medium">
                    {connectionStatus === "checking" && "Verbinding controleren..."}
                    {connectionStatus === "connected" && "Verbonden met FleetGo"}
                    {connectionStatus === "error" && "Verbinding mislukt"}
                    {connectionStatus === "not_configured" && "API key niet geconfigureerd"}
                    {connectionStatus === "unknown" && "Verbindingsstatus onbekend"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatLastSync(lastSyncTimestamp)}
              </div>
            </div>

            {/* Not Configured Warning */}
            {connectionStatus === "not_configured" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>FleetGo niet geconfigureerd</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Om voertuigen te synchroniseren moet je eerst je FleetGo API key
                    configureren in de instellingen.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenSettings?.();
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Naar instellingen
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {error && connectionStatus !== "not_configured" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Fout</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Sync Progress */}
            {syncStatus === "syncing" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Voertuigen ophalen...</span>
                  <span>{syncProgress}%</span>
                </div>
                <Progress value={syncProgress} />
              </div>
            )}

            {/* Sync Button */}
            {connectionStatus === "connected" && syncStatus === "idle" && (
              <Button onClick={handleSync} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Voertuigen ophalen
              </Button>
            )}

            {/* Vehicle List */}
            {syncStatus === "success" && vehicles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {vehicles.length} voertuig(en) gevonden
                  </span>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedVehicles.size === vehicles.length
                      ? "Deselecteer alles"
                      : "Selecteer alles"}
                  </Button>
                </div>

                <ScrollArea className="h-[300px] rounded-md border">
                  <div className="p-4 space-y-3">
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedVehicles.has(vehicle.id)
                            ? "bg-primary/5 border-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleVehicle(vehicle.id)}
                      >
                        <Checkbox
                          checked={selectedVehicles.has(vehicle.id)}
                          onCheckedChange={() => toggleVehicle(vehicle.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">
                              {vehicle.licensePlate}
                            </span>
                            {getStatusBadge(vehicle.status)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate" title={`${vehicle.brand} ${vehicle.model}`}>
                            {vehicle.brand} {vehicle.model}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span>{vehicle.type}</span>
                            {vehicle.mileage && (
                              <span>{vehicle.mileage.toLocaleString("nl-NL")} km</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <p className="text-xs text-muted-foreground">
                  Geselecteerd: {selectedVehicles.size} van {vehicles.length} voertuigen
                </p>
              </div>
            )}

            {/* No Vehicles Found */}
            {syncStatus === "success" && vehicles.length === 0 && (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Geen voertuigen gevonden in FleetGo
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuleren
            </Button>
            {syncStatus === "success" && vehicles.length > 0 && (
              <Button
                onClick={handleImport}
                disabled={selectedVehicles.size === 0 || isImporting}
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Importeren ({selectedVehicles.size})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
