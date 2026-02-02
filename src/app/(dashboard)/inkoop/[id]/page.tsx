"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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
  ArrowLeft,
  Loader2,
  Package,
  Building2,
  Calendar,
  FileText,
  ShoppingCart,
  Truck,
  Receipt,
  FolderKanban,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowLeftIcon,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

// Memoized formatter instances
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

// Status configuratie
const STATUS_CONFIG = {
  concept: {
    label: "Concept",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: FileText,
    description: "Order is nog niet geplaatst",
  },
  besteld: {
    label: "Besteld",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: ShoppingCart,
    description: "Order is geplaatst bij leverancier",
  },
  geleverd: {
    label: "Geleverd",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    icon: Truck,
    description: "Materialen zijn ontvangen",
  },
  gefactureerd: {
    label: "Gefactureerd",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    icon: Receipt,
    description: "Factuur is verwerkt",
  },
} as const;

type InkooporderStatus = keyof typeof STATUS_CONFIG;

// Status workflow
const STATUS_WORKFLOW: Record<InkooporderStatus, InkooporderStatus | null> = {
  concept: "besteld",
  besteld: "geleverd",
  geleverd: "gefactureerd",
  gefactureerd: null,
};

const STATUS_PREVIOUS: Record<InkooporderStatus, InkooporderStatus | null> = {
  concept: null,
  besteld: "concept",
  geleverd: "besteld",
  gefactureerd: "geleverd",
};

export default function InkoopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const inkooporderId = id as Id<"inkooporders">;

  // State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Queries
  const inkooporderData = useQuery(
    api.inkooporders.getById,
    inkooporderId ? { id: inkooporderId } : "skip"
  );

  // Mutations
  const updateStatus = useMutation(api.inkooporders.updateStatus);
  const removeInkooporder = useMutation(api.inkooporders.remove);

  // Handlers
  const handleStatusChange = useCallback(async (newStatus: InkooporderStatus) => {
    if (isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      await updateStatus({ id: inkooporderId, status: newStatus });
      toast.success(`Status gewijzigd naar ${STATUS_CONFIG[newStatus].label}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Fout bij wijzigen status";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [inkooporderId, updateStatus, isUpdatingStatus]);

  const handleDelete = useCallback(async () => {
    try {
      await removeInkooporder({ id: inkooporderId });
      toast.success("Inkooporder verwijderd");
      router.push("/inkoop");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Fout bij verwijderen";
      toast.error(errorMessage);
    }
  }, [inkooporderId, removeInkooporder, router]);

  // Loading state
  if (inkooporderData === undefined) {
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
                <BreadcrumbLink href="/inkoop">Inkoop</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
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

  // Not found state
  if (!inkooporderData) {
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
                <BreadcrumbLink href="/inkoop">Inkoop</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Inkooporder niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/inkoop")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar inkoop
          </Button>
        </div>
      </>
    );
  }

  const { leverancier, project, ...inkooporder } = inkooporderData;
  const currentStatus = inkooporder.status as InkooporderStatus;
  const statusConfig = STATUS_CONFIG[currentStatus];
  const StatusIcon = statusConfig.icon;
  const nextStatus = STATUS_WORKFLOW[currentStatus];
  const prevStatus = STATUS_PREVIOUS[currentStatus];

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
              <BreadcrumbLink href="/inkoop">Inkoop</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{inkooporder.orderNummer}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar inkoop">
              <Link href="/inkoop">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {inkooporder.orderNummer}
                </h1>
                <Badge className={`${statusConfig.color} gap-1`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Aangemaakt op {formatDate(inkooporder.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {currentStatus === "concept" && (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/inkoop/${id}/bewerken`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Bewerken
                  </Link>
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Verwijderen
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Workflow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Workflow</CardTitle>
            <CardDescription>Beheer de status van deze inkooporder</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Visual Workflow */}
            <div className="flex items-center justify-between mb-6">
              {(Object.keys(STATUS_CONFIG) as InkooporderStatus[]).map((status, index) => {
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                const isActive = status === currentStatus;
                const isPast = Object.keys(STATUS_CONFIG).indexOf(currentStatus) > index;

                return (
                  <div key={status} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                          isActive
                            ? "border-primary bg-primary text-primary-foreground"
                            : isPast
                              ? "border-green-500 bg-green-50 text-green-600 dark:bg-green-950"
                              : "border-muted bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {isPast ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <span className={`text-xs mt-1 ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                        {config.label}
                      </span>
                    </div>
                    {index < Object.keys(STATUS_CONFIG).length - 1 && (
                      <div
                        className={`w-16 h-0.5 mx-2 ${
                          isPast ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-center">
              {prevStatus && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange(prevStatus)}
                  disabled={isUpdatingStatus}
                >
                  <ArrowLeftIcon className="mr-2 h-4 w-4" />
                  Terug naar {STATUS_CONFIG[prevStatus].label}
                </Button>
              )}
              {nextStatus && (
                <Button
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Markeer als {STATUS_CONFIG[nextStatus].label}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Leverancier Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Leverancier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leverancier ? (
                <>
                  <p className="font-medium text-lg">{leverancier.naam}</p>
                  {leverancier.contactpersoon && (
                    <p className="text-muted-foreground">{leverancier.contactpersoon}</p>
                  )}
                  {leverancier.email && (
                    <p className="text-muted-foreground">{leverancier.email}</p>
                  )}
                  {leverancier.telefoon && (
                    <p className="text-muted-foreground">{leverancier.telefoon}</p>
                  )}
                  {leverancier.adres && (
                    <p className="text-muted-foreground">
                      {leverancier.adres}
                      {leverancier.postcode && `, ${leverancier.postcode}`}
                      {leverancier.plaats && ` ${leverancier.plaats}`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Leverancier niet gevonden</p>
              )}
            </CardContent>
          </Card>

          {/* Project Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Gekoppeld Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{project.naam}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: {project.status}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projecten/${project._id}`}>
                      Bekijk project
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Geen project gekoppeld</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Details */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Besteld op</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {inkooporder.besteldAt ? formatDate(inkooporder.besteldAt) : "Nog niet besteld"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Geleverd op</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {inkooporder.geleverdAt ? formatDate(inkooporder.geleverdAt) : "Nog niet geleverd"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verwachte levering</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {inkooporder.verwachteLevertijd
                    ? formatDate(inkooporder.verwachteLevertijd)
                    : "Niet opgegeven"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Lines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Orderregels
            </CardTitle>
            <CardDescription>
              {inkooporder.regels.length} {inkooporder.regels.length === 1 ? "regel" : "regels"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead className="text-right">Aantal</TableHead>
                  <TableHead>Eenheid</TableHead>
                  <TableHead className="text-right">Prijs/eenheid</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inkooporder.regels.map((regel) => (
                  <TableRow key={regel.id}>
                    <TableCell className="font-medium">{regel.omschrijving}</TableCell>
                    <TableCell className="text-right">{regel.hoeveelheid}</TableCell>
                    <TableCell>{regel.eenheid}</TableCell>
                    <TableCell className="text-right">{formatCurrency(regel.prijsPerEenheid)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(regel.totaal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-semibold">
                    Totaal
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {formatCurrency(inkooporder.totaal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        {/* Notes */}
        {inkooporder.notities && (
          <Card>
            <CardHeader>
              <CardTitle>Notities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">{inkooporder.notities}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inkooporder verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je inkooporder {inkooporder.orderNummer} wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
