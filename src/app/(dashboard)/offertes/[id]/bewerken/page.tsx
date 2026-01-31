"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Save,
  Plus,
  Trash2,
  Pencil,
  Shovel,
  Trees,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
  Send,
  Eye,
  PenTool,
} from "lucide-react";
import { useOfferte, useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { useOfferteEditorShortcuts } from "@/hooks/use-offerte-shortcuts";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getModifierKey } from "@/hooks/use-keyboard-shortcuts";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return formatTime(timestamp);
  }
  return `${date.getDate()}/${date.getMonth() + 1} ${formatTime(timestamp)}`;
}

interface Regel {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
  margePercentage?: number;
}

const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  houtwerk: "Houtwerk",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  gras: "Gras",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

export default function OfferteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { offerte, isLoading } = useOfferte(id as Id<"offertes">);
  const { update, updateRegels } = useOffertes();
  const { instellingen } = useInstellingen();
  const { calculate } = useOfferteCalculation();

  // Messages queries and mutations
  const messages = useQuery(
    api.offerteMessages.listByOfferte,
    id ? { offerteId: id as Id<"offertes"> } : "skip"
  );
  const sendMessage = useMutation(api.offerteMessages.sendFromBusiness);
  const markAsRead = useMutation(api.offerteMessages.markAsRead);

  const [regels, setRegels] = useState<Regel[]>([]);
  const [notities, setNotities] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showRecalculateDialog, setShowRecalculateDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRegel, setEditingRegel] = useState<Regel | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newRegel, setNewRegel] = useState<Partial<Regel>>({
    scope: "overig",
    omschrijving: "",
    eenheid: "stuk",
    hoeveelheid: 1,
    prijsPerEenheid: 0,
    type: "materiaal",
  });

  useEffect(() => {
    if (offerte) {
      setRegels(offerte.regels || []);
      setNotities(offerte.notities || "");
    }
  }, [offerte]);

  // Keyboard shortcuts for offerte editor
  useOfferteEditorShortcuts({
    onSave: () => {
      if (!isSaving && offerte) {
        handleSave();
      }
    },
    onAddRegel: () => {
      if (!showAddDialog) {
        setShowAddDialog(true);
      }
    },
    onRecalculate: () => {
      if (!isRecalculating && offerte?.scopeData) {
        setShowRecalculateDialog(true);
      }
    },
    onCancel: () => {
      if (showAddDialog) {
        setShowAddDialog(false);
      } else if (showEditDialog) {
        setShowEditDialog(false);
        setEditingRegel(null);
      } else if (showRecalculateDialog) {
        setShowRecalculateDialog(false);
      }
    },
  });

  const modKey = getModifierKey();

  // Scroll to bottom of messages and mark as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages && messages.length > 0 && id) {
      markAsRead({ offerteId: id as Id<"offertes"> }).catch(() => {
        // Silent fail for marking messages as read
      });
    }
  }, [messages, id, markAsRead]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !id) return;
    setIsSendingMessage(true);
    try {
      await sendMessage({
        offerteId: id as Id<"offertes">,
        message: chatMessage.trim(),
      });
      setChatMessage("");
    } catch {
      toast.error("Fout bij verzenden bericht");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const calculateTotals = (regelsList: Regel[]) => {
    let materiaalkosten = 0;
    let arbeidskosten = 0;
    let totaalUren = 0;

    for (const regel of regelsList) {
      if (regel.type === "materiaal") {
        materiaalkosten += regel.totaal;
      } else if (regel.type === "arbeid") {
        arbeidskosten += regel.totaal;
        totaalUren += regel.hoeveelheid;
      } else if (regel.type === "machine") {
        arbeidskosten += regel.totaal;
      }
    }

    const subtotaal = materiaalkosten + arbeidskosten;
    const margePercentage = instellingen?.standaardMargePercentage || 15;
    const marge = subtotaal * (margePercentage / 100);
    const totaalExBtw = subtotaal + marge;
    const btwPercentage = instellingen?.btwPercentage || 21;
    const btw = totaalExBtw * (btwPercentage / 100);
    const totaalInclBtw = totaalExBtw + btw;

    return {
      materiaalkosten,
      arbeidskosten,
      totaalUren,
      subtotaal,
      marge,
      margePercentage,
      totaalExBtw,
      btw,
      totaalInclBtw,
    };
  };

  const handleAddRegel = () => {
    if (!newRegel.omschrijving) {
      toast.error("Vul een omschrijving in");
      return;
    }

    const totaal = (newRegel.hoeveelheid || 0) * (newRegel.prijsPerEenheid || 0);
    const regel: Regel = {
      id: crypto.randomUUID(),
      scope: newRegel.scope || "overig",
      omschrijving: newRegel.omschrijving,
      eenheid: newRegel.eenheid || "stuk",
      hoeveelheid: newRegel.hoeveelheid || 1,
      prijsPerEenheid: newRegel.prijsPerEenheid || 0,
      totaal,
      type: newRegel.type || "materiaal",
    };

    setRegels([...regels, regel]);
    setNewRegel({
      scope: "overig",
      omschrijving: "",
      eenheid: "stuk",
      hoeveelheid: 1,
      prijsPerEenheid: 0,
      type: "materiaal",
    });
    setShowAddDialog(false);
    toast.success("Regel toegevoegd");
  };

  const handleDeleteRegel = (regelId: string) => {
    setRegels(regels.filter((r) => r.id !== regelId));
    toast.success("Regel verwijderd");
  };

  const handleEditRegel = (regel: Regel) => {
    setEditingRegel({ ...regel });
    setShowEditDialog(true);
  };

  const handleUpdateRegel = () => {
    if (!editingRegel || !editingRegel.omschrijving) {
      toast.error("Vul een omschrijving in");
      return;
    }

    const updatedRegel = {
      ...editingRegel,
      totaal: editingRegel.hoeveelheid * editingRegel.prijsPerEenheid,
    };

    setRegels(regels.map((r) => (r.id === updatedRegel.id ? updatedRegel : r)));
    setShowEditDialog(false);
    setEditingRegel(null);
    toast.success("Regel bijgewerkt");
  };

  const handleSave = async () => {
    if (!offerte) return;

    setIsSaving(true);
    try {
      // Update regels and totals
      await updateRegels({
        id: offerte._id,
        regels,
        margePercentage: instellingen?.standaardMargePercentage || 15,
        scopeMarges: instellingen?.scopeMarges,
        btwPercentage: instellingen?.btwPercentage || 21,
        uurtarief: instellingen?.uurtarief || 45,
      });

      // Update notities if changed
      if (notities !== offerte.notities) {
        await update({
          id: offerte._id,
          notities,
        });
      }

      toast.success("Offerte opgeslagen");
      router.push(`/offertes/${id}`);
    } catch {
      toast.error("Fout bij opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculate = () => {
    if (!offerte || !offerte.scopeData) {
      toast.error("Geen scope data beschikbaar voor herberekening");
      return;
    }

    setIsRecalculating(true);
    try {
      const calculationResult = calculate({
        type: offerte.type,
        scopes: offerte.scopes || [],
        scopeData: offerte.scopeData,
        bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
        achterstalligheid: offerte.algemeenParams.achterstalligheid,
      });

      if (calculationResult && calculationResult.regels.length > 0) {
        setRegels(calculationResult.regels);
        toast.success(
          `${calculationResult.regels.length} regels herberekend vanuit scope data`
        );
      } else {
        toast.error("Geen regels gegenereerd uit scope data");
      }
    } catch {
      toast.error("Fout bij herberekenen");
    } finally {
      setIsRecalculating(false);
      setShowRecalculateDialog(false);
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
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Offerte laden...</p>
        </div>
      </>
    );
  }

  if (!offerte) {
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
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-muted-foreground">Offerte niet gevonden</p>
          <Button asChild>
            <Link href="/offertes">Terug naar Offertes</Link>
          </Button>
        </div>
      </>
    );
  }

  const totals = calculateTotals(regels);
  const availableScopes = offerte.scopes || ["overig"];

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
              <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/offertes/${id}`}>
                {offerte.offerteNummer}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Bewerken</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/offertes/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  offerte.type === "aanleg" ? "bg-primary/10" : "bg-green-100"
                }`}
              >
                {offerte.type === "aanleg" ? (
                  <Shovel className="h-5 w-5 text-primary" />
                ) : (
                  <Trees className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {offerte.offerteNummer} bewerken
                </h1>
                <p className="text-muted-foreground">
                  {offerte.klant.naam} • {offerte.klant.plaats}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRecalculateDialog(true)}
              disabled={isRecalculating || !offerte.scopeData}
              title={`Herbereken (${modKey}+Shift+R)`}
            >
              {isRecalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Herbereken
            </Button>
            <Button onClick={handleSave} disabled={isSaving} title={`Opslaan (${modKey}+S)`}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Opslaan
              <kbd className="ml-2 px-1.5 py-0.5 bg-primary-foreground/20 rounded text-[10px] hidden sm:inline">
                {modKey}S
              </kbd>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column - Regels */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Offerteregels</CardTitle>
                    <CardDescription>
                      Voeg regels toe voor materiaal, arbeid of machines
                    </CardDescription>
                  </div>
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button title={`Regel toevoegen (${modKey}+N)`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Regel toevoegen
                        <kbd className="ml-2 px-1.5 py-0.5 bg-primary-foreground/20 rounded text-[10px] hidden sm:inline">
                          {modKey}N
                        </kbd>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Nieuwe regel</DialogTitle>
                        <DialogDescription>
                          Voeg een nieuwe regel toe aan de offerte
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <Select
                            value={newRegel.type}
                            onValueChange={(value) =>
                              setNewRegel({ ...newRegel, type: value as Regel["type"] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="materiaal">Materiaal</SelectItem>
                              <SelectItem value="arbeid">Arbeid</SelectItem>
                              <SelectItem value="machine">Machine</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Scope</Label>
                          <Select
                            value={newRegel.scope}
                            onValueChange={(value) =>
                              setNewRegel({ ...newRegel, scope: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableScopes.map((scope) => (
                                <SelectItem key={scope} value={scope}>
                                  {scopeLabels[scope] || scope}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Omschrijving</Label>
                          <Input
                            value={newRegel.omschrijving}
                            onChange={(e) =>
                              setNewRegel({ ...newRegel, omschrijving: e.target.value })
                            }
                            placeholder="Bijv. Bestratingswerk - stenen"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Hoeveelheid</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={newRegel.hoeveelheid}
                              onChange={(e) =>
                                setNewRegel({
                                  ...newRegel,
                                  hoeveelheid: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Eenheid</Label>
                            <Select
                              value={newRegel.eenheid}
                              onValueChange={(value) =>
                                setNewRegel({ ...newRegel, eenheid: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="stuk">stuk</SelectItem>
                                <SelectItem value="m²">m²</SelectItem>
                                <SelectItem value="m³">m³</SelectItem>
                                <SelectItem value="m¹">m¹</SelectItem>
                                <SelectItem value="uur">uur</SelectItem>
                                <SelectItem value="dag">dag</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Prijs per eenheid</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newRegel.prijsPerEenheid}
                            onChange={(e) =>
                              setNewRegel({
                                ...newRegel,
                                prijsPerEenheid: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm text-muted-foreground">
                            Totaal:{" "}
                            <span className="font-semibold text-foreground">
                              {formatCurrency(
                                (newRegel.hoeveelheid || 0) *
                                  (newRegel.prijsPerEenheid || 0)
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddDialog(false)}
                        >
                          Annuleren
                        </Button>
                        <Button onClick={handleAddRegel}>Toevoegen</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Dialog */}
                  <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Regel bewerken</DialogTitle>
                        <DialogDescription>
                          Pas de gegevens van deze regel aan
                        </DialogDescription>
                      </DialogHeader>
                      {editingRegel && (
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>Type</Label>
                            <Select
                              value={editingRegel.type}
                              onValueChange={(value) =>
                                setEditingRegel({ ...editingRegel, type: value as Regel["type"] })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="materiaal">Materiaal</SelectItem>
                                <SelectItem value="arbeid">Arbeid</SelectItem>
                                <SelectItem value="machine">Machine</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Scope</Label>
                            <Select
                              value={editingRegel.scope}
                              onValueChange={(value) =>
                                setEditingRegel({ ...editingRegel, scope: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableScopes.map((scope) => (
                                  <SelectItem key={scope} value={scope}>
                                    {scopeLabels[scope] || scope}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Omschrijving</Label>
                            <Input
                              value={editingRegel.omschrijving}
                              onChange={(e) =>
                                setEditingRegel({ ...editingRegel, omschrijving: e.target.value })
                              }
                              placeholder="Bijv. Bestratingswerk - stenen"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label>Hoeveelheid</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={editingRegel.hoeveelheid}
                                onChange={(e) =>
                                  setEditingRegel({
                                    ...editingRegel,
                                    hoeveelheid: parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Eenheid</Label>
                              <Select
                                value={editingRegel.eenheid}
                                onValueChange={(value) =>
                                  setEditingRegel({ ...editingRegel, eenheid: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="stuk">stuk</SelectItem>
                                  <SelectItem value="m²">m²</SelectItem>
                                  <SelectItem value="m³">m³</SelectItem>
                                  <SelectItem value="m¹">m¹</SelectItem>
                                  <SelectItem value="uur">uur</SelectItem>
                                  <SelectItem value="dag">dag</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label>Prijs per eenheid</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingRegel.prijsPerEenheid}
                              onChange={(e) =>
                                setEditingRegel({
                                  ...editingRegel,
                                  prijsPerEenheid: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>
                              Marge % (optioneel)
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                Laat leeg voor scope/standaard marge
                              </span>
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                className="pr-7"
                                placeholder={String(instellingen?.standaardMargePercentage || 15)}
                                value={editingRegel.margePercentage ?? ""}
                                onChange={(e) =>
                                  setEditingRegel({
                                    ...editingRegel,
                                    margePercentage: e.target.value ? parseInt(e.target.value) : undefined,
                                  })
                                }
                              />
                              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
                            </div>
                          </div>
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-sm text-muted-foreground">
                              Totaal:{" "}
                              <span className="font-semibold text-foreground">
                                {formatCurrency(
                                  editingRegel.hoeveelheid * editingRegel.prijsPerEenheid
                                )}
                              </span>
                              {editingRegel.margePercentage !== undefined && (
                                <span className="ml-2 text-xs">
                                  (+{editingRegel.margePercentage}% marge)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowEditDialog(false);
                            setEditingRegel(null);
                          }}
                        >
                          Annuleren
                        </Button>
                        <Button onClick={handleUpdateRegel}>Opslaan</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {regels.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Omschrijving</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Hoeveelheid</TableHead>
                        <TableHead className="text-right">Prijs</TableHead>
                        <TableHead className="text-right">Totaal</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regels.map((regel) => (
                        <TableRow key={regel.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{regel.omschrijving}</p>
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <span className="capitalize">{regel.type}</span>
                                {regel.margePercentage !== undefined && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                    {regel.margePercentage}% marge
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {scopeLabels[regel.scope] || regel.scope}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {regel.hoeveelheid} {regel.eenheid}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(regel.prijsPerEenheid)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(regel.totaal)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditRegel(regel)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRegel(regel.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-muted-foreground">
                      Nog geen regels. Klik op &quot;Regel toevoegen&quot; om te
                      beginnen.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notities */}
            <Card>
              <CardHeader>
                <CardTitle>Notities</CardTitle>
                <CardDescription>
                  Interne notities (niet zichtbaar op PDF)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notities}
                  onChange={(e) => setNotities(e.target.value)}
                  placeholder="Voeg hier interne notities toe..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column - Totals, Customer Response & Chat */}
          <div className="space-y-4">
            {/* Customer Response Status */}
            {offerte.customerResponse && (
              <Card className={cn(
                "border-2",
                offerte.customerResponse.status === "geaccepteerd" && "border-green-500 bg-green-50 dark:bg-green-950/30",
                offerte.customerResponse.status === "afgewezen" && "border-red-500 bg-red-50 dark:bg-red-950/30",
                offerte.customerResponse.status === "bekeken" && "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
              )}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {offerte.customerResponse.status === "geaccepteerd" && (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-700">Geaccepteerd</span>
                      </>
                    )}
                    {offerte.customerResponse.status === "afgewezen" && (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-700">Afgewezen</span>
                      </>
                    )}
                    {offerte.customerResponse.status === "bekeken" && (
                      <>
                        <Eye className="h-5 w-5 text-blue-600" />
                        <span className="text-blue-700">Bekeken</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {offerte.customerResponse.viewedAt && (
                    <p className="text-xs text-muted-foreground">
                      Bekeken op {formatDate(offerte.customerResponse.viewedAt)}
                    </p>
                  )}
                  {offerte.customerResponse.signedAt && (
                    <p className="text-xs text-muted-foreground">
                      Ondertekend op {formatDate(offerte.customerResponse.signedAt)}
                    </p>
                  )}
                  {offerte.customerResponse.comment && (
                    <div className="rounded bg-white/50 dark:bg-black/20 p-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Opmerking klant:</p>
                      <p className="text-sm">{offerte.customerResponse.comment}</p>
                    </div>
                  )}
                  {offerte.customerResponse.signature && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <PenTool className="h-3 w-3" />
                        Handtekening
                      </p>
                      <div className="flex items-center justify-center max-h-20 overflow-hidden">
                        {/* Using img for base64 data URLs (signatures) - not suitable for next/image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={offerte.customerResponse.signature}
                          alt="Handtekening klant"
                          className="max-w-full max-h-20 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Totals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Totalen (preview)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materiaalkosten</span>
                  <span>{formatCurrency(totals.materiaalkosten)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbeidskosten</span>
                  <span>{formatCurrency(totals.arbeidskosten)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    ({totals.totaalUren} uur)
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(totals.subtotaal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Marge ({totals.margePercentage}%)
                  </span>
                  <span>{formatCurrency(totals.marge)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Totaal excl. BTW</span>
                  <span>{formatCurrency(totals.totaalExBtw)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    BTW ({instellingen?.btwPercentage || 21}%)
                  </span>
                  <span>{formatCurrency(totals.btw)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Totaal incl. BTW</span>
                  <span>{formatCurrency(totals.totaalInclBtw)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Werkzaamheden */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Werkzaamheden</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(offerte.scopes || []).map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs">
                      {scopeLabels[scope] || scope}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  Berichten
                  {messages && messages.filter(m => m.sender === "klant" && !m.isRead).length > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5">
                      {messages.filter(m => m.sender === "klant" && !m.isRead).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScrollArea className="h-48 rounded-md border p-2">
                  {messages && messages.length > 0 ? (
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div
                          key={msg._id}
                          className={cn(
                            "flex",
                            msg.sender === "klant" ? "justify-start" : "justify-end"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-lg px-3 py-1.5 text-xs",
                              msg.sender === "klant"
                                ? "bg-muted"
                                : "bg-primary text-primary-foreground"
                            )}
                          >
                            <p>{msg.message}</p>
                            <p
                              className={cn(
                                "text-[10px] mt-0.5",
                                msg.sender === "klant"
                                  ? "text-muted-foreground"
                                  : "text-primary-foreground/70"
                              )}
                            >
                              {formatDateTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="h-6 w-6 mb-1 opacity-50" />
                      <p className="text-xs">Nog geen berichten</p>
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    placeholder="Typ een bericht..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isSendingMessage}
                    className="text-sm h-8"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim() || isSendingMessage}
                    className="h-8 px-3"
                  >
                    {isSendingMessage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Recalculate Confirmation Dialog */}
      <AlertDialog
        open={showRecalculateDialog}
        onOpenChange={setShowRecalculateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regels herberekenen
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Dit zal alle huidige regels vervangen door nieuwe regels
                berekend vanuit de originele scope data.
              </p>
              <p className="font-medium text-destructive">
                Handmatige wijzigingen gaan verloren!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRecalculate}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isRecalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Herbereken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
