"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  Trash2,
  Pencil,
  Shovel,
  Trees,
} from "lucide-react";
import { useOfferte, useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
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

  const [regels, setRegels] = useState<Regel[]>([]);
  const [notities, setNotities] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRegel, setEditingRegel] = useState<Regel | null>(null);
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
    } catch (error) {
      toast.error("Fout bij opslaan");
      console.error(error);
    } finally {
      setIsSaving(false);
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

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
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

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Opslaan
          </Button>
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
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Regel toevoegen
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
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-sm text-muted-foreground">
                              Totaal:{" "}
                              <span className="font-semibold text-foreground">
                                {formatCurrency(
                                  editingRegel.hoeveelheid * editingRegel.prijsPerEenheid
                                )}
                              </span>
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
                              <p className="text-sm text-muted-foreground capitalize">
                                {regel.type}
                              </p>
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

          {/* Right column - Totals */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Totalen (preview)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materiaalkosten</span>
                  <span>{formatCurrency(totals.materiaalkosten)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbeidskosten</span>
                  <span>{formatCurrency(totals.arbeidskosten)}</span>
                </div>
                <div className="flex justify-between text-sm">
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
                <div className="flex justify-between text-lg font-bold">
                  <span>Totaal incl. BTW</span>
                  <span>{formatCurrency(totals.totaalInclBtw)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Werkzaamheden</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(offerte.scopes || []).map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {scopeLabels[scope] || scope}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
