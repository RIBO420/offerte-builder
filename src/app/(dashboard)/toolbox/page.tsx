"use client";

import { useState, useMemo, Suspense } from "react";
import { m } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { Plus, ClipboardList, Trash2, Pencil, Users, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin } from "@/hooks/use-users";
import { ToolboxForm } from "@/components/toolbox/toolbox-form";
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

function ToolboxPageSkeleton() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </>
  );
}

function ToolboxPageContent() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin();
  const currentYear = new Date().getFullYear();
  const [selectedJaar, setSelectedJaar] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [editMeeting, setEditMeeting] = useState<{
    _id: Id<"toolboxMeetings">;
    datum: string;
    onderwerp: string;
    beschrijving?: string;
    aanwezigen: Id<"medewerkers">[];
    notities?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Id<"toolboxMeetings"> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const meetings = useQuery(api.toolboxMeetings.list, user?._id ? { jaar: selectedJaar } : "skip");
  const meetingCount = useQuery(api.toolboxMeetings.count, user?._id ? { jaar: selectedJaar } : "skip");
  const removeMutation = useMutation(api.toolboxMeetings.remove);
  const meetingsList = useMemo(() => meetings ?? [], [meetings]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget);
    try { await removeMutation({ id: deleteTarget }); showSuccessToast("Toolbox meeting verwijderd"); setDeleteTarget(null);
    } catch (error) { showErrorToast(error instanceof Error ? error.message : "Onbekende fout");
    } finally { setActionLoading(null); }
  };

  const formatDatum = (datum: string) => { try { return format(new Date(datum), "d MMMM yyyy", { locale: nl }); } catch { return datum; } };
  const isLoading = !!user && meetings === undefined;
  if (isLoading) return <ToolboxPageSkeleton />;

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Toolbox Meetings</h1>
          <p className="text-muted-foreground">Registreer veiligheidsbijeenkomsten voor wettelijke documentatie.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Nieuwe meeting</Button>
      </m.div>

      <div className="flex items-center gap-4">
        <Select value={String(selectedJaar)} onValueChange={(v) => setSelectedJaar(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[currentYear - 1, currentYear, currentYear + 1].map((j) => <SelectItem key={j} value={String(j)}>{j}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="outline" className="text-sm">{meetingCount ?? 0} meetings in {selectedJaar}</Badge>
      </div>

      {meetingsList.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">Geen toolbox meetings</h3>
          <p className="text-sm text-muted-foreground mb-4">Er zijn nog geen meetings geregistreerd in {selectedJaar}.</p>
          <Button variant="outline" onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Eerste meeting registreren</Button>
        </CardContent></Card>
      ) : (
        <div className="rounded-md border"><Table><TableHeader><TableRow>
          <TableHead>Datum</TableHead><TableHead>Onderwerp</TableHead><TableHead>Aanwezigen</TableHead><TableHead className="text-right">Acties</TableHead>
        </TableRow></TableHeader>
        <TableBody>{meetingsList.map((meeting) => (
          <TableRow key={meeting._id}>
            <TableCell className="font-medium">{formatDatum(meeting.datum)}</TableCell>
            <TableCell>
              <div>{meeting.onderwerp}</div>
              {meeting.beschrijving && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{meeting.beschrijving}</p>}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{meeting.aanwezigenNamen.length}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {meeting.aanwezigenNamen.join(", ")}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditMeeting(meeting)} title="Bewerken" aria-label="Bewerken"><Pencil className="h-4 w-4" /></Button>
                {isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(meeting._id as Id<"toolboxMeetings">)} title="Verwijderen" aria-label="Verwijderen">{actionLoading === meeting._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>)}
              </div>
            </TableCell>
          </TableRow>))}</TableBody></Table></div>
      )}

      <ToolboxForm open={showForm} onOpenChange={setShowForm} />
      {editMeeting && <ToolboxForm open={!!editMeeting} onOpenChange={(open) => !open && setEditMeeting(null)} initialData={editMeeting} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Toolbox meeting verwijderen</AlertDialogTitle><AlertDialogDescription>Weet je zeker dat je deze meeting wilt verwijderen? Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Annuleren</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </m.div>
    </>
  );
}

export default function ToolboxPage() {
  return (<Suspense fallback={<ToolboxPageSkeleton />}><ToolboxPageContent /></Suspense>);
}
