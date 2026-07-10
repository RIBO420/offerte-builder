"use client";

/**
 * Mail-triggers — beheerscherm (PRD §2.7).
 *
 * Kantoor-only scherm onder Instellingen (zelfde patroon als
 * /instellingen/tekstblokken): per event een trigger-record met sjabloon
 * (onderwerp + inhoud, platte tekst met {{variabelen}}), vertraging,
 * ontvanger, modus en actief-vlag. Nieuwe mails toevoegen = record
 * toevoegen, geen code (principe 2).
 *
 * KANTOOR↔KLANT-REGEL (§1.2): modus "concept" (default) zet mails in de
 * wachtrij "Concept-mails"; "automatisch" is alleen bedoeld voor
 * onpersoonlijke bevestigingen en loopt óók door de mail-guard.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { Edit, Loader2, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsKantoor } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MAIL_EVENT_LABELS, MAIL_MODUS_LABELS } from "@/lib/mail-triggers";

interface MailTrigger {
  _id: Id<"mailTriggers">;
  event: string;
  naam: string;
  omschrijving?: string;
  onderwerp: string;
  inhoud: string;
  variabelen: string[];
  vertragingDagen: number;
  ontvanger: "klant" | "lead" | "custom";
  customEmail?: string;
  modus: "concept" | "automatisch";
  actief: boolean;
}

interface FormState {
  naam: string;
  onderwerp: string;
  inhoud: string;
  vertragingDagen: string;
  modus: "concept" | "automatisch";
}

export default function MailTriggersPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isKantoor = useIsKantoor();
  const magBeheren = Boolean(user?._id) && isKantoor;

  const triggers = useQuery(api.mailTriggers.list, magBeheren ? {} : "skip") as
    | MailTrigger[]
    | undefined;

  const seedDefaults = useMutation(api.mailTriggers.seedDefaults);
  const updateTrigger = useMutation(api.mailTriggers.update);

  const [geselecteerd, setGeselecteerd] = useState<MailTrigger | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openBewerken(trigger: MailTrigger) {
    setGeselecteerd(trigger);
    setForm({
      naam: trigger.naam,
      onderwerp: trigger.onderwerp,
      inhoud: trigger.inhoud,
      vertragingDagen: String(trigger.vertragingDagen),
      modus: trigger.modus,
    });
  }

  async function handleSeed() {
    try {
      const resultaat = await seedDefaults({});
      toast.success(
        resultaat.aangemaakt > 0
          ? `${resultaat.aangemaakt} standaardtrigger(s) toegevoegd`
          : "Alle standaardtriggers bestaan al"
      );
    } catch {
      toast.error("Standaardtriggers laden mislukt");
    }
  }

  async function handleActief(trigger: MailTrigger, actief: boolean) {
    try {
      await updateTrigger({ id: trigger._id, actief });
      toast.success(
        actief ? "Trigger geactiveerd" : "Trigger uitgeschakeld — dit event mailt niet meer"
      );
    } catch {
      toast.error("Bijwerken mislukt");
    }
  }

  async function handleOpslaan() {
    if (!geselecteerd || !form) return;
    const vertraging = Number.parseInt(form.vertragingDagen, 10);
    if (Number.isNaN(vertraging) || vertraging < 0) {
      toast.error("Vertraging moet een geheel aantal dagen (0 of meer) zijn");
      return;
    }
    setIsSaving(true);
    try {
      await updateTrigger({
        id: geselecteerd._id,
        naam: form.naam,
        onderwerp: form.onderwerp,
        inhoud: form.inhoud,
        vertragingDagen: vertraging,
        modus: form.modus,
      });
      toast.success("Mail-trigger opgeslagen");
      setGeselecteerd(null);
      setForm(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Opslaan mislukt"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isUserLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!magBeheren) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <p className="font-medium">Alleen voor kantoor</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Mail-triggers zijn alleen toegankelijk voor directie en
            projectleiders.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Mail-triggers</h1>
            <p className="text-sm text-muted-foreground">
              Transactionele mails: event → sjabloon → vertraging → ontvanger.
              Mails naar klanten worden altijd door kantoor goedgekeurd
              (Concept-mails), nooit volautomatisch.
            </p>
          </div>
          <Button variant="outline" onClick={handleSeed}>
            <Sparkles className="size-4 mr-1" />
            Standaardtriggers laden
          </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Triggers
          </CardTitle>
          <CardDescription>
            Sjablonen zijn platte tekst met {"{{variabelen}}"} — de huisstijl
            (opmaak) zit in de mail-template en wordt bij verzending
            toegepast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {triggers === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : triggers.length === 0 ? (
            <EmptyState
              icon={<Mail aria-hidden />}
              title="Nog geen mail-triggers"
              description="Laad de standaardtriggers om de vijf fase 1-events aan te maken, of stel ze later handmatig in."
              action={{
                label: "Standaardtriggers laden",
                onClick: handleSeed,
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Modus</TableHead>
                  <TableHead>Vertraging</TableHead>
                  <TableHead>Ontvanger</TableHead>
                  <TableHead>Actief</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggers.map((trigger) => (
                  <TableRow key={trigger._id}>
                    <TableCell className="font-mono text-xs">
                      {trigger.event}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {MAIL_EVENT_LABELS[trigger.event] ?? trigger.naam}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          trigger.modus === "concept" ? "secondary" : "default"
                        }
                      >
                        {trigger.modus === "concept"
                          ? "Concept"
                          : "Automatisch"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {trigger.event === "offerte_opvolging"
                        ? "dag 3/7/14"
                        : trigger.vertragingDagen === 0
                          ? "Direct"
                          : `${trigger.vertragingDagen} dag(en)`}
                    </TableCell>
                    <TableCell className="capitalize">
                      {trigger.ontvanger}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={trigger.actief}
                        onCheckedChange={(actief) =>
                          handleActief(trigger, actief)
                        }
                        aria-label={`Trigger ${trigger.naam} aan/uit`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openBewerken(trigger)}
                      >
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={geselecteerd !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGeselecteerd(null);
            setForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {geselecteerd
                ? (MAIL_EVENT_LABELS[geselecteerd.event] ?? geselecteerd.naam)
                : ""}
            </DialogTitle>
            <DialogDescription>
              {geselecteerd?.omschrijving ??
                "Sjabloon en instellingen van deze trigger."}
            </DialogDescription>
          </DialogHeader>

          {form && geselecteerd && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="trigger-naam">Naam</Label>
                <Input
                  id="trigger-naam"
                  value={form.naam}
                  onChange={(e) => setForm({ ...form, naam: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Modus</Label>
                  <Select
                    value={form.modus}
                    onValueChange={(modus) =>
                      setForm({
                        ...form,
                        modus: modus as "concept" | "automatisch",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concept">
                        {MAIL_MODUS_LABELS.concept}
                      </SelectItem>
                      <SelectItem value="automatisch">
                        {MAIL_MODUS_LABELS.automatisch}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trigger-vertraging">
                    Vertraging (dagen, 0 = direct)
                  </Label>
                  <Input
                    id="trigger-vertraging"
                    inputMode="numeric"
                    value={form.vertragingDagen}
                    onChange={(e) =>
                      setForm({ ...form, vertragingDagen: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trigger-onderwerp">Onderwerp</Label>
                <Input
                  id="trigger-onderwerp"
                  value={form.onderwerp}
                  onChange={(e) =>
                    setForm({ ...form, onderwerp: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trigger-inhoud">
                  Inhoud (platte tekst — opmaak zit in de template)
                </Label>
                <Textarea
                  id="trigger-inhoud"
                  rows={8}
                  value={form.inhoud}
                  onChange={(e) =>
                    setForm({ ...form, inhoud: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Beschikbare variabelen</Label>
                <div className="flex flex-wrap gap-1.5">
                  {geselecteerd.variabelen.map((variabele) => (
                    <Badge
                      key={variabele}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {`{{${variabele}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGeselecteerd(null);
                setForm(null);
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleOpslaan} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 mr-1 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
