"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * "Beschrijving op offerte" onder een vrije regel: de offertetekst uit het
 * prijsboek (of zelf geschreven) die de klant klein onder de regel op de
 * offerte- en factuur-PDF ziet. Standaard ingeklapt tot één rustige regel
 * met een voorproefje, zodat de lijst met regels compact blijft.
 */
export function RegelBeschrijving({
  tekst,
  onChange,
}: {
  tekst: string | undefined;
  onChange: (tekst: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const veldId = useId();
  const eersteRegel = tekst?.trim().split("\n")[0]?.trim() ?? "";
  const heeftTekst = eersteRegel.length > 0;

  return (
    <div className="mt-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={open ? veldId : undefined}
          className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-90"
            )}
            aria-hidden
          />
          <span className="shrink-0 font-medium">
            {heeftTekst || open ? "Beschrijving op offerte" : "Beschrijving toevoegen"}
          </span>
          {heeftTekst && !open && (
            <span className="min-w-0 truncate">— {eersteRegel}</span>
          )}
        </button>
        {open && heeftTekst && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Weghalen
          </Button>
        )}
      </div>
      {open && (
        <Textarea
          id={veldId}
          value={tekst ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          aria-label="Beschrijving op offerte"
          placeholder="Tekst die de klant onder deze regel op de offerte en factuur ziet. Regels die met “- ” beginnen worden een opsomming."
          className="mt-1.5 max-h-72 min-h-20 text-sm leading-relaxed"
        />
      )}
    </div>
  );
}
