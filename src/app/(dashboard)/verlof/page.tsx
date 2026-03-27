"use client";

import { useState, useMemo, Suspense } from "react";
import { m } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Check,
  X,
  Trash2,
  Pencil,
  Calendar,
  List,
  Loader2,
} from "lucide-react";
import { useVerlof, useVerlofsaldo, type VerlofStatus, type VerlofType } from "@/hooks/use-verlof";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin } from "@/hooks/use-users";
import { VerlofForm } from "@/components/verlof/verlof-form";
import { VerlofSaldoCard } from "@/components/verlof/verlof-saldo-card";
import { VerlofKalender, STATUS_COLORS } from "@/components/verlof/verlof-kalender";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const TYPE_LABELS: Record<string, string> = {
  vakantie: "Vakantie",
  bijzonder: "Bijzonder verlof",
  onbetaald: "Onbetaald verlof",
  compensatie: "Compensatie",
};

const STATUS_LABELS: Record<string, string> = {
  aangevraagd: "Aangevraagd",
  goedgekeurd: "Goedgekeurd",
  afgekeurd: "Afgekeurd",
};

function VerlofPageSkeleton() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/">Dashboard</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Verlof</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </>
  );
}

function VerlofPageContent() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // State
  const [activeTab, setActiveTab] = useState<string>("alle");
  const [viewMode, setViewMode] = useState<"lijst" | "kalender">("lijst");
  const [selectedJaar, setSelectedJaar] = useState(currentYear);
  const [kalenderMaand, setKalenderMaand] = useState(currentMonth);
  const [selectedMedewerker, setSelectedMedewerker] = useState<string>("alle");

  // Dialog state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editAanvraag, setEditAanvraag] = useState<{
    _id: Id<"verlofaanvragen">;
    medewerkerId: Id<"medewerkers">;
    startDatum: string;
    eindDatum: string;
    aantalDagen: number;
    type: VerlofType;
    opmerking?: string;
  } | null>(null);
  const [afkeurAanvraag, setAfkeurAanvraag] = useState<Id<"verlofaanvragen"> | null>(null);
  const [afwijzingReden, setAfwijzingReden] = useState("");
  const [deleteAanvraag, setDeleteAanvraag] = useState<Id<"verlofaanvragen"> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Data
  const statusFilter = activeTab === "alle" ? undefined : (activeTab as VerlofStatus);
  const medewerkerFilter =
    selectedMedewerker !== "alle"
      ? (selectedMedewerker as Id<"medewerkers">)
      : undefined;
  const { aanvragen, pendingCount, isLoading, goedkeuren, afkeuren, remove } =
    useVerlof({
      status: statusFilter,
      medewerkerId: medewerkerFilter,
      jaar: selectedJaar,
    });

  // Saldo for selected medewerker
  const { saldo, isLoading: saldoLoading } = useVerlofsaldo(
    medewerkerFilter,
    selectedJaar
  );

  // Medewerkers for filter dropdown
  const medewerkers = useQuery(
    api.medewerkers.list,
    user?._id ? { isActief: true } : "skip"
  );
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  // Stats per tab
  const stats = useMemo(() => {
    return {
      alle: aanvragen.length,
      aangevraagd: aanvragen.filter((a) => a.status === "aangevraagd").length,
      goedgekeurd: aanvragen.filter((a) => a.status === "goedgekeurd").length,
      afgekeurd: aanvragen.filter((a) => a.status === "afgekeurd").length,
    };
  }, [aanvragen]);

  // Handlers
  const handleGoedkeuren = async (id: Id<"verlofaanvragen">) => {
    setActionLoading(id);
    try {
      await goedkeuren(id);
      showSuccessToast("Verlofaanvraag goedgekeurd");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Onbekende fout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAfkeuren = async () => {
    if (!afkeurAanvraag) return;
    setActionLoading(afkeurAanvraag);
    try {
      await afkeuren(afkeurAanvraag, afwijzingReden || undefined);
      showSuccessToast("Verlofaanvraag afgekeurd");
      setAfkeurAanvraag(null);
      setAfwijzingReden("");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Onbekende fout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteAanvraag) return;
    setActionLoading(deleteAanvraag);
    try {
      await remove(deleteAanvraag);
      showSuccessToast("Verlofaanvraag verwijderd");
      setDeleteAanvraag(null);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Onbekende fout");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDatum = (datum: string) => {
    try {
      return format(new Date(datum), "d MMM yyyy", { locale: nl });
    } catch {
      return datum;
    }
  };

  if (isLoading) return <VerlofPageSkeleton />;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/">Dashboard</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Verlof</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
      {/* Header */}
      <m.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Verlofregistratie</h1>
          <p className="text-muted-foreground">
            Beheer verlofaanvragen en bekijk het verlofoverzicht.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Verlof aanvragen
        </Button>
      </m.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isAdmin && (
          <Select value={selectedMedewerker} onValueChange={setSelectedMedewerker}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Alle medewerkers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle medewerkers</SelectItem>
              {medewerkersList.map((m) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={String(selectedJaar)}
          onValueChange={(v) => setSelectedJaar(Number(v))}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map((j) => (
              <SelectItem key={j} value={String(j)}>
                {j}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 ml-auto">
          <Button
            variant={viewMode === "lijst" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("lijst")}
          >
            <List className="h-4 w-4 mr-1" />
            Lijst
          </Button>
          <Button
            variant={viewMode === "kalender" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kalender")}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Kalender
          </Button>
        </div>
      </div>

      {/* Saldo card for selected medewerker */}
      {medewerkerFilter && (
        <VerlofSaldoCard saldo={saldo} isLoading={saldoLoading} />
      )}

      {viewMode === "kalender" ? (
        /* Calendar view */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (kalenderMaand === 0) {
                  setKalenderMaand(11);
                  setSelectedJaar(selectedJaar - 1);
                } else {
                  setKalenderMaand(kalenderMaand - 1);
                }
              }}
            >
              &larr;
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (kalenderMaand === 11) {
                  setKalenderMaand(0);
                  setSelectedJaar(selectedJaar + 1);
                } else {
                  setKalenderMaand(kalenderMaand + 1);
                }
              }}
            >
              &rarr;
            </Button>
          </div>
          <VerlofKalender
            aanvragen={aanvragen}
            maand={kalenderMaand}
            jaar={selectedJaar}
          />
        </div>
      ) : (
        /* List view */
        <>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="alle">
                Alle ({stats.alle})
              </TabsTrigger>
              <TabsTrigger value="aangevraagd">
                Aangevraagd
                {stats.aangevraagd > 0 && (
                  <Badge variant="default" className="ml-1.5 h-5 min-w-5 px-1 text-xs bg-yellow-600 hover:bg-yellow-600">
                    {stats.aangevraagd}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="goedgekeurd">
                Goedgekeurd ({stats.goedgekeurd})
              </TabsTrigger>
              <TabsTrigger value="afgekeurd">
                Afgekeurd ({stats.afgekeurd})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Table */}
          {aanvragen.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  Geen verlofaanvragen
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {activeTab === "alle"
                    ? "Er zijn nog geen verlofaanvragen ingediend."
                    : `Geen aanvragen met status "${STATUS_LABELS[activeTab]}".`}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Eerste aanvraag indienen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medewerker</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Dagen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aanvragen.map((aanvraag) => (
                    <TableRow key={aanvraag._id}>
                      <TableCell className="font-medium">
                        {aanvraag.medewerkerNaam}
                      </TableCell>
                      <TableCell>
                        {TYPE_LABELS[aanvraag.type] ?? aanvraag.type}
                      </TableCell>
                      <TableCell>
                        {formatDatum(aanvraag.startDatum)}
                        {aanvraag.startDatum !== aanvraag.eindDatum && (
                          <> — {formatDatum(aanvraag.eindDatum)}</>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {aanvraag.aantalDagen}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            STATUS_COLORS[aanvraag.status] ?? ""
                          }
                        >
                          {STATUS_LABELS[aanvraag.status] ?? aanvraag.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isAdmin && aanvraag.status === "aangevraagd" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() =>
                                  handleGoedkeuren(
                                    aanvraag._id as Id<"verlofaanvragen">
                                  )
                                }
                                disabled={actionLoading === aanvraag._id}
                                title="Goedkeuren"
                              >
                                {actionLoading === aanvraag._id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                                onClick={() =>
                                  setAfkeurAanvraag(
                                    aanvraag._id as Id<"verlofaanvragen">
                                  )
                                }
                                title="Afkeuren"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {aanvraag.status === "aangevraagd" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditAanvraag(aanvraag)}
                                title="Bewerken"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() =>
                                  setDeleteAanvraag(
                                    aanvraag._id as Id<"verlofaanvragen">
                                  )
                                }
                                title="Verwijderen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Add/Edit form */}
      <VerlofForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        defaultMedewerkerId={medewerkerFilter}
      />
      {editAanvraag && (
        <VerlofForm
          open={!!editAanvraag}
          onOpenChange={(open) => !open && setEditAanvraag(null)}
          initialData={editAanvraag}
        />
      )}

      {/* Rejection dialog */}
      <AlertDialog
        open={!!afkeurAanvraag}
        onOpenChange={(open) => {
          if (!open) {
            setAfkeurAanvraag(null);
            setAfwijzingReden("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlofaanvraag afkeuren</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze verlofaanvraag wilt afkeuren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reden voor afwijzing (optioneel)"
              value={afwijzingReden}
              onChange={(e) => setAfwijzingReden(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAfkeuren}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Afkeuren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteAanvraag}
        onOpenChange={(open) => !open && setDeleteAanvraag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlofaanvraag verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze verlofaanvraag wilt verwijderen? Dit kan
              niet ongedaan worden gemaakt.
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
    </m.div>
    </>
  );
}

export default function VerlofPage() {
  return (
    <Suspense fallback={<VerlofPageSkeleton />}>
      <VerlofPageContent />
    </Suspense>
  );
}
