"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Wrench,
  Plus,
  Search,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getGarantieColor(eindDatum: string, status: string) {
  if (status === "verlopen") return "text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-400";
  const days = daysUntil(eindDatum);
  if (days <= 30) return "text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-400";
  if (days <= 180) return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400";
  return "text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 dark:text-green-400";
}

function GarantieStatusBadge({ status, eindDatum }: { status: string; eindDatum: string }) {
  if (status === "verlopen") {
    return (
      <Badge variant="outline" className="bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200">
        Verlopen
      </Badge>
    );
  }
  const days = daysUntil(eindDatum);
  if (days <= 30) {
    return (
      <Badge variant="outline" className="bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200">
        Verloopt in {days}d
      </Badge>
    );
  }
  if (days <= 180) {
    return (
      <Badge variant="outline" className="bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        {Math.ceil(days / 30)} maanden resterend
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200">
      Actief
    </Badge>
  );
}

export default function GarantiesPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Data queries
  const garanties = useQuery(api.garanties.list, user?._id ? {} : "skip");
  const stats = useQuery(api.garanties.getStats, user?._id ? {} : "skip");

  // Mutations
  const createGarantie = useMutation(api.garanties.create);
  const checkExpire = useMutation(api.garanties.checkAndExpire);

  // Form state for creating a garantie
  const [newGarantie, setNewGarantie] = useState({
    projectId: "",
    klantId: "",
    startDatum: new Date().toISOString().split("T")[0],
    garantiePeriodeInMaanden: 12,
    voorwaarden: "",
    notities: "",
  });

  // Get projects for creating a garantie
  const projecten = useQuery(api.projecten.list, user?._id ? {} : "skip");
  const klanten = useQuery(api.klanten.list, user?._id ? {} : "skip");

  // Filter and search
  const filteredGaranties = useMemo(() => {
    if (!garanties) return [];
    let result = [...garanties];

    if (statusFilter !== "alle") {
      result = result.filter((g) => g.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.klantNaam.toLowerCase().includes(q) ||
          g.projectNaam.toLowerCase().includes(q)
      );
    }

    return result;
  }, [garanties, statusFilter, searchQuery]);

  const handleCreateGarantie = async () => {
    if (!newGarantie.projectId || !newGarantie.klantId) {
      toast.error("Selecteer een project en klant");
      return;
    }

    try {
      await createGarantie({
        projectId: newGarantie.projectId as Id<"projecten">,
        klantId: newGarantie.klantId as Id<"klanten">,
        startDatum: newGarantie.startDatum,
        garantiePeriodeInMaanden: newGarantie.garantiePeriodeInMaanden,
        voorwaarden: newGarantie.voorwaarden || undefined,
        notities: newGarantie.notities || undefined,
      });
      toast.success("Garantie aangemaakt");
      setShowCreateDialog(false);
      setNewGarantie({
        projectId: "",
        klantId: "",
        startDatum: new Date().toISOString().split("T")[0],
        garantiePeriodeInMaanden: 12,
        voorwaarden: "",
        notities: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fout bij aanmaken garantie"
      );
    }
  };

  const isLoading = isUserLoading || garanties === undefined;

  if (isLoading) {
    return null; // loading.tsx handles this
  }

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Title + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Garanties
            </h1>
            <p className="text-muted-foreground">
              Beheer garanties en houd verloopdata bij
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe garantie
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nieuwe garantie</DialogTitle>
                <DialogDescription>
                  Maak een garantie aan voor een opgeleverd project.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project">Project</Label>
                  <Select
                    value={newGarantie.projectId}
                    onValueChange={(val) => {
                      setNewGarantie((prev) => ({ ...prev, projectId: val }));
                      // Auto-fill klant from project
                      const project = projecten?.find(
                        (p: any) => p._id === val
                      );
                      if (project) {
                        // Find klant via offerte
                        const klant = klanten?.find(
                          (k: any) => k.naam === (project as any).klantNaam
                        );
                        if (klant) {
                          setNewGarantie((prev) => ({
                            ...prev,
                            projectId: val,
                            klantId: klant._id,
                          }));
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projecten
                        ?.filter(
                          (p: any) =>
                            p.status === "afgerond" ||
                            p.status === "nacalculatie_compleet" ||
                            p.status === "gefactureerd"
                        )
                        .map((p: any) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.naam}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="klant">Klant</Label>
                  <Select
                    value={newGarantie.klantId}
                    onValueChange={(val) =>
                      setNewGarantie((prev) => ({ ...prev, klantId: val }))
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDatum">Startdatum</Label>
                    <Input
                      id="startDatum"
                      type="date"
                      value={newGarantie.startDatum}
                      onChange={(e) =>
                        setNewGarantie((prev) => ({
                          ...prev,
                          startDatum: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="periode">Periode (maanden)</Label>
                    <Input
                      id="periode"
                      type="number"
                      min={1}
                      max={120}
                      value={newGarantie.garantiePeriodeInMaanden}
                      onChange={(e) =>
                        setNewGarantie((prev) => ({
                          ...prev,
                          garantiePeriodeInMaanden: parseInt(e.target.value) || 12,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="voorwaarden">Voorwaarden (optioneel)</Label>
                  <Textarea
                    id="voorwaarden"
                    placeholder="Specifieke garantievoorwaarden..."
                    value={newGarantie.voorwaarden}
                    onChange={(e) =>
                      setNewGarantie((prev) => ({
                        ...prev,
                        voorwaarden: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notities">Notities (optioneel)</Label>
                  <Textarea
                    id="notities"
                    placeholder="Eventuele opmerkingen..."
                    value={newGarantie.notities}
                    onChange={(e) =>
                      setNewGarantie((prev) => ({
                        ...prev,
                        notities: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Annuleren
                </Button>
                <Button onClick={handleCreateGarantie}>Aanmaken</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Actieve garanties
                </CardTitle>
                <ShieldCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.actief}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Verloopt binnen 30d
                </CardTitle>
                <ShieldAlert className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.verlopendBinnen30d}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Verlopen
                </CardTitle>
                <Shield className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.verlopen}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Open meldingen
                </CardTitle>
                <Wrench className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.openMeldingen}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op klant of project..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="alle">Alle</TabsTrigger>
              <TabsTrigger value="actief">Actief</TabsTrigger>
              <TabsTrigger value="verlopen">Verlopen</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table */}
        {filteredGaranties.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Geen garanties gevonden</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery || statusFilter !== "alle"
                  ? "Pas de filters aan of maak een nieuwe garantie aan"
                  : "Maak een garantie aan voor een opgeleverd project"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Klant</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Einde</TableHead>
                    <TableHead>Resterend</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGaranties.map((g) => (
                    <TableRow
                      key={g._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/garanties/${g._id}`)}
                    >
                      <TableCell className="font-medium">
                        {g.projectNaam}
                      </TableCell>
                      <TableCell>{g.klantNaam}</TableCell>
                      <TableCell>{formatDate(g.startDatum)}</TableCell>
                      <TableCell>{formatDate(g.eindDatum)}</TableCell>
                      <TableCell>
                        {g.status === "verlopen" ? (
                          <span className="text-red-600">Verlopen</span>
                        ) : (
                          <span>
                            {daysUntil(g.eindDatum) > 0
                              ? `${daysUntil(g.eindDatum)} dagen`
                              : "Vandaag"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <GarantieStatusBadge
                          status={g.status}
                          eindDatum={g.eindDatum}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          </Card>
        )}
      </div>
    </>
  );
}
