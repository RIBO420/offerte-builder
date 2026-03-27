"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Wrench,
  Plus,
  Search,
  ChevronRight,
  Shield,
  Clock,
  User,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";

// Status column configuration
const statusColumns = [
  { key: "nieuw" as const, label: "Nieuw", color: "bg-blue-500" },
  { key: "in_behandeling" as const, label: "In behandeling", color: "bg-yellow-500" },
  { key: "ingepland" as const, label: "Ingepland", color: "bg-purple-500" },
  { key: "afgehandeld" as const, label: "Afgehandeld", color: "bg-green-500" },
] as const;

// Priority badge config
const prioriteitConfig: Record<string, { label: string; color: string }> = {
  laag: { label: "Laag", color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  normaal: { label: "Normaal", color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  hoog: { label: "Hoog", color: "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  urgent: { label: "Urgent", color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

type KanbanStatus = "nieuw" | "in_behandeling" | "ingepland" | "afgehandeld";

function KanbanCard({
  melding,
  onMove,
  onClick,
}: {
  melding: any;
  onMove: (id: string, newStatus: KanbanStatus) => void;
  onClick: () => void;
}) {
  const nextStatus: Record<KanbanStatus, KanbanStatus | null> = {
    nieuw: "in_behandeling",
    in_behandeling: "ingepland",
    ingepland: "afgehandeld",
    afgehandeld: null,
  };

  const next = nextStatus[melding.status as KanbanStatus];

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: prioriteit + garantie badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={prioriteitConfig[melding.prioriteit]?.color ?? ""}
          >
            {prioriteitConfig[melding.prioriteit]?.label ?? melding.prioriteit}
          </Badge>
          {melding.isGarantie ? (
            <Badge
              variant="outline"
              className="bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              <Shield className="mr-1 h-3 w-3" />
              Garantie
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            >
              Betaald
            </Badge>
          )}
        </div>

        {/* Beschrijving */}
        <p className="text-sm font-medium line-clamp-2">
          {melding.beschrijving}
        </p>

        {/* Klant */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {melding.klantNaam}
        </div>

        {/* Datum */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(melding.createdAt).toLocaleDateString("nl-NL")}
        </div>

        {/* Move button */}
        {next && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onMove(melding._id, next);
            }}
          >
            Verplaats naar {statusColumns.find((c) => c.key === next)?.label}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function ServicemeldingenPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [prioriteitFilter, setPrioriteitFilter] = useState<string>("alle");
  const [garantieFilter, setGarantieFilter] = useState<string>("alle");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Data
  const kanbanData = useQuery(
    api.servicemeldingen.getKanbanData,
    user?._id ? {} : "skip"
  );
  const klanten = useQuery(api.klanten.list, user?._id ? {} : "skip");
  const projecten = useQuery(api.projecten.list, user?._id ? {} : "skip");

  // Mutations
  const createMelding = useMutation(api.servicemeldingen.create);
  const updateStatus = useMutation(api.servicemeldingen.updateStatus);

  // Form state for new melding
  const [newMelding, setNewMelding] = useState({
    klantId: "",
    projectId: "",
    beschrijving: "",
    prioriteit: "normaal" as string,
    contactInfo: "",
  });

  const handleCreateMelding = async () => {
    if (!newMelding.klantId || !newMelding.beschrijving.trim()) {
      toast.error("Vul klant en beschrijving in");
      return;
    }

    try {
      await createMelding({
        klantId: newMelding.klantId as Id<"klanten">,
        projectId: newMelding.projectId && newMelding.projectId !== "geen"
          ? (newMelding.projectId as Id<"projecten">)
          : undefined,
        beschrijving: newMelding.beschrijving,
        prioriteit: newMelding.prioriteit as any,
        contactInfo: newMelding.contactInfo || undefined,
      });
      toast.success("Servicemelding aangemaakt");
      setShowCreateDialog(false);
      setNewMelding({
        klantId: "",
        projectId: "",
        beschrijving: "",
        prioriteit: "normaal",
        contactInfo: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Fout bij aanmaken servicemelding"
      );
    }
  };

  const handleMove = async (id: string, newStatus: KanbanStatus) => {
    try {
      await updateStatus({
        id: id as Id<"servicemeldingen">,
        status: newStatus,
      });
      toast.success(`Status bijgewerkt naar ${statusColumns.find((c) => c.key === newStatus)?.label}`);
    } catch (error) {
      toast.error("Fout bij bijwerken status");
    }
  };

  // Apply client-side search + filters on the kanban data
  const filteredKanban = useMemo(() => {
    if (!kanbanData) return null;

    const filterMeldingen = (meldingen: any[]) => {
      let result = [...meldingen];

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(
          (m) =>
            m.beschrijving.toLowerCase().includes(q) ||
            m.klantNaam.toLowerCase().includes(q)
        );
      }

      if (prioriteitFilter !== "alle") {
        result = result.filter((m) => m.prioriteit === prioriteitFilter);
      }

      if (garantieFilter === "garantie") {
        result = result.filter((m) => m.isGarantie);
      } else if (garantieFilter === "betaald") {
        result = result.filter((m) => !m.isGarantie);
      }

      return result;
    };

    return {
      nieuw: filterMeldingen(kanbanData.nieuw),
      in_behandeling: filterMeldingen(kanbanData.in_behandeling),
      ingepland: filterMeldingen(kanbanData.ingepland),
      afgehandeld: filterMeldingen(kanbanData.afgehandeld),
    };
  }, [kanbanData, searchQuery, prioriteitFilter, garantieFilter]);

  const isLoading = isUserLoading || kanbanData === undefined;

  if (isLoading) {
    return null; // loading.tsx handles this
  }

  const totalCount = filteredKanban
    ? filteredKanban.nieuw.length +
      filteredKanban.in_behandeling.length +
      filteredKanban.ingepland.length +
      filteredKanban.afgehandeld.length
    : 0;

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Title + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Servicemeldingen
            </h1>
            <p className="text-muted-foreground">
              Beheer klachten en serviceverzoeken
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe melding
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nieuwe servicemelding</DialogTitle>
                <DialogDescription>
                  Registreer een klacht of serviceverzoek. Het systeem detecteert
                  automatisch of het project onder garantie valt.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Klant</Label>
                  <Select
                    value={newMelding.klantId}
                    onValueChange={(val) =>
                      setNewMelding((prev) => ({
                        ...prev,
                        klantId: val,
                        projectId: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer klant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {klanten?.map((k: any) => (
                        <SelectItem key={k._id} value={k._id}>
                          {k.naam}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Project (optioneel)</Label>
                  <Select
                    value={newMelding.projectId}
                    onValueChange={(val) =>
                      setNewMelding((prev) => ({ ...prev, projectId: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer project..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geen">Geen project</SelectItem>
                      {projecten
                        ?.filter((p: any) => {
                          if (!newMelding.klantId) return true;
                          // Show all projects — filtering by klant would
                          // require offerte lookup which is complex
                          return true;
                        })
                        .map((p: any) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.naam}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Beschrijving</Label>
                  <Textarea
                    placeholder="Beschrijf het probleem..."
                    rows={4}
                    value={newMelding.beschrijving}
                    onChange={(e) =>
                      setNewMelding((prev) => ({
                        ...prev,
                        beschrijving: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Prioriteit</Label>
                    <Select
                      value={newMelding.prioriteit}
                      onValueChange={(val) =>
                        setNewMelding((prev) => ({
                          ...prev,
                          prioriteit: val,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="laag">Laag</SelectItem>
                        <SelectItem value="normaal">Normaal</SelectItem>
                        <SelectItem value="hoog">Hoog</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Contactinfo (optioneel)</Label>
                    <Input
                      placeholder="Telefoonnummer..."
                      value={newMelding.contactInfo}
                      onChange={(e) =>
                        setNewMelding((prev) => ({
                          ...prev,
                          contactInfo: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Annuleren
                </Button>
                <Button onClick={handleCreateMelding}>Aanmaken</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op beschrijving of klant..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={prioriteitFilter} onValueChange={setPrioriteitFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prioriteit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle prioriteiten</SelectItem>
              <SelectItem value="laag">Laag</SelectItem>
              <SelectItem value="normaal">Normaal</SelectItem>
              <SelectItem value="hoog">Hoog</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={garantieFilter} onValueChange={setGarantieFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle types</SelectItem>
              <SelectItem value="garantie">Garantie</SelectItem>
              <SelectItem value="betaald">Betaald</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Kanban board */}
        {totalCount === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">
                Geen servicemeldingen gevonden
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery || prioriteitFilter !== "alle" || garantieFilter !== "alle"
                  ? "Pas de filters aan"
                  : "Maak een nieuwe servicemelding aan"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[400px]">
            {statusColumns.map((col) => {
              const items = filteredKanban?.[col.key] ?? [];
              return (
                <div key={col.key} className="space-y-3">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-1">
                    <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {items.length}
                    </Badge>
                  </div>

                  {/* Column content */}
                  <div className="space-y-3 min-h-[100px] rounded-lg bg-muted/30 p-2">
                    {items.length === 0 ? (
                      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                        Geen meldingen
                      </div>
                    ) : (
                      items.map((melding: any) => (
                        <KanbanCard
                          key={melding._id}
                          melding={melding}
                          onMove={handleMove}
                          onClick={() =>
                            router.push(`/servicemeldingen/${melding._id}`)
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
