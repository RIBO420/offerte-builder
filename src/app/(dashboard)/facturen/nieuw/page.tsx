"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { RequireRole } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VrijeRegelEditor } from "@/components/offerte/vrije-builder";
import { formatCurrency } from "@/lib/format/currency";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { VrijeRegel } from "../../../../../convex/vrijeOfferteBerekening";
import { berekenBtwUitsplitsing } from "../../../../../convex/facturatieLogica";

/**
 * Losse factuur via de herbruikbare vrije regel-editor (PRD §2.8 punt 5).
 * Zelfde editor als route 2 van de offertes (artikel-picker, hoofdstukken,
 * korting, marge-verbod op prijs-op-regel-artikelen); het resultaat is een
 * concept-factuur in de "Te versturen"-wachtrij. Zelfde PDF-huisstijl,
 * bewust geen opmaakknoppen.
 */
export default function NieuweFactuurPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <NieuweFactuurContent />
    </RequireRole>
  );
}

function NieuweFactuurContent() {
  const router = useRouter();
  const klanten = useQuery(api.klanten.list, {});
  const createVrij = useMutation(api.facturen.createVrij);

  const [klantId, setKlantId] = useState<string>("");
  const [regels, setRegels] = useState<VrijeRegel[]>([]);
  const [datumVanDienst, setDatumVanDienst] = useState("");
  const [notities, setNotities] = useState("");
  const [bezig, setBezig] = useState(false);

  // Btw-uitsplitsing per tarief, live meerekend (§2.8 punt 4).
  // Regels zonder btwCode tellen als 21% (arbeid/materiaal aanleg-default).
  const totalen = useMemo(() => {
    const uitsplitsing = berekenBtwUitsplitsing(regels, 21);
    const subtotaal = uitsplitsing.reduce((s, u) => s + u.grondslag, 0);
    const btw = uitsplitsing.reduce((s, u) => s + u.bedrag, 0);
    return { uitsplitsing, subtotaal, btw, totaal: subtotaal + btw };
  }, [regels]);

  const kanOpslaan = klantId !== "" && regels.length > 0 && !bezig;

  const handleOpslaan = async () => {
    if (!kanOpslaan) return;
    setBezig(true);
    try {
      const factuurId = await createVrij({
        klantId: klantId as Id<"klanten">,
        regels: regels.map((regel) => ({
          id: regel.id,
          omschrijving: regel.omschrijving,
          eenheid: regel.eenheid,
          hoeveelheid: regel.hoeveelheid,
          prijsPerEenheid: regel.prijsPerEenheid,
          totaal: regel.totaal,
          btwCode: regel.btwCode,
          scope: regel.scope,
          kortingPercentage: regel.kortingPercentage,
        })),
        datumVanDienst: datumVanDienst || undefined,
        notities: notities.trim() || undefined,
      });
      toast.success("Concept-factuur aangemaakt — klaar voor de laatste check");
      void factuurId;
      router.push("/facturen");
    } catch {
      toast.error("Factuur aanmaken mislukt");
      setBezig(false);
    }
  };

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => router.push("/facturen")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Terug naar facturen
            </Button>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Nieuwe factuur
            </h1>
            <p className="text-muted-foreground">
              Losse factuur via de vrije regel-editor — landt als concept in
              &quot;Te versturen&quot;
            </p>
          </div>
          <Button onClick={handleOpslaan} disabled={!kanOpslaan}>
            <FilePlus2 className="h-4 w-4 mr-2" />
            {bezig ? "Bezig…" : "Maak concept-factuur"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Factuurgegevens</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="klant-select">
                    Klant
                  </label>
                  <Select value={klantId} onValueChange={setKlantId}>
                    <SelectTrigger id="klant-select">
                      <SelectValue placeholder="Kies een klant" />
                    </SelectTrigger>
                    <SelectContent>
                      {(klanten ?? []).map((klant) => (
                        <SelectItem key={klant._id} value={klant._id}>
                          {klant.naam} — {klant.plaats}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="datum-dienst">
                    Datum van dienst (optioneel)
                  </label>
                  <Input
                    id="datum-dienst"
                    type="date"
                    value={datumVanDienst}
                    onChange={(e) => setDatumVanDienst(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="notities">
                    Notities (optioneel)
                  </label>
                  <Textarea
                    id="notities"
                    rows={2}
                    value={notities}
                    onChange={(e) => setNotities(e.target.value)}
                    placeholder="Interne notitie of tekst onderaan de factuur"
                  />
                </div>
              </CardContent>
            </Card>

            <VrijeRegelEditor regels={regels} onChange={setRegels} />
          </div>

          {/* Totalenblok met btw-uitsplitsing per tarief (§2.8 punt 4) */}
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-base">Totalen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotaal excl. btw</span>
                <span className="font-medium">
                  {formatCurrency(totalen.subtotaal)}
                </span>
              </div>
              {totalen.uitsplitsing.map((u) => (
                <div className="flex justify-between" key={u.percentage}>
                  <span className="text-muted-foreground">
                    Btw {u.percentage}% (over {formatCurrency(u.grondslag)})
                  </span>
                  <span>{formatCurrency(u.bedrag)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Totaal incl. btw</span>
                <span>{formatCurrency(totalen.totaal)}</span>
              </div>
              <p className="pt-2 text-xs text-muted-foreground">
                De factuur wordt als concept aangemaakt; versturen gebeurt
                vanuit de wachtrij &quot;Te versturen&quot;.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
