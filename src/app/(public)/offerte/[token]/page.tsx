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
  Calendar,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicSignaturePad as SignaturePadComponent } from "@/components/ui/signature-pad-dynamic";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  borders: "Borders & Beplanting",
  houtwerk: "Houtwerk",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  water_elektra: "Water / Elektra",
  specials: "Specials",
  gras: "Gras / Gazon",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

// Customer-friendly summary with visible line items
interface ScopeLineItem {
  omschrijving: string;
  hoeveelheid?: number;
  eenheid?: string;
}

interface ScopeSummary {
  scope: string;
  scopeLabel: string;
  totaal: number;
  visibleItems: ScopeLineItem[];
  hasHiddenItems: boolean;
}

// Units that should always be shown with quantities
const visibleUnits = ['m²', 'm2', 'm³', 'm3', 'm', 'stuks', 'st'];

// Keywords for major materials that should be shown
const majorMaterialKeywords = [
  'tegel', 'tegels', 'klinker', 'klinkers', 'natuursteen',
  'schutting', 'scherm', 'vlonder', 'pergola', 'overkapping',
  'graszoden', 'graszod', 'gazon',
  'plant', 'planten', 'boom', 'bomen', 'heester', 'heesters', 'haag', 'heg',
  'zand', 'grond', 'grind', 'split', 'compost', 'tuinaarde',
  'opsluitband', 'opsluitbanden', 'kantopsluiting',
  'vijver', 'waterpartij', 'fontein',
  'verlichting', 'lamp', 'armatuur',
];

// Keywords for small materials that should be hidden (grouped as kleinmateriaal)
const kleinmateriaalKeywords = [
  'kabel', 'kabels', 'draad', 'snoer',
  'stopcontact', 'schakelaar', 'fitting', 'dimmer',
  'buis', 'buizen', 'pvc', 'leiding',
  'schroef', 'schroeven', 'bout', 'bouten', 'moer', 'moeren',
  'spijker', 'spijkers', 'nagel', 'nagels',
  'kit', 'lijm', 'tape',
  'koppeling', 'connector', 'aansluiting',
  'kleinmateriaal', 'bevestiging', 'bevestigingsmateriaal',
];

interface RegelInput {
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  totaal: number;
  type: string;
}

function shouldShowItem(regel: RegelInput): boolean {
  const omschrijvingLower = regel.omschrijving.toLowerCase();
  const eenheidLower = regel.eenheid.toLowerCase();

  // Always hide labor items
  if (regel.type === 'arbeid' || omschrijvingLower.startsWith('arbeid')) {
    return false;
  }

  // Show items with area/volume/length units
  if (visibleUnits.some(unit => eenheidLower.includes(unit.toLowerCase()))) {
    return true;
  }

  // Check if it's kleinmateriaal (hide these)
  if (kleinmateriaalKeywords.some(kw => omschrijvingLower.includes(kw))) {
    return false;
  }

  // Check if it's a major material (show these)
  if (majorMaterialKeywords.some(kw => omschrijvingLower.includes(kw))) {
    return true;
  }

  // Default: hide other small items
  return false;
}

function summarizeRegelsByScope(regels: RegelInput[]): ScopeSummary[] {
  const scopeMap = new Map<string, ScopeSummary>();

  for (const regel of regels) {
    const existing = scopeMap.get(regel.scope);
    const isVisible = shouldShowItem(regel);

    const lineItem: ScopeLineItem | null = isVisible ? {
      omschrijving: regel.omschrijving,
      hoeveelheid: regel.hoeveelheid,
      eenheid: regel.eenheid,
    } : null;

    if (existing) {
      existing.totaal += regel.totaal;
      if (lineItem && !existing.visibleItems.some(item =>
        item.omschrijving === lineItem.omschrijving && item.hoeveelheid === lineItem.hoeveelheid
      )) {
        existing.visibleItems.push(lineItem);
      }
      if (!isVisible) {
        existing.hasHiddenItems = true;
      }
    } else {
      scopeMap.set(regel.scope, {
        scope: regel.scope,
        scopeLabel: scopeLabels[regel.scope] || regel.scope,
        totaal: regel.totaal,
        visibleItems: lineItem ? [lineItem] : [],
        hasHiddenItems: !isVisible,
      });
    }
  }

  // Sort by scope order and return
  const scopeOrder = ['grondwerk', 'bestrating', 'borders', 'gras', 'houtwerk', 'water_elektra', 'specials', 'heggen', 'bomen', 'overig'];
  return Array.from(scopeMap.values()).sort((a, b) => {
    const aIndex = scopeOrder.indexOf(a.scope);
    const bIndex = scopeOrder.indexOf(b.scope);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

function formatLineItems(summary: ScopeSummary): string {
  const parts: string[] = [];

  // Add visible items with quantities
  for (const item of summary.visibleItems.slice(0, 4)) {
    if (item.hoeveelheid && item.eenheid) {
      parts.push(`${item.hoeveelheid} ${item.eenheid} ${item.omschrijving}`);
    } else {
      parts.push(item.omschrijving);
    }
  }

  if (summary.visibleItems.length > 4) {
    parts.push('e.a.');
  }

  // Add note about hidden items
  if (summary.hasHiddenItems && parts.length > 0) {
    parts.push('incl. kleinmateriaal en arbeid');
  } else if (summary.hasHiddenItems) {
    return 'Inclusief materiaal en arbeid';
  }

  return parts.length > 0 ? parts.join(', ') : 'Inclusief materiaal en arbeid';
}

const statusLabels: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800",
  voorcalculatie: "bg-blue-100 text-blue-800",
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
      // Non-critical operations - silent fail is acceptable
      markAsViewed({ token }).catch(() => {});
      markMessagesAsRead({ token }).catch(() => {});
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
      // Non-critical operation - silent fail is acceptable
      markMessagesAsRead({ token }).catch(() => {});
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
      toast.success("Offerte geaccepteerd");
    } catch {
      toast.error("Kon offerte niet accepteren. Probeer het opnieuw.");
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
      toast.success("Offerte afgewezen");
    } catch {
      toast.error("Kon offerte niet afwijzen. Probeer het opnieuw.");
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
    } catch {
      toast.error("Kon bericht niet verzenden. Probeer het opnieuw.");
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

  const { offerte, bedrijfsgegevens, voorcalculatie } = data;

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
              <div className="flex items-center justify-center max-h-16 overflow-hidden">
                {/* Using img for base64 data URLs (signatures) - not suitable for next/image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={offerte.customerResponse.signature}
                  alt="Handtekening"
                  className="max-w-full max-h-16 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                  loading="lazy"
                  decoding="async"
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

          {/* Werkzaamheden - Customer-friendly summarized view */}
          {offerte.regels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Werkzaamheden</CardTitle>
                <CardDescription>
                  Overzicht van de geoffreerde werkzaamheden
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Onderdeel</TableHead>
                      <TableHead className="hidden sm:table-cell">Omschrijving</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summarizeRegelsByScope(offerte.regels as RegelInput[]).map((summary) => (
                      <TableRow key={summary.scope}>
                        <TableCell>
                          <p className="font-medium">{summary.scopeLabel}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {formatLineItems(summary)}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {formatLineItems(summary)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(summary.totaal)}
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
                            "max-w-[95%] sm:max-w-[80%] rounded-lg px-4 py-2",
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

          {/* Planning Info Card */}
          {voorcalculatie && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Planning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Geschatte projectduur</span>
                  <span className="font-medium">{voorcalculatie.geschatteDagen} werkdagen</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Geschatte uren</span>
                  <span className="font-medium">{Math.round(voorcalculatie.normUrenTotaal)} uur</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Teamgrootte
                  </span>
                  <span className="font-medium">{voorcalculatie.teamGrootte} personen</span>
                </div>
                {voorcalculatie.normUrenPerScope && Object.keys(voorcalculatie.normUrenPerScope).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Uren per onderdeel</p>
                      {Object.entries(voorcalculatie.normUrenPerScope).map(([scope, hours]) => (
                        <div key={scope} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{scopeLabels[scope] || scope}</span>
                          <span>{Math.round(hours as number)} uur</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

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
