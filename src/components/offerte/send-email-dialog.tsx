"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Mail, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useEmail, useEmailLogs, type EmailType } from "@/hooks/use-email";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerte: {
    _id: Id<"offertes">;
    offerteNummer: string;
    type: "aanleg" | "onderhoud";
    klant: {
      naam: string;
      email?: string;
    };
    scopes?: string[];
    totalen: {
      totaalInclBtw: number;
    };
  };
  bedrijfsgegevens?: {
    naam: string;
    email?: string;
    telefoon?: string;
  };
}

const emailTypeLabels: Record<EmailType, string> = {
  offerte_verzonden: "Offerte Verzenden",
  herinnering: "Herinnering",
  bedankt: "Bedankt voor opdracht",
};

const emailTypeDescriptions: Record<EmailType, string> = {
  offerte_verzonden:
    "Verstuur de offerte naar de klant met alle details en totalen.",
  herinnering:
    "Stuur een vriendelijke herinnering dat de offerte nog openstaat.",
  bedankt:
    "Bedank de klant voor het accepteren van de offerte en bevestig de opdracht.",
};

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function SendEmailDialog({
  open,
  onOpenChange,
  offerte,
  bedrijfsgegevens,
}: SendEmailDialogProps) {
  const { user } = useCurrentUser();
  const { sendEmail, isSending } = useEmail();
  const { logs } = useEmailLogs(offerte._id);

  const [emailType, setEmailType] = useState<EmailType>("offerte_verzonden");
  const [toEmail, setToEmail] = useState(offerte.klant.email || "");

  // Optimistic state for showing pending email in logs
  const [optimisticPendingEmail, setOptimisticPendingEmail] = useState<{
    type: EmailType;
    to: string;
    timestamp: number;
  } | null>(null);

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast.error("Vul een emailadres in");
      return;
    }

    if (!user) {
      toast.error("Je bent niet ingelogd");
      return;
    }

    // 1. Apply optimistic update - show pending email immediately
    const pendingEmail = {
      type: emailType,
      to: toEmail.trim(),
      timestamp: Date.now(),
    };
    setOptimisticPendingEmail(pendingEmail);

    // 2. Close dialog immediately for better UX
    onOpenChange(false);

    // Show immediate feedback
    toast.success("Email wordt verzonden...");

    try {
      // 3. Make actual server call
      await sendEmail({
        offerteId: offerte._id,
        type: emailType,
        to: toEmail.trim(),
        klantNaam: offerte.klant.naam,
        offerteNummer: offerte.offerteNummer,
        totaalInclBtw: offerte.totalen.totaalInclBtw,
        bedrijfsnaam: bedrijfsgegevens?.naam || "Top Tuinen",
        bedrijfsEmail: bedrijfsgegevens?.email,
        bedrijfsTelefoon: bedrijfsgegevens?.telefoon,
        offerteType: offerte.type,
        scopes: offerte.scopes,
      });

      // 4. Clear optimistic state and show success
      setOptimisticPendingEmail(null);
      toast.success("Email verzonden!");
    } catch (error) {
      // 5. Clear optimistic state on error
      setOptimisticPendingEmail(null);
      toast.error(
        error instanceof Error ? error.message : "Fout bij verzenden email"
      );
    }
  };

  const handleClose = () => {
    if (!isSending) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Verzenden
          </DialogTitle>
          <DialogDescription>
            Verstuur een email naar {offerte.klant.naam} over offerte{" "}
            {offerte.offerteNummer}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Type */}
          <div className="space-y-2">
            <Label htmlFor="email-type">Type Email</Label>
            <Select
              value={emailType}
              onValueChange={(value) => setEmailType(value as EmailType)}
              disabled={isSending}
            >
              <SelectTrigger id="email-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offerte_verzonden">
                  {emailTypeLabels.offerte_verzonden}
                </SelectItem>
                <SelectItem value="herinnering">
                  {emailTypeLabels.herinnering}
                </SelectItem>
                <SelectItem value="bedankt">
                  {emailTypeLabels.bedankt}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {emailTypeDescriptions[emailType]}
            </p>
          </div>

          {/* To Email */}
          <div className="space-y-2">
            <Label htmlFor="to-email">Aan</Label>
            <Input
              id="to-email"
              type="email"
              placeholder="klant@email.nl"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              disabled={isSending}
            />
          </div>

          {/* Previous Emails */}
          {logs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Eerdere emails ({logs.length})
                </Label>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {logs.slice(0, 5).map((log) => (
                    <div
                      key={log._id}
                      className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {log.status === "verzonden" && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        )}
                        {log.status === "geopend" && (
                          <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                        )}
                        {log.status === "mislukt" && (
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span>{emailTypeLabels[log.type as EmailType]}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">
                          {formatDateTime(log.createdAt)}
                        </span>
                        <Badge
                          variant={
                            log.status === "verzonden"
                              ? "default"
                              : log.status === "geopend"
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-xs"
                        >
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Note about attachments */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            <p className="text-amber-800 dark:text-amber-200">
              <strong>Let op:</strong> De email bevat een samenvatting van de
              offerte. De klant kan geen PDF bijlage ontvangen via dit systeem -
              download de PDF apart om te delen.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Annuleren
          </Button>
          <Button onClick={handleSend} disabled={isSending || !toEmail.trim()}>
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Verzenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
