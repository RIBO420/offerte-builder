"use client";

/**
 * Machinepark-detailkaart (PRD §3.3): status/team/schaars-beheer,
 * standaardinventaris per bus (voertuigUitrusting — voedt de
 * delta-checklist §2.6) en vervalitems per middel (APK/keuring/
 * certificaat/verzekering → dagelijkse cron maakt onderhoudstaken).
 *
 * Kantoor beheert; voorman/staf ziet dezelfde kaart alleen-lezen.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export const MIDDEL_STATUS_LABELS: Record<string, string> = {
  beschikbaar: "Beschikbaar",
  onderhoud: "In onderhoud",
  kapot: "Kapot",
  inactief: "Inactief",
};

const VERVAL_TYPES = [
  { value: "apk", label: "APK" },
  { value: "keuring", label: "Keuring" },
  { value: "certificaat", label: "Certificaat" },
  { value: "verzekering", label: "Verzekering" },
  { value: "anders", label: "Anders" },
] as const;

const UITRUSTING_CATEGORIEEN = [
  { value: "motorgereedschap", label: "Motorgereedschap" },
  { value: "handgereedschap", label: "Handgereedschap" },
  { value: "veiligheid", label: "Veiligheid" },
  { value: "overig", label: "Overig" },
] as const;

export interface MiddelRij {
  soort: "voertuig" | "machine";
  id: string;
  naam: string;
  subtitel: string | null;
  status: "beschikbaar" | "onderhoud" | "kapot" | "inactief";
  schaars: boolean;
  teamId: string | null;
  teamNaam: string | null;
  teamKleur: string | null;
  eerstvolgendeVervaldatum: string | null;
  vervalBinnenTermijn: number;
}

interface Props {
  middel: MiddelRij | null;
  magBeheren: boolean;
  teams: Array<{ teamId: Id<"teams">; naam: string }>;
  onClose: () => void;
}

export function MiddelDetailDialog({ middel, magBeheren, teams, onClose }: Props) {
  const isVoertuig = middel?.soort === "voertuig";
  const voertuigId = isVoertuig ? (middel!.id as Id<"voertuigen">) : undefined;
  const machineId =
    middel && !isVoertuig ? (middel.id as Id<"machines">) : undefined;

  const uitrusting = useQuery(
    api.voertuigUitrusting.list,
    voertuigId ? { voertuigId } : "skip"
  );
  const vervalItems = useQuery(
    api.vervalItems.list,
    middel ? (isVoertuig ? { voertuigId } : { machineId }) : "skip"
  );

  const setStatus = useMutation(api.machinepark.setStatus);
  const setEigenschappen = useMutation(api.machinepark.setEigenschappen);
  const maakUitrusting = useMutation(api.voertuigUitrusting.create);
  const updateUitrustingStatus = useMutation(api.voertuigUitrusting.updateStatus);
  const verwijderUitrusting = useMutation(api.voertuigUitrusting.remove);
  const maakVervalItem = useMutation(api.vervalItems.create);
  const updateVervalItem = useMutation(api.vervalItems.update);
  const verwijderVervalItem = useMutation(api.vervalItems.remove);

  // Formulier: nieuw inventaris-item
  const [itemNaam, setItemNaam] = useState("");
  const [itemCategorie, setItemCategorie] = useState<string>("handgereedschap");
  // Formulier: nieuw vervalitem
  const [vervalNaam, setVervalNaam] = useState("");
  const [vervalType, setVervalType] = useState<string>("apk");
  const [vervaldatum, setVervaldatum] = useState("");
  const [termijn, setTermijn] = useState("30");
  const [ontvangerRol, setOntvangerRol] = useState<string>("kantoor");
  const [maakPlantaak, setMaakPlantaak] = useState(false);

  if (!middel) return null;
  const middelArgs = isVoertuig ? { voertuigId } : { machineId };

  const voegInventarisToe = async () => {
    if (!voertuigId || !itemNaam.trim()) return;
    try {
      await maakUitrusting({
        voertuigId,
        naam: itemNaam.trim(),
        categorie: itemCategorie as "handgereedschap",
        hoeveelheid: 1,
        status: "aanwezig",
      });
      setItemNaam("");
      toast.success("Toegevoegd aan de standaardinventaris");
    } catch {
      toast.error("Toevoegen mislukt");
    }
  };

  const voegVervalItemToe = async () => {
    if (!vervaldatum) {
      toast.error("Kies een vervaldatum");
      return;
    }
    const label = VERVAL_TYPES.find((t) => t.value === vervalType)?.label ?? "";
    try {
      await maakVervalItem({
        naam: vervalNaam.trim() || `${label} ${middel.naam}`,
        type: vervalType as "apk",
        objectType: middel.soort,
        ...middelArgs,
        vervaldatum,
        waarschuwtermijnDagen: Number(termijn) || 30,
        ontvangerRol: ontvangerRol as "kantoor",
        maakPlantaak,
      });
      setVervalNaam("");
      setVervaldatum("");
      toast.success("Vervalitem toegevoegd");
    } catch {
      toast.error("Vervalitem toevoegen mislukt");
    }
  };

  return (
    <Dialog open={!!middel} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {middel.naam}
            {middel.subtitel ? ` — ${middel.subtitel}` : ""}
          </DialogTitle>
          <DialogDescription>
            {isVoertuig ? "Bus/voertuig" : "Machine"} · status, teamkleur,
            {isVoertuig ? " standaardinventaris en" : ""} vervalitems
          </DialogDescription>
        </DialogHeader>

        {/* ── Eigenschappen ── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Status</Label>
            {magBeheren && middel.status !== "inactief" ? (
              <Select
                value={middel.status}
                onValueChange={(status) =>
                  setStatus({
                    ...middelArgs,
                    status: status as "beschikbaar",
                  })
                    .then(() => toast.success("Status opgeslagen"))
                    .catch(() => toast.error("Status opslaan mislukt"))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beschikbaar">Beschikbaar</SelectItem>
                  <SelectItem value="onderhoud">In onderhoud</SelectItem>
                  <SelectItem value="kapot">Kapot</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{MIDDEL_STATUS_LABELS[middel.status]}</p>
            )}
            {middel.status === "kapot" && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Kapot: het weekbord waarschuwt op gekoppelde team-dagen.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Team (kleurcode)</Label>
            {magBeheren ? (
              <Select
                value={middel.teamId ?? "geen"}
                onValueChange={(waarde) =>
                  setEigenschappen({
                    ...middelArgs,
                    teamId: waarde === "geen" ? null : (waarde as Id<"teams">),
                  })
                    .then(() => toast.success("Team opgeslagen"))
                    .catch(() => toast.error("Team opslaan mislukt"))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Geen team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geen">Geen team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.teamId} value={t.teamId}>
                      {t.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{middel.teamNaam ?? "—"}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="schaars-switch">Schaars materieel</Label>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="schaars-switch"
                checked={middel.schaars}
                disabled={!magBeheren}
                onCheckedChange={(schaars) =>
                  setEigenschappen({ ...middelArgs, schaars })
                    .then(() => toast.success("Opgeslagen"))
                    .catch(() => toast.error("Opslaan mislukt"))
                }
              />
              <span className="text-xs text-muted-foreground">
                Reserveerbaar per werkitem-dag; dubbel claimen waarschuwt.
              </span>
            </div>
          </div>
        </div>

        {/* ── Standaardinventaris (alleen bussen) ── */}
        {isVoertuig && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Standaardinventaris (voedt de delta-checklist)
              </h3>
              {uitrusting === undefined ? (
                <p className="text-xs text-muted-foreground">Laden…</p>
              ) : uitrusting.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nog geen inventaris — alles op de klus-lijst komt dan op de
                  checklist (fail-closed).
                </p>
              ) : (
                <ul className="space-y-1">
                  {uitrusting.map((item) => (
                    <li
                      key={item._id}
                      className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
                    >
                      <span>
                        {item.naam}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {UITRUSTING_CATEGORIEEN.find(
                            (c) => c.value === item.categorie
                          )?.label ?? item.categorie}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        {magBeheren ? (
                          <Select
                            value={item.status}
                            onValueChange={(status) =>
                              updateUitrustingStatus({
                                id: item._id,
                                status: status as "aanwezig",
                              }).catch(() => toast.error("Opslaan mislukt"))
                            }
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aanwezig">Aanwezig</SelectItem>
                              <SelectItem value="vermist">Vermist</SelectItem>
                              <SelectItem value="defect">Defect</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{item.status}</Badge>
                        )}
                        {magBeheren && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Verwijder ${item.naam}`}
                            onClick={() =>
                              verwijderUitrusting({ id: item._id }).catch(() =>
                                toast.error("Verwijderen mislukt")
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {magBeheren && (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="nieuw-item">Nieuw item</Label>
                    <Input
                      id="nieuw-item"
                      value={itemNaam}
                      placeholder="bv. Grasmaaier"
                      onChange={(e) => setItemNaam(e.target.value)}
                    />
                  </div>
                  <Select value={itemCategorie} onValueChange={setItemCategorie}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UITRUSTING_CATEGORIEEN.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={voegInventarisToe}
                    disabled={!itemNaam.trim()}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden /> Toevoegen
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Vervalitems ── */}
        <Separator />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Vervalitems (APK, keuring, certificaat, verzekering)
          </h3>
          {vervalItems === undefined ? (
            <p className="text-xs text-muted-foreground">Laden…</p>
          ) : vervalItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nog geen vervalitems voor dit middel.
            </p>
          ) : (
            <ul className="space-y-1">
              {vervalItems.map((item) => (
                <li
                  key={item._id}
                  className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
                >
                  <span>
                    <span className="font-medium">{item.naam}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {VERVAL_TYPES.find((t) => t.value === item.type)?.label} ·
                      verloopt {item.vervaldatum} · taak {item.waarschuwtermijnDagen}{" "}
                      dagen vooraf · ontvanger{" "}
                      {item.ontvangerRol === "voorman" ? "voorman" : "kantoor"}
                      {item.maakPlantaak ? " · plantaak" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Switch
                      aria-label={`Vervalitem ${item.naam} actief`}
                      checked={item.actief}
                      disabled={!magBeheren}
                      onCheckedChange={(actief) =>
                        updateVervalItem({ id: item._id, actief })
                          .then(() =>
                            toast.success(
                              actief ? "Geactiveerd" : "Gedeactiveerd (cron slaat over)"
                            )
                          )
                          .catch(() => toast.error("Opslaan mislukt"))
                      }
                    />
                    {magBeheren && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Verwijder ${item.naam}`}
                        onClick={() =>
                          verwijderVervalItem({ id: item._id }).catch(() =>
                            toast.error("Verwijderen mislukt")
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {magBeheren && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium">Nieuw vervalitem</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="verval-naam">Naam (optioneel)</Label>
                  <Input
                    id="verval-naam"
                    value={vervalNaam}
                    placeholder={`bv. APK ${middel.naam}`}
                    onChange={(e) => setVervalNaam(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={vervalType} onValueChange={setVervalType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERVAL_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="verval-datum">Vervaldatum</Label>
                  <Input
                    id="verval-datum"
                    type="date"
                    value={vervaldatum}
                    onChange={(e) => setVervaldatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="verval-termijn">Waarschuwtermijn (dagen)</Label>
                  <Input
                    id="verval-termijn"
                    type="number"
                    min={0}
                    max={365}
                    value={termijn}
                    onChange={(e) => setTermijn(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ontvanger</Label>
                  <Select value={ontvangerRol} onValueChange={setOntvangerRol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kantoor">Kantoor</SelectItem>
                      <SelectItem value="voorman">Voorman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="verval-plantaak">Automatische plantaak</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      id="verval-plantaak"
                      checked={maakPlantaak}
                      onCheckedChange={setMaakPlantaak}
                    />
                    <span className="text-xs text-muted-foreground">
                      Taak markeren voor de planbord-wachtrij (bv. &quot;bus
                      wegbrengen&quot;)
                    </span>
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={voegVervalItemToe}>
                <Plus className="mr-1 h-4 w-4" aria-hidden /> Vervalitem toevoegen
              </Button>
              <p className="text-[11px] text-muted-foreground">
                De dagelijkse controle zet binnen de termijn een onderhoudstaak
                op het meldingen-bord (idempotent, nooit e-mail).
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
