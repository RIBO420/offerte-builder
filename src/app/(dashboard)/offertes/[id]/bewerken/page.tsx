"use client";

import { use, useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Save,
  Shovel,
  Trees,
  RefreshCw,
} from "lucide-react";
import { useOfferte, useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { useOfferteEditorShortcuts } from "@/hooks/use-offerte-shortcuts";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getModifierKey } from "@/hooks/use-keyboard-shortcuts";
import { SortableRegelsTable } from "@/components/offerte/sortable-regels-table";
import { createBackgroundErrorHandler } from "@/lib/error-handling";

import {
  PageHeader,
  AddRegelDialog,
  EditRegelDialog,
  CustomerResponseCard,
  TotalsCard,
  WerkzaamhedenCard,
  ChatCard,
  RecalculateDialog,
  scopeLabels,
  formatCurrency,
  calculateTotals,
} from "./components";
import type { Regel } from "./components";

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

  // Mark messages as read
  useEffect(() => {
    if (messages && messages.length > 0 && id) {
      markAsRead({ offerteId: id as Id<"offertes"> }).catch(
        createBackgroundErrorHandler("markAsRead", { offerteId: id, context: "editPage" })
      );
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

  const handleAddRegel = (regel: Regel) => {
    setRegels([...regels, regel]);
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
        <PageHeader />
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
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-muted-foreground">Offerte niet gevonden</p>
          <Button asChild>
            <Link href="/offertes">Terug naar Offertes</Link>
          </Button>
        </div>
      </>
    );
  }

  const totals = calculateTotals(regels, instellingen ?? undefined);
  const availableScopes = offerte.scopes || ["overig"];

  return (
    <>
      <PageHeader offerteId={id} offerteNummer={offerte.offerteNummer} />

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar offerte">
              <Link href={`/offertes/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  offerte.type === "aanleg" ? "bg-primary/10" : "bg-green-100 dark:bg-green-900/30"
                }`}
              >
                {offerte.type === "aanleg" ? (
                  <Shovel className="h-5 w-5 text-primary" />
                ) : (
                  <Trees className="h-5 w-5 text-green-600 dark:text-green-400" />
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
                  <AddRegelDialog
                    open={showAddDialog}
                    onOpenChange={setShowAddDialog}
                    availableScopes={availableScopes}
                    onAdd={handleAddRegel}
                    modKey={modKey}
                  />

                  <EditRegelDialog
                    open={showEditDialog}
                    onOpenChange={setShowEditDialog}
                    editingRegel={editingRegel}
                    onEditingRegelChange={setEditingRegel}
                    availableScopes={availableScopes}
                    onUpdate={handleUpdateRegel}
                    standaardMargePercentage={instellingen?.standaardMargePercentage}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <SortableRegelsTable
                  regels={regels}
                  onReorder={setRegels}
                  onEdit={handleEditRegel}
                  onDelete={handleDeleteRegel}
                  scopeLabels={scopeLabels}
                  formatCurrency={formatCurrency}
                />
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
            {offerte.customerResponse && (
              <CustomerResponseCard customerResponse={offerte.customerResponse} />
            )}

            <TotalsCard
              totals={totals}
              btwPercentage={instellingen?.btwPercentage}
            />

            <WerkzaamhedenCard scopes={offerte.scopes || []} />

            <ChatCard
              messages={messages as Array<{ _id: string; sender: "klant" | "business"; message: string; isRead: boolean; createdAt: number }> | undefined}
              chatMessage={chatMessage}
              onChatMessageChange={setChatMessage}
              onSendMessage={handleSendMessage}
              isSendingMessage={isSendingMessage}
            />
          </div>
        </div>
      </div>

      <RecalculateDialog
        open={showRecalculateDialog}
        onOpenChange={setShowRecalculateDialog}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />
    </>
  );
}
