"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import {
  Loader2,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ExternalLink,
  Clock,
  Eye,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

interface ShareOfferteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerte: {
    _id: Id<"offertes">;
    offerteNummer: string;
    shareToken?: string;
    shareExpiresAt?: number;
    customerResponse?: {
      status: "bekeken" | "geaccepteerd" | "afgewezen";
      comment?: string;
      viewedAt?: number;
      respondedAt: number;
    };
  };
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function ShareOfferteDialog({
  open,
  onOpenChange,
  offerte,
}: ShareOfferteDialogProps) {
  const createShareLink = useMutation(api.publicOffertes.createShareLink);
  const revokeShareLink = useMutation(api.publicOffertes.revokeShareLink);

  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");

  const shareUrl = offerte.shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/offerte/${offerte.shareToken}`
    : null;

  const isExpired = offerte.shareExpiresAt
    ? offerte.shareExpiresAt < Date.now()
    : false;

  const handleCreateLink = async () => {
    setIsCreating(true);
    try {
      await createShareLink({
        offerteId: offerte._id,
        expiresInDays: parseInt(expiresInDays),
      });
      toast.success("Deellink aangemaakt");
    } catch {
      toast.error("Fout bij aanmaken deellink");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeLink = async () => {
    setIsRevoking(true);
    try {
      await revokeShareLink({ offerteId: offerte._id });
      toast.success("Deellink ingetrokken");
    } catch {
      toast.error("Fout bij intrekken deellink");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link gekopieerd");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren mislukt");
    }
  };

  const handleClose = () => {
    if (!isCreating && !isRevoking) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Offerte Delen
          </DialogTitle>
          <DialogDescription>
            Maak een link om de offerte te delen met {offerte.offerteNummer}.
            De klant kan de offerte bekijken en accepteren of afwijzen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing link */}
          {shareUrl && !isExpired && (
            <>
              <div className="space-y-2">
                <Label>Deellink</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Kopieer link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    title="Open in nieuw tabblad"
                  >
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Geldig tot {offerte.shareExpiresAt && formatDate(offerte.shareExpiresAt)}
                </span>
              </div>

              {/* Customer Response Status */}
              {offerte.customerResponse && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-muted-foreground">Klant reactie</Label>

                    <div className="flex items-center gap-2">
                      {offerte.customerResponse.status === "bekeken" && (
                        <Badge variant="secondary" className="gap-1">
                          <Eye className="h-3 w-3" />
                          Bekeken
                        </Badge>
                      )}
                      {offerte.customerResponse.status === "geaccepteerd" && (
                        <Badge className="gap-1 bg-green-600">
                          <Check className="h-3 w-3" />
                          Geaccepteerd
                        </Badge>
                      )}
                      {offerte.customerResponse.status === "afgewezen" && (
                        <Badge variant="destructive" className="gap-1">
                          Afgewezen
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(offerte.customerResponse.respondedAt)}
                      </span>
                    </div>

                    {offerte.customerResponse.comment && (
                      <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-lg">
                        <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <p className="text-sm">
                          &quot;{offerte.customerResponse.comment}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCreateLink}
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Nieuwe link
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRevokeLink}
                  disabled={isRevoking}
                  className="text-destructive hover:text-destructive"
                >
                  {isRevoking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Intrekken
                </Button>
              </div>
            </>
          )}

          {/* Expired link */}
          {shareUrl && isExpired && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                <Clock className="h-5 w-5" />
                <span>De vorige deellink is verlopen</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires">Geldigheid nieuwe link</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="expires">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dagen</SelectItem>
                    <SelectItem value="14">14 dagen</SelectItem>
                    <SelectItem value="30">30 dagen</SelectItem>
                    <SelectItem value="60">60 dagen</SelectItem>
                    <SelectItem value="90">90 dagen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleCreateLink} disabled={isCreating} className="w-full">
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Nieuwe link aanmaken
              </Button>
            </div>
          )}

          {/* No link yet */}
          {!shareUrl && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expires">Geldigheid</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="expires">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dagen</SelectItem>
                    <SelectItem value="14">14 dagen</SelectItem>
                    <SelectItem value="30">30 dagen</SelectItem>
                    <SelectItem value="60">60 dagen</SelectItem>
                    <SelectItem value="90">90 dagen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Wat kan de klant doen?</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Offerte details bekijken</li>
                  <li>Offerte accepteren of afwijzen</li>
                  <li>Vragen of opmerkingen sturen</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Sluiten
          </Button>
          {!shareUrl && (
            <Button onClick={handleCreateLink} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Link aanmaken
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
