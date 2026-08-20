"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, NotebookPen, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

const TIJD = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
});

function urenTekst(uren: number): string {
  return `${uren.toFixed(1).replace(".", ",")}u`;
}

/**
 * Het logboek onder de zwevende knop rechtsonder (inventaris §B6).
 *
 * "Wat heb ik gedaan?" is een vraag die je 's middags stelt, niet aan het eind
 * van de week — vandaar dat het hier staat, op het scherm waar je toch al de
 * hele dag bent, en niet in de urenmodule. Je typt gewoon een zin; staat er
 * "1,5u" of "45m" in, dan telt de app dat mee in het dagtotaal op de knop.
 * De parsing zit in de server (`dagLogboek.voegToe`), zodat de knop en de
 * urenstaat het over hetzelfde getal hebben.
 *
 * Dit is nadrukkelijk géén urenregistratie: de gecontroleerde keten loopt via
 * /uren, en daar wijst de voettekst naartoe.
 */
export function LogboekFab() {
  const logboek = useQuery(api.dagLogboek.vandaag, {});
  const voegToe = useMutation(api.dagLogboek.voegToe);
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);

  const totaal = logboek?.totaalUren ?? 0;

  const opslaan = async () => {
    const schoon = tekst.trim();
    if (!schoon || bezig) return;
    setBezig(true);
    try {
      await voegToe({ tekst: schoon });
      setTekst("");
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij opslaan logregel"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <section
          aria-label="Wat heb ik gedaan"
          className="flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        >
          <header className="flex items-center gap-2 border-b px-3 py-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
              Wat heb ik gedaan
            </h2>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {urenTekst(totaal)} vandaag
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Logboek sluiten"
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {logboek === undefined ? (
              <div className="grid gap-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            ) : logboek.regels.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                Nog niets gelogd vandaag. Schrijf op wat je deed — met &ldquo;1,5u&rdquo;
                of &ldquo;45m&rdquo; erin telt de tijd mee.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {logboek.regels.map((regel) => (
                  <li
                    key={regel._id}
                    className="flex items-baseline gap-2 text-xs leading-snug"
                  >
                    <time
                      dateTime={new Date(regel.timestamp).toISOString()}
                      className="shrink-0 tabular-nums text-muted-foreground"
                    >
                      {TIJD.format(new Date(regel.timestamp))}
                    </time>
                    <span className="min-w-0 flex-1 break-words">
                      {regel.tekst}
                    </span>
                    {regel.uren !== undefined && (
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {urenTekst(regel.uren)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t px-3 py-2">
            <input
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void opslaan();
                }
              }}
              aria-label="Logregel toevoegen"
              placeholder="Wat deed je? (Enter om te loggen)"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <footer className="border-t px-3 py-2">
            <Link
              href="/uren"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Naar urenstaat
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((vorig) => !vorig)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <NotebookPen className="size-4" aria-hidden />
        Logboek
        <span className="tabular-nums">{urenTekst(totaal)}</span>
      </button>
    </div>
  );
}
