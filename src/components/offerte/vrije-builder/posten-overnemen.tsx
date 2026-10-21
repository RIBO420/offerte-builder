"use client";

/**
 * Posten overnemen in de vrije builder (HERO-nabouw fase 6): uit een
 * sjabloon of een eerdere offerte (dezelfde klant eerst). Je kiest de
 * regels; ze komen met nieuwe id's achter de bestaande regels. Optie:
 * hoeveelheden op nul, zoals in HERO.
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Copy } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { berekenRegelTotaal, type VrijeRegel } from "../../../../convex/vrijeOfferteBerekening";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format/currency";

type Bron = { soort: "sjabloon"; id: Id<"standaardtuinen"> } | { soort: "offerte"; id: Id<"offertes"> };

export function PostenOvernemen({
  offerteId,
  onOvernemen,
  disabled,
}: {
  offerteId: Id<"offertes">;
  onOvernemen: (regels: VrijeRegel[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <Copy className="mr-2 h-4 w-4" />
        Posten overnemen
      </Button>
      {open && (
        <PostenDialog
          offerteId={offerteId}
          onSluit={() => setOpen(false)}
          onOvernemen={(r) => {
            onOvernemen(r);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function PostenDialog({
  offerteId,
  onSluit,
  onOvernemen,
}: {
  offerteId: Id<"offertes">;
  onSluit: () => void;
  onOvernemen: (regels: VrijeRegel[]) => void;
}) {
  const bronnen = useQuery(api.offertePosten.bronnen, { offerteId });
  const [bron, setBron] = useState<Bron | null>(null);
  const regels = useQuery(
    api.offertePosten.regelsVan,
    bron
      ? bron.soort === "sjabloon"
        ? { sjabloonId: bron.id }
        : { offerteId: bron.id }
      : "skip"
  );
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [nulHoeveelheid, setNulHoeveelheid] = useState(false);

  const kies = (b: Bron) => {
    setBron(b);
    setGekozen(new Set());
  };
  const alleGekozen = !!regels && regels.length > 0 && gekozen.size === regels.length;

  const overnemen = () => {
    if (!regels) return;
    const basis = Date.now().toString(36);
    const nieuw = regels
      .filter((r) => gekozen.has(r.id))
      .map((r, i) => {
        const hoeveelheid = nulHoeveelheid ? 0 : r.hoeveelheid;
        return {
          ...(r as unknown as VrijeRegel),
          id: `${basis}-${i}`,
          productId: r.productId as string | undefined,
          hoeveelheid,
          totaal: berekenRegelTotaal(hoeveelheid, r.prijsPerEenheid, r.kortingPercentage),
        };
      });
    onOvernemen(nieuw);
  };

  const lijst = useMemo(
    () => [
      ...(bronnen?.sjablonen ?? []).map((s) => ({
        key: `s-${s._id}`,
        bron: { soort: "sjabloon", id: s._id } as Bron,
        titel: s.naam,
        sub: `Sjabloon · ${s.aantalRegels} regels · ${formatCurrency(s.netto)}`,
      })),
      ...(bronnen?.offertes ?? []).map((o) => ({
        key: `o-${o._id}`,
        bron: { soort: "offerte", id: o._id } as Bron,
        titel: `${o.offerteNummer}${o.klantNaam ? ` · ${o.klantNaam}` : ""}`,
        sub: `${o.zelfdeKlant ? "Zelfde klant · " : ""}${o.aantalRegels} regels · ${formatCurrency(o.netto)}`,
      })),
    ],
    [bronnen]
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onSluit()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Posten overnemen</DialogTitle>
          <DialogDescription>
            Uit een sjabloon of een eerdere offerte. De regels komen achter de bestaande regels.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
          <ul className="max-h-[55vh] space-y-1 overflow-y-auto" aria-label="Bron">
            {lijst.map((item) => {
              const actief = bron?.id === item.bron.id;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => kies(item.bron)}
                    aria-pressed={actief}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${actief ? "bg-accent font-medium" : ""}`}
                  >
                    <span className="block truncate">{item.titel}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>
                  </button>
                </li>
              );
            })}
            {bronnen && lijst.length === 0 && (
              <li className="px-2 text-sm text-muted-foreground">Nog geen sjablonen of eerdere offertes.</li>
            )}
          </ul>
          <div className="min-w-0 space-y-2">
            {!bron ? (
              <p className="text-sm text-muted-foreground">Kies links een sjabloon of offerte.</p>
            ) : !regels ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={alleGekozen}
                    onCheckedChange={(c) => setGekozen(c ? new Set(regels.map((r) => r.id)) : new Set())}
                  />
                  Alles ({regels.length})
                </label>
                <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
                  {regels.map((r) => (
                    <li key={r.id}>
                      <label className="flex items-start gap-2 px-2 py-1.5 text-sm">
                        <Checkbox
                          className="mt-0.5"
                          checked={gekozen.has(r.id)}
                          onCheckedChange={(c) =>
                            setGekozen((h) => {
                              const n = new Set(h);
                              if (c) n.add(r.id);
                              else n.delete(r.id);
                              return n;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.omschrijving}</span>
                          <span className="block text-xs text-muted-foreground">
                            {r.scope} · {r.hoeveelheid.toLocaleString("nl-NL")} {r.eenheid}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(r.totaal)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={nulHoeveelheid} onCheckedChange={(c) => setNulHoeveelheid(!!c)} />
                  Hoeveelheden op nul zetten
                </label>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onSluit}>
            Annuleren
          </Button>
          <Button onClick={overnemen} disabled={gekozen.size === 0}>
            {gekozen.size > 0 ? `${gekozen.size} regels overnemen` : "Overnemen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
