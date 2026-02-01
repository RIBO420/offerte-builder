"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Car,
  ArrowLeft,
  Loader2,
  Wrench,
  Gauge,
  Fuel,
  ShieldCheck,
  Plus,
  CheckCircle2,
  Clock,
  Calendar,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useVoertuigDetails } from "@/hooks/use-voertuig-details";
import { KentekenPlaat } from "@/components/wagenpark/kenteken-plaat";
import { ComplianceStatus } from "@/components/wagenpark/compliance-badges";
import { OnderhoudForm } from "@/components/wagenpark/onderhoud-form";
import { KilometerLog } from "@/components/wagenpark/kilometer-log";
import { BrandstofForm } from "@/components/wagenpark/brandstof-form";

// Vehicle type labels
const typeLabels: Record<string, string> = {
  bus: "Bus",
  bestelwagen: "Bestelwagen",
  pickup: "Pickup",
  aanhanger: "Aanhanger",
  overig: "Overig",
};

// Status configuration
const statusConfig: Record<
  "actief" | "inactief" | "onderhoud",
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  actief: {
    label: "Actief",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
  },
  onderhoud: {
    label: "In onderhoud",
    variant: "secondary",
    icon: <Wrench className="h-3 w-3 mr-1" />,
  },
  inactief: {
    label: "Inactief",
    variant: "outline",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
};

// Onderhoud type labels
const onderhoudTypeLabels: Record<string, string> = {
  olie: "Olieverversing",
  apk: "APK keuring",
  banden: "Banden",
  inspectie: "Inspectie",
  reparatie: "Reparatie",
  overig: "Overig",
};

// Onderhoud status config
const onderhoudStatusConfig: Record<
  "gepland" | "in_uitvoering" | "voltooid",
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  gepland: { label: "Gepland", variant: "outline" },
  in_uitvoering: { label: "In uitvoering", variant: "secondary" },
  voltooid: { label: "Voltooid", variant: "default" },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatKmStand(km: number | undefined): string {
  if (km === undefined) return "-";
  return new Intl.NumberFormat("nl-NL").format(km) + " km";
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined) return "-";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export default function VoertuigDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const voertuigId = id as Id<"voertuigen">;

  const {
    voertuig,
    onderhoudRecords,
    kilometerRecords,
    brandstofRecords,
    brandstofStats,
    apkDaysLeft,
    verzekeringDaysLeft,
    isLoading,
    createOnderhoud,
    updateOnderhoud,
    removeOnderhoud,
    createKilometer,
    removeKilometer,
    createBrandstof,
    removeBrandstof,
  } = useVoertuigDetails(voertuigId);

  const [activeTab, setActiveTab] = useState("overzicht");
  const [showOnderhoudForm, setShowOnderhoudForm] = useState(false);
  const [editingOnderhoud, setEditingOnderhoud] = useState<typeof onderhoudRecords[0] | null>(null);
  const [deleteOnderhoudId, setDeleteOnderhoudId] = useState<Id<"voertuigOnderhoud"> | null>(null);

  // Calculate upcoming maintenance count
  const upcomingCount = useMemo(() => {
    return onderhoudRecords.filter(
      (r) => r.status === "gepland" || r.status === "in_uitvoering"
    ).length;
  }, [onderhoudRecords]);

  const handleDeleteOnderhoud = async () => {
    if (!deleteOnderhoudId) return;

    try {
      await removeOnderhoud(deleteOnderhoudId);
      toast.success("Onderhoud verwijderd");
      setDeleteOnderhoudId(null);
    } catch (error) {
      console.error("Error deleting onderhoud:", error);
      toast.error("Fout bij verwijderen");
    }
  };

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
                <BreadcrumbLink href="/wagenpark">Wagenpark</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Laden...</p>
          </motion.div>
        </div>
      </>
    );
  }

  if (!voertuig) {
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
                <BreadcrumbLink href="/wagenpark">Wagenpark</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Car className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Voertuig niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/wagenpark")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar wagenpark
          </Button>
        </div>
      </>
    );
  }

  const statusInfo = statusConfig[voertuig.status as keyof typeof statusConfig];

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
              <BreadcrumbLink href="/wagenpark">Wagenpark</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{voertuig.kenteken}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/wagenpark">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-4">
              <KentekenPlaat kenteken={voertuig.kenteken} size="lg" />
              <div>
                <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                  {voertuig.merk} {voertuig.model}
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">
                    {typeLabels[voertuig.type] || voertuig.type}
                  </Badge>
                  {voertuig.bouwjaar && (
                    <span className="text-sm">{voertuig.bouwjaar}</span>
                  )}
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOnderhoudForm(true)}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Onderhoud
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab("brandstof")}
            >
              <Fuel className="mr-2 h-4 w-4" />
              Brandstof
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
            <TabsTrigger value="onderhoud">
              Onderhoud
              {upcomingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {upcomingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="kilometers">Kilometers</TabsTrigger>
            <TabsTrigger value="brandstof">Brandstof</TabsTrigger>
          </TabsList>

          {/* Overzicht Tab */}
          <TabsContent value="overzicht" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Car className="h-4 w-4" />
                    Voertuig Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">KM Stand</span>
                    <span className="font-medium">
                      {formatKmStand(voertuig.kmStand)}
                    </span>
                  </div>
                  {voertuig.kleur && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Kleur</span>
                        <span>{voertuig.kleur}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* APK Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4" />
                    APK Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {voertuig.apkVervaldatum ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Vervaldatum
                        </span>
                        <span className="font-medium">
                          {formatDate(voertuig.apkVervaldatum)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Nog geldig
                        </span>
                        {apkDaysLeft !== null && (
                          <span
                            className={
                              apkDaysLeft < 0
                                ? "text-red-500 font-medium"
                                : apkDaysLeft <= 30
                                ? "text-red-500 font-medium"
                                : apkDaysLeft <= 60
                                ? "text-amber-500 font-medium"
                                : "text-green-500 font-medium"
                            }
                          >
                            {apkDaysLeft < 0
                              ? `Verlopen (${Math.abs(apkDaysLeft)} dagen)`
                              : `${apkDaysLeft} dagen`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      APK vervaldatum niet ingesteld
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Verzekering Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4" />
                    Verzekering Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {voertuig.verzekeringsVervaldatum ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Vervaldatum
                        </span>
                        <span className="font-medium">
                          {formatDate(voertuig.verzekeringsVervaldatum)}
                        </span>
                      </div>
                      {voertuig.verzekeraar && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Verzekeraar
                            </span>
                            <span>{voertuig.verzekeraar}</span>
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Nog geldig
                        </span>
                        {verzekeringDaysLeft !== null && (
                          <span
                            className={
                              verzekeringDaysLeft < 0
                                ? "text-red-500 font-medium"
                                : verzekeringDaysLeft <= 30
                                ? "text-red-500 font-medium"
                                : verzekeringDaysLeft <= 60
                                ? "text-amber-500 font-medium"
                                : "text-green-500 font-medium"
                            }
                          >
                            {verzekeringDaysLeft < 0
                              ? `Verlopen (${Math.abs(verzekeringDaysLeft)} dagen)`
                              : `${verzekeringDaysLeft} dagen`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Verzekering vervaldatum niet ingesteld
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Compliance Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compliance Overzicht</CardTitle>
                <CardDescription>
                  APK en verzekering status voor dit voertuig
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComplianceStatus
                  apkDaysLeft={apkDaysLeft}
                  verzekeringDaysLeft={verzekeringDaysLeft}
                  apkExpiryDate={voertuig.apkVervaldatum}
                  verzekeringExpiryDate={voertuig.verzekeringsVervaldatum}
                />
              </CardContent>
            </Card>

            {/* Recent Onderhoud */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Recente Onderhoud</CardTitle>
                    <CardDescription>
                      Laatste 5 onderhoudsrecords
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("onderhoud")}
                  >
                    Alles bekijken
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {onderhoudRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nog geen onderhoudsrecords
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Kosten</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {onderhoudRecords.slice(0, 5).map((record) => (
                        <TableRow key={record._id}>
                          <TableCell className="font-medium">
                            {onderhoudTypeLabels[record.type] || record.type}
                          </TableCell>
                          <TableCell>
                            {formatDate(record.geplanteDatum)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                onderhoudStatusConfig[record.status].variant
                              }
                            >
                              {onderhoudStatusConfig[record.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(record.kosten)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Notities */}
            {voertuig.notities && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {voertuig.notities}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onderhoud Tab */}
          <TabsContent value="onderhoud" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Onderhoud Historie</CardTitle>
                    <CardDescription>
                      Alle onderhoudsrecords voor dit voertuig
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowOnderhoudForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Onderhoud plannen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {onderhoudRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">Geen onderhoud</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Plan het eerste onderhoud voor dit voertuig
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => setShowOnderhoudForm(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Onderhoud plannen
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Omschrijving</TableHead>
                        <TableHead>Geplande datum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Kosten</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {onderhoudRecords.map((record) => (
                        <TableRow key={record._id}>
                          <TableCell className="font-medium">
                            {onderhoudTypeLabels[record.type] || record.type}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.omschrijving}
                          </TableCell>
                          <TableCell>
                            {formatDate(record.geplanteDatum)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                onderhoudStatusConfig[record.status].variant
                              }
                            >
                              {onderhoudStatusConfig[record.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(record.kosten)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingOnderhoud(record)}
                                className="h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteOnderhoudId(record._id)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kilometers Tab */}
          <TabsContent value="kilometers">
            <KilometerLog
              voertuigId={voertuigId}
              records={kilometerRecords}
              currentKmStand={voertuig.kmStand}
              isLoading={isLoading ?? false}
              onCreate={createKilometer}
              onRemove={removeKilometer}
            />
          </TabsContent>

          {/* Brandstof Tab */}
          <TabsContent value="brandstof">
            <BrandstofForm
              voertuigId={voertuigId}
              records={brandstofRecords}
              stats={brandstofStats}
              currentKmStand={voertuig.kmStand}
              isLoading={isLoading ?? false}
              onCreate={createBrandstof}
              onRemove={removeBrandstof}
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Onderhoud Form Dialog */}
      <OnderhoudForm
        open={showOnderhoudForm || !!editingOnderhoud}
        onOpenChange={(open) => {
          if (!open) {
            setShowOnderhoudForm(false);
            setEditingOnderhoud(null);
          }
        }}
        voertuigId={voertuigId}
        initialData={editingOnderhoud}
        onSubmit={createOnderhoud}
        onUpdate={updateOnderhoud}
      />

      {/* Delete Onderhoud Confirmation */}
      <AlertDialog
        open={!!deleteOnderhoudId}
        onOpenChange={() => setDeleteOnderhoudId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Onderhoud verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit onderhoud record wilt verwijderen? Deze
              actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOnderhoud}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
