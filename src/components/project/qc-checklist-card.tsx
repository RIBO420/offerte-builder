"use client";

/**
 * Eén scope op de kwaliteitspagina van een project, mét gestarte controle:
 * de checklist (afvinken, punten toevoegen/verwijderen), voortgang, foto's en
 * goed-/afkeuren. Een afgeronde controle (goedgekeurd/afgekeurd) toont de
 * uitkomst en klapt de punten in.
 *
 * Scopes zónder controle tekent de pagina zelf (zelfde paneelvorm), zodat de
 * stapel scopes als één lijst leest.
 */

import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { QC_STATUS_CONFIG, type QCStatus } from "@/lib/constants/statuses";
import { scopeLabel } from "@/lib/rapportage-labels";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoortgangsBalk, procent, scopeStip } from "@/components/project/project-cijfers";
import { QCFotoUpload } from "@/components/project/qc-foto-upload";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";

type Controle = Doc<"kwaliteitsControles">;

interface QCChecklistCardProps {
  controle: Controle;
  onApprove: () => void;
  onReject: () => void;
  /**
   * Is "Goedkeuren" de ene gevulde hoofdknop van het scherm? De pagina kiest
   * er hooguit één; anders is de knop omlijnd.
   */
  goedkeurenGevuld?: boolean;
  userName?: string;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QCChecklistCard({
  controle,
  onApprove,
  onReject,
  goedkeurenGevuld = false,
  userName = "Gebruiker",
}: QCChecklistCardProps) {
  const {
    _id: id,
    scope,
    checklistItems,
    opmerkingen,
    goedgekeurdDoor,
    goedgekeurdAt,
  } = controle;
  const status = controle.status as QCStatus;
  const isReadOnly = status === "goedgekeurd" || status === "afgekeurd";

  const lijstId = useId();
  const hintId = useId();
  const nieuwId = useId();

  const [puntenOpen, setPuntenOpen] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [verwijderend, setVerwijderend] = useState<string | null>(null);
  const [nieuwPunt, setNieuwPunt] = useState("");
  const [toevoegenBezig, setToevoegenBezig] = useState(false);

  const updateChecklistItem = useMutation(api.kwaliteitsControles.updateChecklistItem);
  const addChecklistItem = useMutation(api.kwaliteitsControles.addChecklistItem);
  const removeChecklistItem = useMutation(api.kwaliteitsControles.removeChecklistItem);

  const checkedCount = checklistItems.filter((item) => item.isAfgevinkt).length;
  const totalCount = checklistItems.length;
  const progress = procent(checkedCount, totalCount);
  const allChecked = totalCount > 0 && checkedCount === totalCount;
  const label = scopeLabel(scope);

  // Afgeronde controles klappen in; een lopende controle staat altijd open.
  const toonPunten = !isReadOnly || puntenOpen;

  const handleCheckboxChange = async (itemId: string, checked: boolean) => {
    // Niet uitschakelen tijdens het opslaan: een uitgeschakeld vinkje verliest
    // de toetsenbordfocus. Een tweede klik negeren we gewoon.
    if (updatingItems.has(itemId)) return;
    setUpdatingItems((prev) => new Set(prev).add(itemId));
    try {
      await updateChecklistItem({
        id,
        itemId,
        isAfgevinkt: checked,
        afgevinktDoor: checked ? userName : undefined,
      });
    } catch (error) {
      logger.error("Bijwerken checklist-item mislukt", error, {
        module: "project/qc-checklist",
        itemId,
      });
      // Het vinkje springt terug zodra de query hertekent; zonder melding lijkt
      // dat op een haperende UI in plaats van een mislukte opslag.
      showErrorToast("Kon het vinkje niet opslaan. Probeer het opnieuw.");
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    const omschrijving = nieuwPunt.trim();
    if (!omschrijving || toevoegenBezig) return;
    setToevoegenBezig(true);
    try {
      await addChecklistItem({ id, omschrijving });
      setNieuwPunt("");
    } catch (error) {
      logger.error("Toevoegen checklist-item mislukt", error, {
        module: "project/qc-checklist",
        kwaliteitsControleId: id,
      });
      showErrorToast("Punt kon niet worden toegevoegd", {
        description: getMutationErrorMessage(error),
      });
    } finally {
      setToevoegenBezig(false);
    }
  };

  const handleVerwijderen = async (itemId: string) => {
    if (verwijderend) return;
    setVerwijderend(itemId);
    try {
      await removeChecklistItem({ id, itemId });
    } catch (error) {
      logger.error("Verwijderen checklist-item mislukt", error, {
        module: "project/qc-checklist",
        itemId,
      });
      showErrorToast("Punt kon niet worden verwijderd", {
        description: getMutationErrorMessage(error),
      });
    } finally {
      setVerwijderend(null);
    }
  };

  const kleur = QC_STATUS_CONFIG[status]?.color;

  return (
    <SectiePaneel
      id={`qc-${scope}`}
      titel={label}
      kopbalk
      icoon={
        <span aria-hidden="true" className={cn("block size-2.5 rounded-full", scopeStip(scope))} />
      }
      acties={
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <StatusBadge status={status} domain="qc" size="sm" />
          {isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPuntenOpen((open) => !open)}
              aria-expanded={puntenOpen}
              aria-controls={lijstId}
              className="text-muted-foreground"
            >
              <span className="tabular-nums">
                {puntenOpen ? "Punten verbergen" : `${totalCount} punten tonen`}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform", puntenOpen && "rotate-180")}
              />
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Uitkomst van een afgeronde controle */}
        {isReadOnly && kleur && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-[13px]",
              kleur.bg,
              kleur.border,
              kleur.text
            )}
          >
            {status === "goedgekeurd" ? (
              <p className="tabular-nums">
                <span className="font-semibold">Goedgekeurd</span>
                {goedgekeurdDoor && <> door {goedgekeurdDoor}</>}
                {goedgekeurdAt && <> op {formatTimestamp(goedgekeurdAt)}</>}
              </p>
            ) : (
              <p className="font-semibold">Afgekeurd</p>
            )}
            {opmerkingen && (
              <p className="mt-0.5">
                {status === "afgekeurd" ? "Reden: " : "Opmerking: "}
                {opmerkingen}
              </p>
            )}
          </div>
        )}

        {/* Voortgang */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="tabular-nums">
              <span className="font-semibold">
                {checkedCount} van {totalCount}
              </span>{" "}
              <span className="text-muted-foreground">punten afgevinkt</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{progress}%</span>
          </div>
          <VoortgangsBalk
            waarde={progress}
            vulling={allChecked ? "bg-status-geaccepteerd-dot" : "bg-status-in-uitvoering-dot"}
          />
        </div>

        {toonPunten && (
          <div id={lijstId} className="flex flex-col gap-4">
            {!isReadOnly && opmerkingen && (
              <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">Opmerking:</span> {opmerkingen}
              </p>
            )}

            {totalCount > 0 ? (
              <ul aria-label={`Controlepunten ${label}`} className="flex flex-col">
                {checklistItems.map((item) => {
                  const checkboxId = `${id}-${item.id}`;
                  const isUpdating = updatingItems.has(item.id);
                  return (
                    <li key={item.id} className="flex items-start gap-2.5 py-1.5">
                      <Checkbox
                        id={checkboxId}
                        checked={item.isAfgevinkt}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(item.id, checked === true)
                        }
                        disabled={isReadOnly}
                        aria-busy={isUpdating || undefined}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor={checkboxId}
                          className={cn(
                            "block text-[13px] leading-5 font-normal text-pretty",
                            !isReadOnly && "cursor-pointer",
                            item.isAfgevinkt && "text-muted-foreground line-through"
                          )}
                        >
                          {item.omschrijving}
                        </Label>
                        {item.isAfgevinkt && item.afgevinktAt && (
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            Afgevinkt
                            {item.afgevinktDoor && <> door {item.afgevinktDoor}</>} ·{" "}
                            {formatTimestamp(item.afgevinktAt)}
                          </p>
                        )}
                      </div>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleVerwijderen(item.id)}
                          disabled={verwijderend === item.id}
                          aria-label={`Punt verwijderen: ${item.omschrijving}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Deze controle heeft nog geen punten. Voeg er hieronder een toe.
              </p>
            )}

            {!isReadOnly && (
              <form onSubmit={handleToevoegen} className="flex flex-wrap gap-2">
                <Label htmlFor={nieuwId} className="sr-only">
                  Punt toevoegen aan {label}
                </Label>
                <Input
                  id={nieuwId}
                  value={nieuwPunt}
                  onChange={(e) => setNieuwPunt(e.target.value)}
                  placeholder="Eigen punt toevoegen…"
                  disabled={toevoegenBezig}
                  className="min-w-0 flex-1 basis-48"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!nieuwPunt.trim() || toevoegenBezig}
                >
                  <Plus aria-hidden="true" />
                  Toevoegen
                </Button>
              </form>
            )}

            <div className="flex flex-col gap-2 border-t pt-4">
              <h3 className="text-[13px] font-semibold">Foto&apos;s</h3>
              <QCFotoUpload
                kwaliteitsControleId={id}
                fotos={controle.fotos ?? []}
                disabled={isReadOnly}
              />
            </div>
          </div>
        )}

        {!isReadOnly && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              variant={goedkeurenGevuld ? "default" : "outline"}
              onClick={onApprove}
              disabled={!allChecked}
              aria-describedby={!allChecked ? hintId : undefined}
            >
              <Check aria-hidden="true" />
              Goedkeuren
            </Button>
            <Button variant="outline" onClick={onReject} className="text-destructive hover:text-destructive">
              <X aria-hidden="true" />
              Afkeuren
            </Button>
            {!allChecked && (
              <p id={hintId} className="text-xs text-muted-foreground">
                Goedkeuren kan als alle punten zijn afgevinkt.
              </p>
            )}
          </div>
        )}
      </div>
    </SectiePaneel>
  );
}
