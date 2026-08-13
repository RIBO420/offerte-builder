"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  ListTodo,
  Loader2,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type Prioriteit = "laag" | "normaal" | "hoog";

const PRIORITEIT_LABELS: Record<Prioriteit, string> = {
  laag: "Laag",
  normaal: "Normaal",
  hoog: "Hoog",
};

const PRIORITEIT_STIJL: Record<Prioriteit, string> = {
  laag: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  normaal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  hoog: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

/** Sentinelwaarde: Radix Select accepteert geen lege string als item-value. */
const NIEMAND = "__niemand__";

function vandaagISO(): string {
  // Lokale datum, niet toISOString() — die schuift bij ons een dag terug 's avonds.
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

function formatDeadline(deadline: string): string {
  const [jaar, maand, dag] = deadline.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(jaar, maand - 1, dag));
}

interface KlantTakenCardProps {
  klantId: Id<"klanten">;
}

/**
 * Takenlijst per klant: wat moet er nog gebeuren voor deze klant, en wie doet
 * het. Bewust gescheiden van de klanttijdlijn (wat er gebeurd is).
 */
export function KlantTakenCard({ klantId }: KlantTakenCardProps) {
  const taken = useQuery(api.klantTaken.listVoorKlant, { klantId });
  const medewerkers = useQuery(api.medewerkers.list, { isActief: true });

  const createTaak = useMutation(api.klantTaken.create);
  const setStatus = useMutation(api.klantTaken.setStatus);
  const updateTaak = useMutation(api.klantTaken.update);
  const removeTaak = useMutation(api.klantTaken.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [prioriteit, setPrioriteit] = useState<Prioriteit>("normaal");
  const [deadline, setDeadline] = useState("");
  const [toegewezenAan, setToegewezenAan] = useState<string>(NIEMAND);
  const [bezig, setBezig] = useState(false);
  const [toonAfgerond, setToonAfgerond] = useState(false);

  const openTaken = useMemo(
    () => (taken ?? []).filter((t) => t.status === "open"),
    [taken]
  );
  const afgerondeTaken = useMemo(
    () => (taken ?? []).filter((t) => t.status === "afgerond"),
    [taken]
  );

  const resetForm = () => {
    setTitel("");
    setOmschrijving("");
    setPrioriteit("normaal");
    setDeadline("");
    setToegewezenAan(NIEMAND);
  };

  const handleCreate = async () => {
    if (!titel.trim()) {
      showErrorToast("Geef de taak een titel");
      return;
    }
    setBezig(true);
    try {
      await createTaak({
        klantId,
        titel: titel.trim(),
        omschrijving: omschrijving.trim() || undefined,
        prioriteit,
        deadline: deadline || undefined,
        toegewezenAanId:
          toegewezenAan === NIEMAND
            ? undefined
            : (toegewezenAan as Id<"medewerkers">),
      });
      showSuccessToast("Taak toegevoegd");
      resetForm();
      setFormOpen(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij toevoegen taak"
      );
    } finally {
      setBezig(false);
    }
  };

  const handleToggle = async (
    id: Id<"klantTaken">,
    huidigeStatus: "open" | "afgerond"
  ) => {
    try {
      await setStatus({
        id,
        status: huidigeStatus === "open" ? "afgerond" : "open",
      });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken taak"
      );
    }
  };

  const handleToewijzen = async (id: Id<"klantTaken">, waarde: string) => {
    try {
      await updateTaak({
        id,
        toegewezenAanId:
          waarde === NIEMAND ? null : (waarde as Id<"medewerkers">),
      });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij toewijzen taak"
      );
    }
  };

  const handleVerwijderen = async (id: Id<"klantTaken">) => {
    try {
      await removeTaak({ id });
      showSuccessToast("Taak verwijderd");
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij verwijderen taak"
      );
    }
  };

  const zichtbareTaken = toonAfgerond
    ? [...openTaken, ...afgerondeTaken]
    : openTaken;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Taken
              {openTaken.length > 0 && (
                <Badge variant="secondary">{openTaken.length} open</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Wat moet er nog gebeuren voor deze klant, en wie pakt het op.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={formOpen ? "ghost" : "default"}
            onClick={() => {
              setFormOpen((open) => !open);
              if (formOpen) resetForm();
            }}
          >
            {formOpen ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Annuleren
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe taak
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {formOpen && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div className="space-y-2">
              <Label htmlFor="taak-titel">Taak *</Label>
              <Input
                id="taak-titel"
                placeholder="Bijv. terugbellen over de oprit"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taak-omschrijving">Toelichting</Label>
              <Textarea
                id="taak-omschrijving"
                rows={2}
                placeholder="Optionele extra context"
                value={omschrijving}
                onChange={(e) => setOmschrijving(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="taak-medewerker">Toewijzen aan</Label>
                <Select value={toegewezenAan} onValueChange={setToegewezenAan}>
                  <SelectTrigger id="taak-medewerker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NIEMAND}>Niemand</SelectItem>
                    {(medewerkers ?? []).map((medewerker) => (
                      <SelectItem key={medewerker._id} value={medewerker._id}>
                        {medewerker.naam}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taak-deadline">Deadline</Label>
                <Input
                  id="taak-deadline"
                  type="date"
                  min={vandaagISO()}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taak-prioriteit">Prioriteit</Label>
                <Select
                  value={prioriteit}
                  onValueChange={(waarde) => setPrioriteit(waarde as Prioriteit)}
                >
                  <SelectTrigger id="taak-prioriteit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITEIT_LABELS) as Prioriteit[]).map(
                      (waarde) => (
                        <SelectItem key={waarde} value={waarde}>
                          {PRIORITEIT_LABELS[waarde]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={bezig || !titel.trim()}>
              {bezig ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Taak toevoegen
            </Button>
          </div>
        )}

        {taken === undefined ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Taken laden…
          </div>
        ) : zichtbareTaken.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {openTaken.length === 0 && afgerondeTaken.length > 0
              ? "Alle taken zijn afgerond."
              : "Nog geen taken voor deze klant."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {zichtbareTaken.map((taak) => {
              const isAfgerond = taak.status === "afgerond";
              const isTeLaat =
                !isAfgerond && taak.deadline && taak.deadline < vandaagISO();

              return (
                <li
                  key={taak._id}
                  className={cn(
                    "flex items-start gap-3 p-3",
                    isAfgerond && "opacity-60"
                  )}
                >
                  <Checkbox
                    className="mt-1"
                    checked={isAfgerond}
                    onCheckedChange={() => handleToggle(taak._id, taak.status)}
                    aria-label={
                      isAfgerond
                        ? `Taak ${taak.titel} heropenen`
                        : `Taak ${taak.titel} afronden`
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          isAfgerond && "line-through"
                        )}
                      >
                        {taak.titel}
                      </span>
                      {!isAfgerond && taak.prioriteit !== "normaal" && (
                        <Badge
                          className={cn(
                            "text-[10px]",
                            PRIORITEIT_STIJL[taak.prioriteit]
                          )}
                        >
                          {PRIORITEIT_LABELS[taak.prioriteit]}
                        </Badge>
                      )}
                      {taak.deadline && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-xs",
                            isTeLaat
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {formatDeadline(taak.deadline)}
                          {isTeLaat && " · te laat"}
                        </span>
                      )}
                    </div>
                    {taak.omschrijving && (
                      <p className="text-sm text-muted-foreground">
                        {taak.omschrijving}
                      </p>
                    )}
                    {taak.werkitemNaam && (
                      <p className="text-xs text-muted-foreground">
                        Klus: {taak.werkitemNaam}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Select
                      value={taak.toegewezenAanId ?? NIEMAND}
                      onValueChange={(waarde) =>
                        handleToewijzen(taak._id, waarde)
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-[150px] text-xs"
                        aria-label={`Toewijzing voor ${taak.titel}`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {taak.toegewezenAanNaam ?? "Niet toegewezen"}
                          </span>
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NIEMAND}>Niet toegewezen</SelectItem>
                        {(medewerkers ?? []).map((medewerker) => (
                          <SelectItem key={medewerker._id} value={medewerker._id}>
                            {medewerker.naam}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Taak ${taak.titel} verwijderen`}
                      onClick={() => handleVerwijderen(taak._id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {afgerondeTaken.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setToonAfgerond((waarde) => !waarde)}
          >
            {toonAfgerond
              ? "Afgeronde taken verbergen"
              : `${afgerondeTaken.length} afgeronde ta${afgerondeTaken.length === 1 ? "ak" : "ken"} tonen`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
