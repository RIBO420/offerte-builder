"use client";

import { use, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  PenTool,
  Calendar,
} from "lucide-react";
import { DynamicSignaturePad as SignaturePadComponent } from "@/components/ui/signature-pad-dynamic";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

// Scope labels in Dutch
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
};

function getStatusConfig(status: string) {
  switch (status) {
    case "geaccepteerd":
      return { label: "Geaccepteerd", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
    case "afgewezen":
      return { label: "Afgewezen", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" };
    case "verzonden":
      return { label: "Wacht op reactie", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" };
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-40 mt-4" />
      </div>
    </div>
  );
}

export default function PortaalOfferteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const offerte = useQuery(api.portaal.getOfferte, {
    id: id as Id<"offertes">,
  });
  const respondToOfferte = useMutation(api.portaal.respondToOfferte);

  const [signature, setSignature] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const handleSignatureChange = useCallback((sig: string | null) => {
    setSignature(sig);
  }, []);

  const canRespond = offerte?.status === "verzonden";

  // Group regels by scope
  type RegelType = NonNullable<NonNullable<typeof offerte>["regels"]>[number];
  const regelsByScope = (offerte?.regels ?? []).reduce<Record<string, RegelType[]>>(
    (acc, regel) => {
      const scope = regel.scope ?? "overig";
      if (!acc[scope]) acc[scope] = [];
      acc[scope].push(regel);
      return acc;
    },
    {}
  );

  const optionalRegels = (offerte?.regels ?? []).filter((r) => r.optioneel);

  const handleToggleOptional = (regelId: string) => {
    setSelectedOptionalIds((prev) => {
      const next = new Set(prev);
      if (next.has(regelId)) {
        next.delete(regelId);
      } else {
        next.add(regelId);
      }
      return next;
    });
  };

  const handleAccept = async () => {
    if (!signature) {
      toast.error("Een handtekening is verplicht bij acceptatie");
      return;
    }
    setIsSubmitting(true);
    try {
      await respondToOfferte({
        offerteId: id as Id<"offertes">,
        status: "geaccepteerd",
        comment: comment || undefined,
        signature,
        selectedOptionalRegelIds: optionalRegels.length > 0
          ? Array.from(selectedOptionalIds)
          : undefined,
      });
      toast.success("Offerte geaccepteerd! Top Tuinen neemt binnenkort contact met u op.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Er is een fout opgetreden"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await respondToOfferte({
        offerteId: id as Id<"offertes">,
        status: "afgewezen",
        comment: rejectComment || undefined,
      });
      setShowRejectDialog(false);
      toast.success("Uw reactie is verstuurd naar Top Tuinen.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Er is een fout opgetreden"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (offerte === undefined) {
    return <DetailSkeleton />;
  }

  if (offerte === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Offerte niet gevonden
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Deze offerte bestaat niet of u heeft geen toegang.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/portaal/offertes">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Terug naar offertes
          </Link>
        </Button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(offerte.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0 mt-0.5">
            <Link href="/portaal/offertes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {offerte.offerteNummer}
              </h1>
              <Badge className={cn("border", statusConfig.className)}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {offerte.type === "onderhoud" ? "Onderhoud" : "Aanleg"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(offerte.verzondenAt ?? offerte.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer response banner */}
      {offerte.customerResponse?.status && (
        <Card className={cn(
          "border",
          offerte.customerResponse.status === "geaccepteerd"
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            {offerte.customerResponse.status === "geaccepteerd" ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <div>
              <p className={cn(
                "font-medium text-sm",
                offerte.customerResponse.status === "geaccepteerd"
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-red-800 dark:text-red-300"
              )}>
                {offerte.customerResponse.status === "geaccepteerd"
                  ? "U heeft deze offerte geaccepteerd"
                  : "U heeft deze offerte afgewezen"}
              </p>
              {offerte.customerResponse.respondedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatDate(offerte.customerResponse.respondedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line items grouped by scope */}
      <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Specificatie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(regelsByScope).map(([scope, regels]) => (
            <div key={scope}>
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#4ADE80]" />
                {scopeLabels[scope] ?? scope}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                      {optionalRegels.length > 0 && (
                        <th className="pb-2 pr-2 w-8" />
                      )}
                      <th className="pb-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">
                        Omschrijving
                      </th>
                      <th className="pb-2 pr-4 text-gray-500 dark:text-gray-400 font-medium text-right">
                        Aantal
                      </th>
                      <th className="pb-2 pr-4 text-gray-500 dark:text-gray-400 font-medium text-right">
                        Prijs
                      </th>
                      <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium text-right">
                        Totaal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regels.map((regel, index) => {
                      const lineTotal = regel.hoeveelheid * regel.prijsPerEenheid;
                      const isOptional = regel.optioneel;
                      const isSelected = regel.id
                        ? selectedOptionalIds.has(regel.id)
                        : false;

                      return (
                        <tr
                          key={regel.id ?? index}
                          className={cn(
                            "border-b border-gray-50 dark:border-gray-800/50 last:border-0",
                            isOptional && !isSelected && canRespond && "opacity-50"
                          )}
                        >
                          {optionalRegels.length > 0 && (
                            <td className="py-2.5 pr-2">
                              {isOptional && canRespond && regel.id && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    handleToggleOptional(regel.id!)
                                  }
                                  aria-label={`Selecteer ${regel.omschrijving}`}
                                />
                              )}
                            </td>
                          )}
                          <td className="py-2.5 pr-4 text-gray-900 dark:text-white">
                            {regel.omschrijving}
                            {isOptional && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                              >
                                Optioneel
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {regel.hoeveelheid} {regel.eenheid}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {formatCurrency(regel.prijsPerEenheid)}
                          </td>
                          <td className="py-2.5 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Totals */}
          {offerte.totalen && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Subtotaal (excl. BTW)</span>
                  <span>{formatCurrency(offerte.totalen.totaalExBtw)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>BTW (21%)</span>
                  <span>{formatCurrency(offerte.totalen.btw)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
                  <span>Totaal (incl. BTW)</span>
                  <span>{formatCurrency(offerte.totalen.totaalInclBtw)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {offerte.notities && (
        <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white">
              Opmerkingen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {offerte.notities}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Accept/Reject actions */}
      {canRespond && (
        <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <PenTool className="h-5 w-5 text-[#4ADE80]" />
              Uw reactie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Comment field */}
            <div className="space-y-2">
              <label
                htmlFor="comment"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Opmerking (optioneel)
              </label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Heeft u nog opmerkingen of vragen?"
                className="resize-none"
                rows={3}
              />
            </div>

            {/* Signature pad */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Handtekening (verplicht bij acceptatie)
              </label>
              <SignaturePadComponent
                onSignatureChange={handleSignatureChange}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleAccept}
                disabled={isSubmitting || !signature}
                className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black flex-1"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Offerte accepteren
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                disabled={isSubmitting}
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Offerte afwijzen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject confirmation dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offerte afwijzen</DialogTitle>
            <DialogDescription>
              Weet u zeker dat u deze offerte wilt afwijzen? U kunt optioneel een
              reden opgeven.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="reject-comment"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Reden (optioneel)
            </label>
            <Textarea
              id="reject-comment"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Laat ons weten waarom u de offerte afwijst..."
              className="resize-none"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isSubmitting}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Afwijzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
