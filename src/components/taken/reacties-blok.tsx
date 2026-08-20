"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const TIJD = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Reacties bij een taak — overleg hoort bij het werk, niet in WhatsApp
 * (inventaris §B5).
 *
 * Twee soorten regels in dezelfde lijst. Een `reactie` is iemand die iets
 * typt; een `herinnering` schrijft de app zelf als er op het bord op
 * "Herinneren" gedrukt wordt. Die laatste staat er gedimd en cursief tussen:
 * je ziet dát er gepord is zonder dat het als een mens-tot-mens-bericht leest.
 */
export function ReactiesBlok({ taakId }: { taakId: Id<"klantTaken"> }) {
  const reacties = useQuery(api.taakReacties.list, { taakId });
  const plaats = useMutation(api.taakReacties.plaats);
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);

  const versturen = async () => {
    const schoon = tekst.trim();
    if (!schoon || bezig) return;
    setBezig(true);
    try {
      await plaats({ taakId, tekst: schoon });
      setTekst("");
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij plaatsen reactie"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="grid gap-2" aria-label="Reacties">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Reacties
      </h3>

      {reacties === undefined ? (
        <div className="grid gap-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ) : reacties.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nog geen reacties — schrijf hier wat je met deze taak deed.
        </p>
      ) : (
        <ul className="grid gap-2">
          {reacties.map((reactie) => (
            <li key={reactie._id} className="flex min-w-0 items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold leading-none",
                  reactie.soort === "herinnering"
                    ? "border-status-verzonden-border bg-status-verzonden text-status-verzonden-text"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {reactie.auteurInitialen}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-4 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {reactie.auteurNaam}
                  </span>
                  <time dateTime={new Date(reactie.timestamp).toISOString()}>
                    {TIJD.format(new Date(reactie.timestamp))}
                  </time>
                </p>
                <p
                  className={cn(
                    "break-words text-xs leading-snug",
                    reactie.soort === "herinnering"
                      ? "italic text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {reactie.tekst}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void versturen();
            }
          }}
          aria-label="Reactie schrijven"
          placeholder="Reactie… (Enter om te plaatsen)"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={() => void versturen()}
          disabled={bezig || tekst.trim() === ""}
          aria-label="Reactie plaatsen"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <Send className="size-3.5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
