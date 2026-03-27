"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { m } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Euro,
  User,
  Phone,
  Mail,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  XCircle,
  CheckCircle2,
  Clock,
  Leaf,
  Sun,
  CloudRain,
  Snowflake,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Id } from "../../../../../convex/_generated/dataModel";

// Status badge colors
const statusConfig = {
  concept: {
    label: "Concept",
    color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  actief: {
    label: "Actief",
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  verlopen: {
    label: "Verlopen",
    color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  opgezegd: {
    label: "Opgezegd",
    color: "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
} as const;

const factuurStatusConfig = {
  gepland: {
    label: "Gepland",
    color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  gefactureerd: {
    label: "Gefactureerd",
    color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  betaald: {
    label: "Betaald",
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
} as const;

const seizoenConfig = {
  voorjaar: { label: "Voorjaar", icon: Leaf, months: "Mrt - Mei" },
  zomer: { label: "Zomer", icon: Sun, months: "Jun - Aug" },
  herfst: { label: "Herfst", icon: CloudRain, months: "Sep - Nov" },
  winter: { label: "Winter", icon: Snowflake, months: "Dec - Feb" },
} as const;

const frequentieLabels: Record<string, string> = {
  maandelijks: "Maandelijks",
  per_kwartaal: "Per kwartaal",
  halfjaarlijks: "Halfjaarlijks",
  jaarlijks: "Jaarlijks",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ContractDetailPage() {
  return (
    <Suspense fallback={<ContractDetailLoader />}>
      <ContractDetailContent />
    </Suspense>
  );
}

function ContractDetailLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </>
  );
}

function ContractDetailContent() {
  const params = useParams();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user } = useCurrentUser();

  const contractId = params.id as Id<"onderhoudscontracten">;
  const contract = useQuery(
    api.onderhoudscontracten.getById,
    user?._id ? { id: contractId } : "skip"
  );

  const updateContract = useMutation(api.onderhoudscontracten.update);
  const addWerkzaamheid = useMutation(api.onderhoudscontracten.addWerkzaamheid);
  const removeWerkzaamheid = useMutation(api.onderhoudscontracten.removeWerkzaamheid);
  const renewContract = useMutation(api.onderhoudscontracten.renewContract);
  const cancelContract = useMutation(api.onderhoudscontracten.cancelContract);

  const [activeTab, setActiveTab] = useState("werkzaamheden");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Add werkzaamheid form state
  const [newWerk, setNewWerk] = useState({
    omschrijving: "",
    seizoen: "voorjaar" as "voorjaar" | "zomer" | "herfst" | "winter",
    frequentie: 1,
    geschatteUrenPerBeurt: 1,
  });

  // Renew form state
  const [renewData, setRenewData] = useState({
    nieuwEindDatum: "",
    nieuwTarief: "",
  });

  // Cancel form state
  const [cancelReden, setCancelReden] = useState("");

  const werkzaamheden = useMemo(
    () => contract?.werkzaamheden ?? [],
    [contract?.werkzaamheden]
  );

  // Group werkzaamheden by seizoen
  const werkzaamhedenPerSeizoen = useMemo(() => {
    if (werkzaamheden.length === 0) return {};
    const grouped: Record<string, typeof werkzaamheden> = {};
    for (const w of werkzaamheden) {
      if (!grouped[w.seizoen]) grouped[w.seizoen] = [];
      grouped[w.seizoen].push(w);
    }
    return grouped;
  }, [werkzaamheden]);

  const totalGeschatteUren = useMemo(() => {
    return werkzaamheden.reduce(
      (sum, w) => sum + w.geschatteUrenTotaal,
      0
    );
  }, [werkzaamheden]);

  // Handlers
  const handleActivate = useCallback(async () => {
    if (!contract) return;
    try {
      await updateContract({ id: contract._id, status: "actief" });
      toast.success("Contract geactiveerd");
    } catch {
      toast.error("Kon contract niet activeren");
    }
  }, [contract, updateContract]);

  const handleAddWerkzaamheid = useCallback(async () => {
    if (!contract || !newWerk.omschrijving.trim()) return;
    try {
      await addWerkzaamheid({
        contractId: contract._id,
        omschrijving: newWerk.omschrijving,
        seizoen: newWerk.seizoen,
        frequentie: newWerk.frequentie,
        geschatteUrenPerBeurt: newWerk.geschatteUrenPerBeurt,
      });
      setNewWerk({
        omschrijving: "",
        seizoen: "voorjaar",
        frequentie: 1,
        geschatteUrenPerBeurt: 1,
      });
      setShowAddDialog(false);
      toast.success("Werkzaamheid toegevoegd");
    } catch {
      toast.error("Kon werkzaamheid niet toevoegen");
    }
  }, [contract, newWerk, addWerkzaamheid]);

  const handleRemoveWerkzaamheid = useCallback(
    async (id: Id<"contractWerkzaamheden">) => {
      try {
        await removeWerkzaamheid({ id });
        toast.success("Werkzaamheid verwijderd");
      } catch {
        toast.error("Kon werkzaamheid niet verwijderen");
      }
    },
    [removeWerkzaamheid]
  );

  const handleRenew = useCallback(async () => {
    if (!contract || !renewData.nieuwEindDatum) return;
    try {
      await renewContract({
        id: contract._id,
        nieuwEindDatum: renewData.nieuwEindDatum,
        nieuwTarief: renewData.nieuwTarief
          ? parseFloat(renewData.nieuwTarief)
          : undefined,
      });
      setShowRenewDialog(false);
      setRenewData({ nieuwEindDatum: "", nieuwTarief: "" });
      toast.success("Contract verlengd");
    } catch {
      toast.error("Kon contract niet verlengen");
    }
  }, [contract, renewData, renewContract]);

  const handleCancel = useCallback(async () => {
    if (!contract) return;
    try {
      await cancelContract({
        id: contract._id,
        reden: cancelReden || undefined,
      });
      setShowCancelDialog(false);
      setCancelReden("");
      toast.success("Contract opgezegd");
    } catch {
      toast.error("Kon contract niet opzeggen");
    }
  }, [contract, cancelReden, cancelContract]);

  if (contract === undefined) {
    return <ContractDetailLoader />;
  }

  if (contract === null) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-xl font-semibold">Contract niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/contracten")}>
            Terug naar contracten
          </Button>
        </div>
      </>
    );
  }

  const statusConf = statusConfig[contract.status as keyof typeof statusConfig] ?? statusConfig.concept;

  return (
    <>
      <PageHeader />

      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Back button + title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/contracten")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {contract.naam}
              </h1>
              <Badge variant="outline" className={statusConf.color}>
                {statusConf.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {contract.contractNummer}
            </p>
          </div>
          {contract.status === "concept" && (
            <Button onClick={handleActivate}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Activeren
            </Button>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs: Werkzaamheden / Facturen */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="werkzaamheden">
                  Werkzaamheden
                  <Badge variant="secondary" className="ml-2">
                    {contract.werkzaamheden.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="facturen">
                  Termijnfacturen
                  <Badge variant="secondary" className="ml-2">
                    {contract.facturen.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Werkzaamheden tab */}
              <TabsContent value="werkzaamheden" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Totaal geschatte uren: <strong>{totalGeschatteUren}</strong> uur/jaar
                  </p>
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Werkzaamheid toevoegen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Werkzaamheid toevoegen</DialogTitle>
                        <DialogDescription>
                          Voeg een nieuwe werkzaamheid toe aan dit contract.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="omschrijving">Omschrijving</Label>
                          <Input
                            id="omschrijving"
                            placeholder="bijv. Gazon maaien"
                            value={newWerk.omschrijving}
                            onChange={(e) =>
                              setNewWerk((prev) => ({
                                ...prev,
                                omschrijving: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seizoen">Seizoen</Label>
                          <Select
                            value={newWerk.seizoen}
                            onValueChange={(val) =>
                              setNewWerk((prev) => ({
                                ...prev,
                                seizoen: val as typeof prev.seizoen,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="voorjaar">Voorjaar (Mrt - Mei)</SelectItem>
                              <SelectItem value="zomer">Zomer (Jun - Aug)</SelectItem>
                              <SelectItem value="herfst">Herfst (Sep - Nov)</SelectItem>
                              <SelectItem value="winter">Winter (Dec - Feb)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="frequentie">Frequentie (per seizoen)</Label>
                            <Input
                              id="frequentie"
                              type="number"
                              min={1}
                              value={newWerk.frequentie}
                              onChange={(e) =>
                                setNewWerk((prev) => ({
                                  ...prev,
                                  frequentie: parseInt(e.target.value) || 1,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="uren">Uren per beurt</Label>
                            <Input
                              id="uren"
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={newWerk.geschatteUrenPerBeurt}
                              onChange={(e) =>
                                setNewWerk((prev) => ({
                                  ...prev,
                                  geschatteUrenPerBeurt:
                                    parseFloat(e.target.value) || 1,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Totaal geschat:{" "}
                          <strong>
                            {newWerk.frequentie * newWerk.geschatteUrenPerBeurt}
                          </strong>{" "}
                          uur per seizoen
                        </p>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddDialog(false)}
                        >
                          Annuleren
                        </Button>
                        <Button
                          onClick={handleAddWerkzaamheid}
                          disabled={!newWerk.omschrijving.trim()}
                        >
                          Toevoegen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Werkzaamheden grouped by seizoen */}
                {(["voorjaar", "zomer", "herfst", "winter"] as const).map(
                  (seizoen) => {
                    const items = werkzaamhedenPerSeizoen[seizoen] || [];
                    const config = seizoenConfig[seizoen];
                    const Icon = config.icon;

                    return (
                      <Card key={seizoen}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {config.label}
                            <span className="text-muted-foreground font-normal text-sm">
                              ({config.months})
                            </span>
                            <Badge variant="secondary" className="ml-auto">
                              {items.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        {items.length > 0 ? (
                          <CardContent className="pt-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Werkzaamheid</TableHead>
                                  <TableHead className="text-right">
                                    Frequentie
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Uren/beurt
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Totaal uren
                                  </TableHead>
                                  <TableHead className="w-10" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((w) => (
                                  <TableRow key={w._id}>
                                    <TableCell className="font-medium">
                                      {w.omschrijving}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {w.frequentie}x
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {w.geschatteUrenPerBeurt}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {w.geschatteUrenTotaal}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          handleRemoveWerkzaamheid(
                                            w._id as Id<"contractWerkzaamheden">
                                          )
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        ) : (
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Geen werkzaamheden voor dit seizoen
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    );
                  }
                )}
              </TabsContent>

              {/* Facturen tab */}
              <TabsContent value="facturen" className="space-y-4">
                {contract.facturen.length > 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Termijn</TableHead>
                            <TableHead>Periode</TableHead>
                            <TableHead className="text-right">
                              Bedrag
                            </TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contract.facturen.map((f) => {
                            const fStatus =
                              factuurStatusConfig[
                                f.status as keyof typeof factuurStatusConfig
                              ] ?? factuurStatusConfig.gepland;
                            return (
                              <TableRow key={f._id}>
                                <TableCell className="font-medium">
                                  Termijn {f.termijnNummer}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {formatDateShort(f.periodeStart)} -{" "}
                                  {formatDateShort(f.periodeEinde)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(f.bedrag)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={fStatus.color}
                                  >
                                    {fStatus.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="p-8 text-center">
                    <Euro className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Nog geen termijnfacturen gepland
                    </p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column - 1/3 */}
          <div className="space-y-6">
            {/* Contract info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Contractgegevens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Looptijd</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(contract.startDatum)} -{" "}
                      {formatDate(contract.eindDatum)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Euro className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Tarief</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(contract.tariefPerTermijn)} /{" "}
                      {frequentieLabels[contract.betalingsfrequentie]?.toLowerCase() ?? contract.betalingsfrequentie}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(contract.jaarlijksTarief)} / jaar
                    </p>
                  </div>
                </div>
                {contract.indexatiePercentage != null && (
                  <div className="flex items-start gap-3">
                    <RefreshCcw className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Indexatie</p>
                      <p className="text-sm text-muted-foreground">
                        {contract.indexatiePercentage}% per jaar
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Opzegtermijn</p>
                    <p className="text-sm text-muted-foreground">
                      {contract.opzegtermijnDagen} dagen
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RefreshCcw className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Automatische verlenging</p>
                    <p className="text-sm text-muted-foreground">
                      {contract.autoVerlenging ? "Ja" : "Nee"}
                      {contract.autoVerlenging &&
                        contract.verlengingsPeriodeInMaanden &&
                        ` (${contract.verlengingsPeriodeInMaanden} maanden)`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Klant info */}
            {contract.klant && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Klantgegevens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {contract.klant.naam}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contract.klant.adres}, {contract.klant.postcode}{" "}
                        {contract.klant.plaats}
                      </p>
                    </div>
                  </div>
                  {contract.klant.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {contract.klant.email}
                      </p>
                    </div>
                  )}
                  {contract.klant.telefoon && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {contract.klant.telefoon}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Locatie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Werklocatie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm">
                      {contract.locatie.adres}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {contract.locatie.postcode} {contract.locatie.plaats}
                    </p>
                    {contract.locatie.notities && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {contract.locatie.notities}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(contract.status === "actief" ||
                  contract.status === "verlopen") && (
                  <Dialog
                    open={showRenewDialog}
                    onOpenChange={setShowRenewDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Contract verlengen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Contract verlengen</DialogTitle>
                        <DialogDescription>
                          Stel een nieuwe einddatum in en optioneel een
                          aangepast tarief.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="nieuwEindDatum">
                            Nieuwe einddatum
                          </Label>
                          <Input
                            id="nieuwEindDatum"
                            type="date"
                            value={renewData.nieuwEindDatum}
                            onChange={(e) =>
                              setRenewData((prev) => ({
                                ...prev,
                                nieuwEindDatum: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nieuwTarief">
                            Nieuw tarief per termijn (optioneel)
                          </Label>
                          <Input
                            id="nieuwTarief"
                            type="number"
                            step="0.01"
                            placeholder={contract.tariefPerTermijn.toString()}
                            value={renewData.nieuwTarief}
                            onChange={(e) =>
                              setRenewData((prev) => ({
                                ...prev,
                                nieuwTarief: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowRenewDialog(false)}
                        >
                          Annuleren
                        </Button>
                        <Button
                          onClick={handleRenew}
                          disabled={!renewData.nieuwEindDatum}
                        >
                          Verlengen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {contract.status !== "opgezegd" && (
                  <Dialog
                    open={showCancelDialog}
                    onOpenChange={setShowCancelDialog}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Contract opzeggen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Contract opzeggen</DialogTitle>
                        <DialogDescription>
                          Weet je zeker dat je dit contract wilt opzeggen?
                          Opzegtermijn: {contract.opzegtermijnDagen} dagen.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="reden">Reden (optioneel)</Label>
                          <Textarea
                            id="reden"
                            placeholder="Reden voor opzegging..."
                            value={cancelReden}
                            onChange={(e) => setCancelReden(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowCancelDialog(false)}
                        >
                          Annuleren
                        </Button>
                        <Button variant="destructive" onClick={handleCancel}>
                          Opzeggen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {contract.status === "concept" && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      router.push(`/contracten/nieuw?edit=${contract._id}`)
                    }
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Bewerken
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Notities */}
            {contract.notities && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {contract.notities}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </m.div>
    </>
  );
}
