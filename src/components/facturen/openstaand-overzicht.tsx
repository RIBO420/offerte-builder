"use client";

/**
 * Openstaande-postenoverzicht (PRD §3.2): de facturenlijst ís het
 * debiteurenoverzicht. Per openstaande factuur: "verschuldigd sinds"
 * (ouderdomsbadge), huidig aanmaanniveau, gepauzeerd-indicator en
 * kantoor-acties (pauzeren met reden, hervatten, trede overslaan),
 * plus totalen per ouderdomsbucket.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton-card";
import {
  PauseCircle,
  PlayCircle,
  SkipForward,
  Euro,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";

const BUCKET_LABELS: Record<string, string> = {
  "0_14": "0–14 dagen",
  "14_30": "14–30 dagen",
  "30_60": "30–60 dagen",
  "60_plus": "60+ dagen",
};

const BUCKET_BADGE: Record<string, string> = {
  "0_14": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "14_30": "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "30_60": "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  "60_plus": "bg-red-600 text-white dark:bg-red-700 dark:text-red-50",
};

const ESCALATIE_LABELS: Record<string, string> = {
  mail: "herinneringsmail",
  interne_taak: "interne taak",
};

interface OpenstaandOverzichtProps {
  isKantoor: boolean;
}

export function OpenstaandOverzicht({ isKantoor }: OpenstaandOverzichtProps) {
  const data = useQuery(api.debiteuren.getOpenstaand, {});
  const pauzeer = useMutation(api.debiteuren.pauzeerLadder);
  const hervat = useMutation(api.debiteuren.hervatLadder);
  const slaOver = useMutation(api.debiteuren.slaTredeOver);

  const [pauzeFactuurId, setPauzeFactuurId] =
    useState<Id<"facturen"> | null>(null);
  const [pauzeReden, setPauzeReden] = useState("");
  const [bezig, setBezig] = useState(false);

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { posten, totalen } = data;

  const handlePauzeer = async () => {
    if (!pauzeFactuurId) return;
    if (!pauzeReden.trim()) {
      toast.error("Geef een reden op (bijv. betalingsafspraak)");
      return;
    }
    setBezig(true);
    try {
      await pauzeer({ factuurId: pauzeFactuurId, reden: pauzeReden.trim() });
      toast.success("Debiteurenladder gepauzeerd voor deze factuur");
      setPauzeFactuurId(null);
      setPauzeReden("");
    } catch {
      toast.error("Pauzeren mislukt");
    } finally {
      setBezig(false);
    }
  };

  const handleHervat = async (factuurId: Id<"facturen">) => {
    try {
      await hervat({ factuurId });
      toast.success("Debiteurenladder hervat");
    } catch {
      toast.error("Hervatten mislukt");
    }
  };

  const handleSlaOver = async (factuurId: Id<"facturen">) => {
    try {
      const res = await slaOver({ factuurId });
      toast.success(`Trede ${res.overgeslagenTrede} overgeslagen`);
    } catch {
      toast.error("Trede overslaan mislukt");
    }
  };

  return (
    <div className="space-y-6">
      {/* Totalen: openstaand bedrag + ouderdomsbuckets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Euro className="h-4 w-4" /> Totaal openstaand
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(totalen.totaalOpenstaand)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            {totalen.aantal}{" "}
            {totalen.aantal === 1 ? "factuur" : "facturen"}
          </CardContent>
        </Card>
        {(["0_14", "14_30", "30_60", "60_plus"] as const).map((bucket) => (
          <Card key={bucket}>
            <CardHeader className="pb-2">
              <CardDescription>
                <Badge className={BUCKET_BADGE[bucket]}>
                  {BUCKET_LABELS[bucket]}
                </Badge>
              </CardDescription>
              <CardTitle className="text-2xl">
                {formatCurrency(totalen.buckets[bucket]?.bedrag ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {totalen.buckets[bucket]?.aantal ?? 0}{" "}
              {(totalen.buckets[bucket]?.aantal ?? 0) === 1
                ? "factuur"
                : "facturen"}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Openstaande posten */}
      <Card>
        <CardHeader>
          <CardTitle>Openstaande posten</CardTitle>
          <CardDescription>
            Verzonden facturen die nog (deels) openstaan — de
            debiteurenladder verstuurt automatisch herinneringen als concept
            en maakt bij trede 3 een interne taak aan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {posten.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10 text-muted-foreground" />}
              title="Geen openstaande posten"
              description="Alle verzonden facturen zijn betaald. Mooi zo!"
            />
          ) : (
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factuur</TableHead>
                    <TableHead>Klant</TableHead>
                    <TableHead className="text-right">Openstaand</TableHead>
                    <TableHead>Verschuldigd sinds</TableHead>
                    <TableHead>Aanmaanniveau</TableHead>
                    <TableHead>Ladder</TableHead>
                    {isKantoor && (
                      <TableHead className="text-right">Acties</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posten.map((post) => (
                    <TableRow key={post.factuurId}>
                      <TableCell>
                        <Link
                          href={`/facturen?zoek=${encodeURIComponent(post.factuurnummer)}`}
                          className="font-medium hover:underline"
                        >
                          {post.factuurnummer}
                        </Link>
                        {post.betaalStatus === "gedeeltelijk_betaald" && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            deels betaald
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{post.klantNaam}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(post.openstaandBedrag)}
                      </TableCell>
                      <TableCell>
                        <Badge className={BUCKET_BADGE[post.bucket]}>
                          {post.dagenVerschuldigd === 0
                            ? "nog niet vervallen"
                            : `${post.dagenVerschuldigd} ${
                                post.dagenVerschuldigd === 1 ? "dag" : "dagen"
                              }`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {post.aanmaanniveau > 0 ? (
                          <Badge variant="secondary">
                            Trede {post.aanmaanniveau}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {post.volgendeTrede && !post.gepauzeerd && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            volgende:{" "}
                            {ESCALATIE_LABELS[post.volgendeTrede.escalatie]}{" "}
                            (dag {post.volgendeTrede.opDagen})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {post.gepauzeerd ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700 dark:text-amber-300"
                            title={post.pauzeReden ?? undefined}
                          >
                            <PauseCircle className="mr-1 h-3 w-3" />
                            Gepauzeerd
                          </Badge>
                        ) : (
                          <Badge variant="outline">Actief</Badge>
                        )}
                        {post.gepauzeerd && post.pauzeReden && (
                          <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                            {post.pauzeReden}
                          </p>
                        )}
                      </TableCell>
                      {isKantoor && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {post.gepauzeerd ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleHervat(post.factuurId)}
                                title="Ladder hervatten"
                              >
                                <PlayCircle className="mr-1 h-4 w-4" />
                                Hervatten
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPauzeFactuurId(post.factuurId);
                                  setPauzeReden("");
                                }}
                                title="Ladder pauzeren (bijv. betalingsafspraak)"
                              >
                                <PauseCircle className="mr-1 h-4 w-4" />
                                Pauzeren
                              </Button>
                            )}
                            {post.volgendeTrede && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSlaOver(post.factuurId)}
                                title={`Trede ${post.volgendeTrede.trede} overslaan`}
                              >
                                <SkipForward className="mr-1 h-4 w-4" />
                                Trede overslaan
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </CardContent>
      </Card>

      {/* Pauzeer-dialog met verplichte reden */}
      <Dialog
        open={pauzeFactuurId !== null}
        onOpenChange={(open) => {
          if (!open) setPauzeFactuurId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debiteurenladder pauzeren</DialogTitle>
            <DialogDescription>
              De automatische herinneringen voor deze factuur worden
              stopgezet tot u de ladder hervat. De reden is zichtbaar op de
              factuur en de klanttijdlijn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pauze-reden">Reden (verplicht)</Label>
            <Textarea
              id="pauze-reden"
              placeholder="Bijv. betalingsafspraak: klant betaalt in twee termijnen"
              value={pauzeReden}
              onChange={(e) => setPauzeReden(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPauzeFactuurId(null)}
              disabled={bezig}
            >
              Annuleren
            </Button>
            <Button onClick={handlePauzeer} disabled={bezig}>
              <PauseCircle className="mr-1 h-4 w-4" />
              Pauzeren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
