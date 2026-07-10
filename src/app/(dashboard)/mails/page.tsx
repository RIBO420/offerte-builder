"use client";

/**
 * Concept-mails — goedkeurings-wachtrij voor uitgaande trigger-mails
 * (PRD §2.7, kantoor↔klant-regel §1.2).
 *
 * Door mail-triggers klaargezette mails. Kantoor kan hier:
 * - bewerken (alleen inhoudsvelden — opmaak/huisstijl zit in de template),
 * - goedkeuren + versturen (server-side capability-check
 *   assertKanNaarKlantVersturen; verzending loopt door de mail-guard),
 * - verwerpen.
 *
 * Zonder EMAIL_VERZENDEN_ACTIEF="true" (dev/sandbox) wordt een goedgekeurde
 * mail gelogd als "onderdrukt (sandbox)" en verlaat er niets het systeem.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import {
  CalendarClock,
  Edit,
  Loader2,
  Mail,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useIsKantoor } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  CONCEPT_MAIL_STATUS_LABELS,
  MAIL_EVENT_LABELS,
} from "@/lib/mail-triggers";

interface ConceptMail {
  _id: Id<"conceptMails">;
  event: string;
  ontvangerEmail: string;
  ontvangerNaam: string;
  onderwerp: string;
  inhoud: string;
  geplandOp: number;
  status: string;
  modus: "concept" | "automatisch";
  foutmelding?: string;
}

interface FormState {
  onderwerp: string;
  inhoud: string;
  ontvangerEmail: string;
}

function formatDatum(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ConceptMailsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isKantoor = useIsKantoor();
  const magBeheren = Boolean(user?._id) && isKantoor;

  const wachtrij = useQuery(
    api.conceptMails.listWachtrij,
    magBeheren ? {} : "skip"
  ) as ConceptMail[] | undefined;
  const afgehandeld = useQuery(
    api.conceptMails.listAfgehandeld,
    magBeheren ? { limit: 25 } : "skip"
  ) as ConceptMail[] | undefined;

  const bewerk = useMutation(api.conceptMails.bewerk);
  const keurGoedEnVerstuur = useMutation(api.conceptMails.keurGoedEnVerstuur);
  const verwerp = useMutation(api.conceptMails.verwerp);

  const [geselecteerd, setGeselecteerd] = useState<ConceptMail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [bezigMetId, setBezigMetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openBewerken(mail: ConceptMail) {
    setGeselecteerd(mail);
    setForm({
      onderwerp: mail.onderwerp,
      inhoud: mail.inhoud,
      ontvangerEmail: mail.ontvangerEmail,
    });
  }

  async function handleOpslaan() {
    if (!geselecteerd || !form) return;
    setIsSaving(true);
    try {
      await bewerk({
        id: geselecteerd._id,
        onderwerp: form.onderwerp,
        inhoud: form.inhoud,
        ontvangerEmail: form.ontvangerEmail,
      });
      toast.success("Concept-mail bijgewerkt");
      setGeselecteerd(null);
      setForm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVersturen(mail: ConceptMail) {
    setBezigMetId(mail._id);
    try {
      await keurGoedEnVerstuur({ id: mail._id });
      toast.success(
        `Mail goedgekeurd — verzending naar ${mail.ontvangerEmail} gestart`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Goedkeuren mislukt"
      );
    } finally {
      setBezigMetId(null);
    }
  }

  async function handleVerwerpen(mail: ConceptMail) {
    setBezigMetId(mail._id);
    try {
      await verwerp({ id: mail._id });
      toast.success("Concept-mail verworpen — er wordt niets verstuurd");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verwerpen mislukt"
      );
    } finally {
      setBezigMetId(null);
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
            De Concept-mails-wachtrij is alleen toegankelijk voor directie en
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
        <div>
          <h1 className="text-2xl font-semibold">Concept-mails</h1>
          <p className="text-sm text-muted-foreground">
            Door mail-triggers klaargezette mails. Niets gaat naar de klant
            zonder goedkeuring van kantoor.
          </p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Wachtrij
          </CardTitle>
          <CardDescription>
            Goedkeuren verstuurt via het beveiligde mailpad (mail-guard);
            verwerpen laat de mail vervallen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wachtrij === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : wachtrij.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Geen concept-mails in de wachtrij.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ontvanger</TableHead>
                  <TableHead>Onderwerp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Gepland op</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {wachtrij.map((mail) => (
                  <TableRow key={mail._id}>
                    <TableCell>
                      <div className="font-medium">{mail.ontvangerNaam}</div>
                      <div className="text-xs text-muted-foreground">
                        {mail.ontvangerEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{mail.onderwerp}</div>
                      <div className="max-w-md truncate text-xs text-muted-foreground">
                        {mail.inhoud}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {MAIL_EVENT_LABELS[mail.event] ?? mail.event}
                      </Badge>
                      {mail.status === "gepland" && (
                        <Badge variant="secondary" className="ml-1">
                          <CalendarClock className="size-3 mr-0.5" />
                          Gepland
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDatum(mail.geplandOp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openBewerken(mail)}
                          title="Bewerken (alleen inhoud — opmaak zit in de template)"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerwerpen(mail)}
                          disabled={bezigMetId === mail._id}
                          title="Verwerpen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleVersturen(mail)}
                          disabled={bezigMetId === mail._id}
                          title="Goedkeuren en versturen"
                        >
                          <Send className="size-4 mr-1" />
                          Versturen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent afgehandeld</CardTitle>
          <CardDescription>
            Verzonden, verworpen, mislukte en (in sandbox) onderdrukte mails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {afgehandeld === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : afgehandeld.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nog geen afgehandelde mails.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ontvanger</TableHead>
                  <TableHead>Onderwerp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {afgehandeld.map((mail) => (
                  <TableRow key={mail._id}>
                    <TableCell>
                      <div className="font-medium">{mail.ontvangerNaam}</div>
                      <div className="text-xs text-muted-foreground">
                        {mail.ontvangerEmail}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {mail.onderwerp}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {MAIL_EVENT_LABELS[mail.event] ?? mail.event}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          mail.status === "verzonden"
                            ? "default"
                            : mail.status === "mislukt"
                              ? "destructive"
                              : "secondary"
                        }
                        title={mail.foutmelding}
                      >
                        {CONCEPT_MAIL_STATUS_LABELS[mail.status] ?? mail.status}
                      </Badge>
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
            <DialogTitle>Concept-mail bewerken</DialogTitle>
            <DialogDescription>
              Alleen inhoudsvelden — de opmaak (huisstijl) zit in de
              mail-template en wordt bij verzending toegepast.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mail-ontvanger">Ontvanger (e-mail)</Label>
                <Input
                  id="mail-ontvanger"
                  value={form.ontvangerEmail}
                  onChange={(e) =>
                    setForm({ ...form, ontvangerEmail: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mail-onderwerp">Onderwerp</Label>
                <Input
                  id="mail-onderwerp"
                  value={form.onderwerp}
                  onChange={(e) =>
                    setForm({ ...form, onderwerp: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mail-inhoud">Inhoud</Label>
                <Textarea
                  id="mail-inhoud"
                  rows={10}
                  value={form.inhoud}
                  onChange={(e) => setForm({ ...form, inhoud: e.target.value })}
                />
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
