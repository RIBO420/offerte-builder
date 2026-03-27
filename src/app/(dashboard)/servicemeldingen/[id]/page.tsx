"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Shield,
  User,
  FolderKanban,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../../convex/_generated/dataModel";

const prioriteitConfig: Record<string, { label: string; color: string }> = {
  laag: { label: "Laag", color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  normaal: { label: "Normaal", color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  hoog: { label: "Hoog", color: "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  urgent: { label: "Urgent", color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Wrench }> = {
  nieuw: { label: "Nieuw", color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock },
  in_behandeling: { label: "In behandeling", color: "bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Wrench },
  ingepland: { label: "Ingepland", color: "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Calendar },
  afgehandeld: { label: "Afgehandeld", color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
};

const afspraakStatusConfig: Record<string, { label: string; color: string }> = {
  gepland: { label: "Gepland", color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  uitgevoerd: { label: "Uitgevoerd", color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200" },
  geannuleerd: { label: "Geannuleerd", color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

type MeldingStatus = "nieuw" | "in_behandeling" | "ingepland" | "afgehandeld";

const statusFlow: MeldingStatus[] = ["nieuw", "in_behandeling", "ingepland", "afgehandeld"];

export default function MeldingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const [showAfspraakDialog, setShowAfspraakDialog] = useState(false);
  const [showKostenDialog, setShowKostenDialog] = useState(false);

  // Data
  const melding = useQuery(
    api.servicemeldingen.getById,
    user?._id ? { id: id as Id<"servicemeldingen"> } : "skip"
  );
  const medewerkers = useQuery(api.medewerkers.list, user?._id ? {} : "skip");

  // Mutations
  const updateStatus = useMutation(api.servicemeldingen.updateStatus);
  const updateMelding = useMutation(api.servicemeldingen.update);
  const addAfspraak = useMutation(api.servicemeldingen.addAfspraak);
  const updateAfspraak = useMutation(api.servicemeldingen.updateAfspraak);

  // New afspraak form state
  const [newAfspraak, setNewAfspraak] = useState({
    datum: new Date().toISOString().split("T")[0],
    medewerkerIds: [] as string[],
    notities: "",
  });

  // Kosten form state
  const [kostenValue, setKostenValue] = useState<string>("0");

  const handleStatusChange = async (newStatus: MeldingStatus) => {
    try {
      await updateStatus({
        id: id as Id<"servicemeldingen">,
        status: newStatus,
      });
      toast.success(`Status bijgewerkt naar ${statusConfig[newStatus]?.label}`);
    } catch (error) {
      toast.error("Fout bij bijwerken status");
    }
  };

  const handleAddAfspraak = async () => {
    if (!newAfspraak.datum || newAfspraak.medewerkerIds.length === 0) {
      toast.error("Selecteer een datum en minimaal 1 medewerker");
      return;
    }

    try {
      await addAfspraak({
        meldingId: id as Id<"servicemeldingen">,
        datum: newAfspraak.datum,
        medewerkerIds: newAfspraak.medewerkerIds as Id<"medewerkers">[],
        notities: newAfspraak.notities || undefined,
      });
      toast.success("Afspraak ingepland");
      setShowAfspraakDialog(false);
      setNewAfspraak({
        datum: new Date().toISOString().split("T")[0],
        medewerkerIds: [],
        notities: "",
      });
    } catch (error) {
      toast.error("Fout bij inplannen afspraak");
    }
  };

  const handleAfspraakComplete = async (afspraakId: string) => {
    try {
      await updateAfspraak({
        afspraakId: afspraakId as Id<"serviceAfspraken">,
        status: "uitgevoerd",
      });
      toast.success("Afspraak als uitgevoerd gemarkeerd");
    } catch (error) {
      toast.error("Fout bij bijwerken afspraak");
    }
  };

  const handleSaveKosten = async () => {
    try {
      await updateMelding({
        id: id as Id<"servicemeldingen">,
        kosten: parseFloat(kostenValue) || 0,
      });
      toast.success("Kosten bijgewerkt");
      setShowKostenDialog(false);
    } catch (error) {
      toast.error("Fout bij bijwerken kosten");
    }
  };

  if (isUserLoading || melding === undefined) {
    return null;
  }

  if (!melding) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <Wrench className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Melding niet gevonden</h2>
          <Button
            variant="outline"
            onClick={() => router.push("/servicemeldingen")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar overzicht
          </Button>
        </div>
      </>
    );
  }

  const currentStatusIndex = statusFlow.indexOf(melding.status as MeldingStatus);

  return (
    <>
      <PageHeader
        customLabels={{
          [`/servicemeldingen/${id}`]: `Melding`,
        }}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/servicemeldingen")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Servicemelding
                </h1>
                <Badge
                  variant="outline"
                  className={statusConfig[melding.status]?.color ?? ""}
                >
                  {statusConfig[melding.status]?.label ?? melding.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={prioriteitConfig[melding.prioriteit]?.color ?? ""}
                >
                  {prioriteitConfig[melding.prioriteit]?.label ?? melding.prioriteit}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {melding.klantNaam}
                {melding.projectNaam && ` — ${melding.projectNaam}`}
              </p>
            </div>
          </div>
        </div>

        {/* Status workflow */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              {statusFlow.map((status, index) => {
                const config = statusConfig[status];
                const isActive = index <= currentStatusIndex;
                const isCurrent = status === melding.status;
                const Icon = config.icon;

                return (
                  <div key={status} className="flex items-center flex-1">
                    <button
                      onClick={() => handleStatusChange(status)}
                      className={`flex flex-col items-center gap-1 flex-1 p-2 rounded-lg transition-colors ${
                        isCurrent
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={`text-xs ${
                          isCurrent ? "font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {config.label}
                      </span>
                    </button>
                    {index < statusFlow.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 mx-1 ${
                          index < currentStatusIndex
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column — 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Beschrijving */}
            <Card>
              <CardHeader>
                <CardTitle>Beschrijving</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {melding.beschrijving}
                </p>
              </CardContent>
            </Card>

            {/* Afspraken */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Serviceafspraken
                  </CardTitle>
                  <CardDescription>
                    {melding.afspraken.length} afspra(a)k(en)
                  </CardDescription>
                </div>
                <Dialog
                  open={showAfspraakDialog}
                  onOpenChange={setShowAfspraakDialog}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-1 h-3 w-3" />
                      Inplannen
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Afspraak inplannen</DialogTitle>
                      <DialogDescription>
                        Plan een servicebezoek in voor deze melding.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Datum</Label>
                        <Input
                          type="date"
                          value={newAfspraak.datum}
                          onChange={(e) =>
                            setNewAfspraak((prev) => ({
                              ...prev,
                              datum: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Medewerkers</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                          {medewerkers
                            ?.filter((m: any) => m.isActief !== false)
                            .map((m: any) => (
                              <label
                                key={m._id}
                                className="flex items-center gap-2 text-sm cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={newAfspraak.medewerkerIds.includes(
                                    m._id
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewAfspraak((prev) => ({
                                        ...prev,
                                        medewerkerIds: [
                                          ...prev.medewerkerIds,
                                          m._id,
                                        ],
                                      }));
                                    } else {
                                      setNewAfspraak((prev) => ({
                                        ...prev,
                                        medewerkerIds:
                                          prev.medewerkerIds.filter(
                                            (id) => id !== m._id
                                          ),
                                      }));
                                    }
                                  }}
                                  className="rounded border-muted-foreground"
                                />
                                {m.naam}
                              </label>
                            ))}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Notities (optioneel)</Label>
                        <Textarea
                          placeholder="Instructies voor het team..."
                          value={newAfspraak.notities}
                          onChange={(e) =>
                            setNewAfspraak((prev) => ({
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
                        onClick={() => setShowAfspraakDialog(false)}
                      >
                        Annuleren
                      </Button>
                      <Button onClick={handleAddAfspraak}>Inplannen</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {melding.afspraken.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mb-2" />
                    <p className="text-sm">Nog geen afspraken ingepland</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {melding.afspraken.map((afspraak: any) => (
                      <div
                        key={afspraak._id}
                        className="flex items-start gap-4 p-4 rounded-lg border"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            afspraak.status === "uitgevoerd"
                              ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                              : afspraak.status === "geannuleerd"
                              ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                              : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                          }`}
                        >
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {new Date(afspraak.datum).toLocaleDateString(
                                "nl-NL",
                                {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                afspraakStatusConfig[afspraak.status]?.color ??
                                ""
                              }
                            >
                              {afspraakStatusConfig[afspraak.status]?.label ??
                                afspraak.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Medewerkers:{" "}
                            {afspraak.medewerkerNamen?.join(", ") ?? "Geen"}
                          </p>
                          {afspraak.notities && (
                            <p className="text-sm text-muted-foreground">
                              {afspraak.notities}
                            </p>
                          )}
                        </div>
                        {afspraak.status === "gepland" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleAfspraakComplete(afspraak._id)
                            }
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Uitgevoerd
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — 1/3 */}
          <div className="space-y-6">
            {/* Garantie indicator */}
            <Card
              className={`border-2 ${
                melding.isGarantie
                  ? "border-green-200 dark:border-green-800"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <CardContent className="pt-6 text-center">
                {melding.isGarantie ? (
                  <>
                    <Shield className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-lg font-bold text-green-600">
                      Garantie
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Kosteloos — valt onder garantie
                    </p>
                    {melding.garantieEindDatum && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Garantie tot{" "}
                        {new Date(melding.garantieEindDatum).toLocaleDateString(
                          "nl-NL"
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-lg font-bold">Betaald</p>
                    <p className="text-sm text-muted-foreground">
                      Doorbelasten aan klant
                    </p>
                    <div className="mt-3">
                      <Dialog
                        open={showKostenDialog}
                        onOpenChange={setShowKostenDialog}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setKostenValue(String(melding.kosten ?? 0))
                            }
                          >
                            Kosten: {"\u20AC"}
                            {(melding.kosten ?? 0).toFixed(2)}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Kosten bijwerken</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>Kosten ({"\u20AC"})</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={kostenValue}
                                onChange={(e) => setKostenValue(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSaveKosten}>
                              Opslaan
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Klant info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Klant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{melding.klantNaam}</p>
                {melding.klantAdres && (
                  <p className="text-muted-foreground">{melding.klantAdres}</p>
                )}
                {melding.klantEmail && (
                  <p className="text-muted-foreground">{melding.klantEmail}</p>
                )}
                {melding.klantTelefoon && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {melding.klantTelefoon}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Project info */}
            {melding.projectNaam && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <FolderKanban className="h-4 w-4" />
                    Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium text-sm">{melding.projectNaam}</p>
                  {melding.projectStatus && (
                    <Badge variant="outline">{melding.projectStatus}</Badge>
                  )}
                  {melding.projectId && (
                    <Link
                      href={`/projecten/${melding.projectId}`}
                      className="block text-sm text-primary hover:underline mt-2"
                    >
                      Naar project →
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact info */}
            {melding.contactInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Phone className="h-4 w-4" />
                    Contactinformatie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {melding.contactInfo}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Meta info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Aangemaakt</span>
                  <span>
                    {new Date(melding.createdAt).toLocaleDateString("nl-NL")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Laatst bijgewerkt</span>
                  <span>
                    {new Date(melding.updatedAt).toLocaleDateString("nl-NL")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
