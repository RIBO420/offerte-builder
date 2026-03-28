"use client";

import { useState, useMemo, Suspense } from "react";
import { m } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { Plus, HeartPulse, Heart, Trash2, Thermometer, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin } from "@/hooks/use-users";
import { ZiekmeldingForm, HerstelmeldingForm } from "@/components/verzuim/ziekmelding-form";
import { VerzuimStatsCards } from "@/components/verzuim/verzuim-stats-cards";
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

function VerzuimPageSkeleton() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}</div>
        <div className="h-64 bg-muted rounded" />
      </div>
    </>
  );
}

function VerzuimPageContent() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin();
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<string>("alle");
  const [selectedJaar, setSelectedJaar] = useState(currentYear);
  const [selectedMedewerker, setSelectedMedewerker] = useState<string>("alle");
  const [showZiekmeldingForm, setShowZiekmeldingForm] = useState(false);
  const [herstelTarget, setHerstelTarget] = useState<{ id: Id<"verzuimregistraties">; naam: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Id<"verzuimregistraties"> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const medewerkerFilter = selectedMedewerker !== "alle" ? (selectedMedewerker as Id<"medewerkers">) : undefined;
  const registraties = useQuery(api.verzuim.list, user?._id ? { medewerkerId: medewerkerFilter, alleenActief: activeTab === "actief" ? true : undefined, jaar: selectedJaar } : "skip");
  const stats = useQuery(api.verzuim.getStats, user?._id ? { jaar: selectedJaar } : "skip");
  const frequentVerzuim = useQuery(api.verzuim.checkFrequentVerzuim, user?._id ? {} : "skip");
  const removeMutation = useMutation(api.verzuim.remove);
  const medewerkers = useQuery(api.medewerkers.list, user?._id ? { isActief: true } : "skip");
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);
  const registratiesList = useMemo(() => registraties ?? [], [registraties]);

  const filteredRegistraties = useMemo(() => {
    if (activeTab === "actief") return registratiesList.filter((r) => r.isActief);
    if (activeTab === "hersteld") return registratiesList.filter((r) => !r.isActief);
    return registratiesList;
  }, [registratiesList, activeTab]);

  const tabStats = useMemo(() => ({
    alle: registratiesList.length,
    actief: registratiesList.filter((r) => r.isActief).length,
    hersteld: registratiesList.filter((r) => !r.isActief).length,
  }), [registratiesList]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget);
    try { await removeMutation({ id: deleteTarget }); showSuccessToast("Verzuimregistratie verwijderd"); setDeleteTarget(null);
    } catch (error) { showErrorToast(error instanceof Error ? error.message : "Onbekende fout");
    } finally { setActionLoading(null); }
  };

  const formatDatum = (datum: string) => { try { return format(new Date(datum), "d MMM yyyy", { locale: nl }); } catch { return datum; } };
  const isLoading = !!user && registraties === undefined;
  if (isLoading) return <VerzuimPageSkeleton />;

  return (
    <>
      <PageHeader />

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
      <m.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ziekteverzuim</h1><p className="text-muted-foreground">Registreer ziek- en herstelmeldingen, bekijk verzuimstatistieken.</p></div>
        <Button onClick={() => setShowZiekmeldingForm(true)}><Plus className="mr-2 h-4 w-4" />Ziekmelding</Button>
      </m.div>

      <VerzuimStatsCards stats={stats ?? null} frequentVerzuim={frequentVerzuim ?? []} isLoading={stats === undefined} />

      <div className="flex flex-col sm:flex-row gap-3">
        {isAdmin && (<Select value={selectedMedewerker} onValueChange={setSelectedMedewerker}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Alle medewerkers" /></SelectTrigger><SelectContent><SelectItem value="alle">Alle medewerkers</SelectItem>{medewerkersList.map((m) => <SelectItem key={m._id} value={m._id}>{m.naam}</SelectItem>)}</SelectContent></Select>)}
        <Select value={String(selectedJaar)} onValueChange={(v) => setSelectedJaar(Number(v))}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{[currentYear - 1, currentYear, currentYear + 1].map((j) => <SelectItem key={j} value={String(j)}>{j}</SelectItem>)}</SelectContent></Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList>
        <TabsTrigger value="alle">Alle ({tabStats.alle})</TabsTrigger>
        <TabsTrigger value="actief">Ziek{tabStats.actief > 0 && <Badge variant="default" className="ml-1.5 h-5 min-w-5 px-1 text-xs bg-red-600 hover:bg-red-600">{tabStats.actief}</Badge>}</TabsTrigger>
        <TabsTrigger value="hersteld">Hersteld ({tabStats.hersteld})</TabsTrigger>
      </TabsList></Tabs>

      {filteredRegistraties.length === 0 ? (
        <Card><CardContent className="py-4"><EmptyState icon={<Thermometer />} title="Geen verzuimregistraties" description={activeTab === "actief" ? "Niemand is momenteel ziek gemeld." : "Er zijn nog geen verzuimregistraties."} /></CardContent></Card>
      ) : (
        <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Medewerker</TableHead><TableHead>Eerste ziektedag</TableHead><TableHead>Hersteld</TableHead><TableHead className="text-right">Dagen</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Acties</TableHead></TableRow></TableHeader>
          <TableBody>{filteredRegistraties.map((reg) => (
            <TableRow key={reg._id}>
              <TableCell className="font-medium">{reg.medewerkerNaam}</TableCell>
              <TableCell>{formatDatum(reg.startDatum)}</TableCell>
              <TableCell>{reg.herstelDatum ? formatDatum(reg.herstelDatum) : "—"}</TableCell>
              <TableCell className="text-right">{reg.dagen}</TableCell>
              <TableCell>{reg.isActief ? (<Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><HeartPulse className="h-3 w-3 mr-1" />Ziek</Badge>) : (<Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><Heart className="h-3 w-3 mr-1" />Hersteld</Badge>)}</TableCell>
              <TableCell className="text-right"><div className="flex justify-end gap-1">
                {reg.isActief && (<Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => setHerstelTarget({ id: reg._id as Id<"verzuimregistraties">, naam: reg.medewerkerNaam })}><Heart className="h-4 w-4 mr-1" />Hersteld</Button>)}
                {isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(reg._id as Id<"verzuimregistraties">)} title="Verwijderen" aria-label="Verwijderen">{actionLoading === reg._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>)}
              </div></TableCell>
            </TableRow>))}</TableBody></Table></div>
      )}

      <ZiekmeldingForm open={showZiekmeldingForm} onOpenChange={setShowZiekmeldingForm} />
      <HerstelmeldingForm open={!!herstelTarget} onOpenChange={(open) => !open && setHerstelTarget(null)} verzuimId={herstelTarget?.id ?? null} medewerkerNaam={herstelTarget?.naam ?? ""} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Verzuimregistratie verwijderen</AlertDialogTitle><AlertDialogDescription>Weet je zeker dat je deze registratie wilt verwijderen?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuleren</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </m.div>
    </>
  );
}

export default function VerzuimPage() {
  return (<Suspense fallback={<VerzuimPageSkeleton />}><VerzuimPageContent /></Suspense>);
}
