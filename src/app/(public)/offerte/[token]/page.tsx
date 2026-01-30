"use client";

import { use, useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Loader2,
  Building2,
  MapPin,
  Phone,
  Mail,
  Shovel,
  Trees,
  Send,
  PenTool,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePadComponent } from "@/components/ui/signature-pad";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return formatTime(timestamp);
  }
  return `${date.getDate()}/${date.getMonth() + 1} ${formatTime(timestamp)}`;
}

const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  houtwerk: "Houtwerk",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  gras: "Gazon",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800",
  definitief: "bg-blue-100 text-blue-800",
  verzonden: "bg-purple-100 text-purple-800",
  geaccepteerd: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
};

export default function PublicOffertePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const data = useQuery(api.publicOffertes.getByToken, { token });
  const messages = useQuery(api.offerteMessages.listByToken, { token });
  const markAsViewed = useMutation(api.publicOffertes.markAsViewed);
  const markMessagesAsRead = useMutation(api.offerteMessages.markCustomerMessagesAsRead);
  const respond = useMutation(api.publicOffertes.respond);
  const sendMessage = useMutation(api.offerteMessages.sendFromCustomer);

  const [comment, setComment] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [hasMarkedViewed, setHasMarkedViewed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark as viewed when page loads
  useEffect(() => {
    if (data && !data.expired && data.offerte && !hasMarkedViewed) {
      markAsViewed({ token }).catch(console.error);
      markMessagesAsRead({ token }).catch(console.error);
      setHasMarkedViewed(true);
    }
  }, [data, token, markAsViewed, markMessagesAsRead, hasMarkedViewed]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when new ones come in
  useEffect(() => {
    if (messages && messages.length > 0) {
      markMessagesAsRead({ token }).catch(console.error);
    }
  }, [messages, token, markMessagesAsRead]);

  const handleAccept = async () => {
    if (!signature) {
      return;
    }
    setIsSubmitting(true);
    try {
      await respond({ token, status: "geaccepteerd", comment: comment || undefined, signature });
      setShowAcceptDialog(false);
      setComment("");
      setSignature(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await respond({ token, status: "afgewezen", comment: comment || undefined });
      setShowRejectDialog(false);
      setComment("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    setIsSendingMessage(true);
    try {
      await sendMessage({ token, message: chatMessage.trim() });
      setChatMessage("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Loading state
  if (data === undefined) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found
  if (data === null) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-6 text-2xl font-semibold">Offerte niet gevonden</h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Deze link is ongeldig of de offerte bestaat niet meer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (data.expired) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="h-16 w-16 text-amber-500" />
            <h2 className="mt-6 text-2xl font-semibold">Link verlopen</h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Deze deellink is verlopen. Neem contact op met het bedrijf.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { offerte, bedrijfsgegevens } = data;

  if (!offerte) {
    return null;
  }

  const hasResponded =
    offerte.customerResponse?.status === "geaccepteerd" ||
    offerte.customerResponse?.status === "afgewezen";

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        {bedrijfsgegevens?.naam && (
          <h1 className="text-3xl font-bold text-primary mb-2">
            {bedrijfsgegevens.naam}
          </h1>
        )}
        <p className="text-muted-foreground">
          Offerte voor {offerte.klant.naam}
        </p>
      </div>

      {/* Status Banner */}
      {hasResponded && (
        <Card className={`mb-6 ${offerte.customerResponse?.status === "geaccepteerd" ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-red-500 bg-red-50 dark:bg-red-950/30"}`}>
          <CardContent className="flex items-center gap-4 py-4">
            {offerte.customerResponse?.status === "geaccepteerd" ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
            <div className="flex-1">
              <p className="font-semibold">
                {offerte.customerResponse?.status === "geaccepteerd"
                  ? "U heeft deze offerte geaccepteerd"
                  : "U heeft deze offerte afgewezen"}
              </p>
              {offerte.customerResponse?.signedAt && (
                <p className="text-sm text-muted-foreground">
                  Ondertekend op {formatDate(offerte.customerResponse.signedAt)}
                </p>
              )}
            </div>
            {offerte.customerResponse?.signature && (
              <div className="bg-white rounded border p-2">
                <img
                  src={offerte.customerResponse.signature}
                  alt="Handtekening"
                  className="h-12 w-auto"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Offerte Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Offerte Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${offerte.type === "aanleg" ? "bg-primary/10" : "bg-green-100"}`}>
                    {offerte.type === "aanleg" ? (
                      <Shovel className="h-6 w-6 text-primary" />
                    ) : (
                      <Trees className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                  <div>
                    <CardTitle>{offerte.offerteNummer}</CardTitle>
                    <CardDescription>
                      {offerte.type === "aanleg" ? "Tuinaanleg" : "Tuinonderhoud"} offerte
                    </CardDescription>
                  </div>
                </div>
                <Badge className={statusColors[offerte.status]}>
                  {statusLabels[offerte.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Aangemaakt op {formatDate(offerte.createdAt)}
              </p>
            </CardContent>
          </Card>

          {/* Werkzaamheden */}
          {offerte.scopes && offerte.scopes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Werkzaamheden</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {offerte.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {scopeLabels[scope] || scope}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regels */}
          {offerte.regels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Specificatie</CardTitle>
                <CardDescription>
                  {offerte.regels.length} post{offerte.regels.length !== 1 ? "en" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Omschrijving</TableHead>
                      <TableHead className="text-right">Hoeveelheid</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offerte.regels.map((regel, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <p className="font-medium">{regel.omschrijving}</p>
                          <p className="text-xs text-muted-foreground">
                            {scopeLabels[regel.scope] || regel.scope}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          {regel.hoeveelheid} {regel.eenheid}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(regel.totaal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Chat Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Berichten
              </CardTitle>
              <CardDescription>
                Stel vragen of bespreek de offerte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 rounded-md border p-4">
                {messages && messages.length > 0 ? (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={cn(
                          "flex",
                          msg.sender === "klant" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2",
                            msg.sender === "klant"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              msg.sender === "klant"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatDateTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Nog geen berichten</p>
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2 mt-4">
                <Input
                  placeholder="Typ een bericht..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSendingMessage}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isSendingMessage}
                >
                  {isSendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Totals & Actions */}
        <div className="space-y-6">
          {/* Totals Card */}
          <Card>
            <CardHeader>
              <CardTitle>Totalen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotaal</span>
                <span>{formatCurrency(offerte.totalen.totaalExBtw)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BTW (21%)</span>
                <span>{formatCurrency(offerte.totalen.btw)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Totaal</span>
                <span className="text-primary">
                  {formatCurrency(offerte.totalen.totaalInclBtw)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Business Contact */}
          {bedrijfsgegevens && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium">{bedrijfsgegevens.naam}</p>
                {bedrijfsgegevens.adres && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {bedrijfsgegevens.adres}, {bedrijfsgegevens.postcode} {bedrijfsgegevens.plaats}
                  </p>
                )}
                {bedrijfsgegevens.telefoon && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {bedrijfsgegevens.telefoon}
                  </p>
                )}
                {bedrijfsgegevens.email && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {bedrijfsgegevens.email}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Card */}
          {!hasResponded && (
            <Card>
              <CardHeader>
                <CardTitle>Uw reactie</CardTitle>
                <CardDescription>
                  Accepteer of wijs de offerte af
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setShowAcceptDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accepteren
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Afwijzen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>
          Deze offerte is geldig tot 30 dagen na verzending.
        </p>
      </div>

      {/* Accept Dialog with Signature */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Offerte accepteren
            </DialogTitle>
            <DialogDescription>
              Door te accepteren gaat u akkoord met de werkzaamheden en prijzen.
              Uw handtekening is verplicht.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Uw handtekening *</Label>
              <SignaturePadComponent onSignatureChange={setSignature} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accept-comment">Opmerking (optioneel)</Label>
              <Textarea
                id="accept-comment"
                placeholder="Eventuele opmerkingen..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)} disabled={isSubmitting}>
              Annuleren
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isSubmitting || !signature}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PenTool className="mr-2 h-4 w-4" />
              )}
              Ondertekenen & Accepteren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Offerte afwijzen
            </DialogTitle>
            <DialogDescription>
              Laat ons weten waarom u de offerte afwijst, zodat we eventueel een
              aangepast voorstel kunnen doen.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="reject-comment">Reden (optioneel)</Label>
            <Textarea
              id="reject-comment"
              placeholder="Waarom wijst u de offerte af?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isSubmitting}>
              Annuleren
            </Button>
            <Button
              onClick={handleReject}
              disabled={isSubmitting}
              variant="destructive"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Afwijzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
