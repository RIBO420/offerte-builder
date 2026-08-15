"use client";

/**
 * Sticky ankernavigatie met scroll-spy.
 *
 * Vervangt de acht tabs. Verschil met tabs: er verdwijnt niets. De pagina is
 * één verhaal dat je van boven naar beneden leest; de balk zegt alleen waar je
 * bent en laat je springen. Geen `AnimatePresence mode="wait"`, dus ook geen
 * lege flits en geen scroll-reset bij elke wissel (rapportage-schouw
 * §Laadgedrag).
 */

import { useCallback, useEffect, useState } from "react";
import { m } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { cn } from "@/lib/utils";
import { SECTIES, type SectieId } from "./antwoord-blok";

export function AnkerNavigatie({
  acties,
  /**
   * Staan de secties al in de DOM? De balk rendert vóór het rapport (hij hangt
   * boven de skeleton), dus zonder deze vlag zou de scroll-spy zich één keer
   * op een lege pagina instellen en daarna nooit meer iets markeren.
   */
  sectiesKlaar = false,
  className,
}: {
  acties?: React.ReactNode;
  sectiesKlaar?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [actief, setActief] = useState<SectieId>(SECTIES[0].id);

  useEffect(() => {
    if (!sectiesKlaar) return;
    const secties = SECTIES.map((s) =>
      document.getElementById(s.id)
    ).filter((el): el is HTMLElement => el !== null);
    if (secties.length === 0) return;

    // Bewust een scroll-listener en géén IntersectionObserver. Twee redenen:
    //  1. de app scrolt niet in het document maar in de `SidebarInset`-`main`,
    //     en een IO met de viewport als root vertelde daar niets bruikbaars;
    //  2. de leesregel is "welke sectiekop staat het dichtst onder de balk",
    //     en dat is een vergelijking van posities, geen zichtbaarheidsvraag.
    // Scroll-events bubbelen niet, maar bereiken `document` wél in de
    // capture-fase — zo hoeft deze component de scroller niet te kennen.
    const BALK_HOOGTE = 96;
    let gepland = false;

    const bepaal = () => {
      gepland = false;
      let huidig = secties[0];
      for (const sectie of secties) {
        if (sectie.getBoundingClientRect().top <= BALK_HOOGTE) {
          huidig = sectie;
        }
      }
      setActief(huidig.id as SectieId);
    };

    // Samenvoegen per taak, niet per frame: `requestAnimationFrame` staat stil
    // zodra het tabblad verborgen is (empirisch vastgesteld tijdens de schouw),
    // en dan blijft de markering hangen op de sectie van vóór de wissel. Voor
    // het verplaatsen van één onderstreping is een taak-throttle ruim genoeg.
    let timer = 0;
    const opScroll = () => {
      if (gepland) return;
      gepland = true;
      timer = window.setTimeout(bepaal, 0);
    };

    // Via `opScroll` en niet rechtstreeks: de eerste bepaling hoort ná de paint
    // te gebeuren, niet synchroon in de effect-body.
    opScroll();
    document.addEventListener("scroll", opScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", opScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("scroll", opScroll, { capture: true });
      window.removeEventListener("resize", opScroll);
    };
  }, [sectiesKlaar]);

  const springNaar = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: SectieId) => {
      const doel = document.getElementById(id);
      if (!doel) return;
      event.preventDefault();
      setActief(id);
      doel.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      // Het anker in de URL houden zonder een navigatie: deelbare link, geen
      // extra history-entry per klik.
      window.history.replaceState(null, "", `#${id}`);
    },
    [reducedMotion]
  );

  return (
    <div
      // Geen negatieve marges: deze balk is al een direct kind van het
      // scrollvlak, dus `-mx-8` duwde hem 32 px buiten de rechterrand en zette
      // de hele pagina aan het zijwaarts scrollen (harde regel 1).
      className={cn(
        "sticky top-0 z-30 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md md:px-8",
        className
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
        {/* Zonder secties is een inhoudsopgave een rij dode links; dan blijft er
            een lege flex-kolom staan zodat de periodekiezer rechts blijft. */}
        {!sectiesKlaar && <div aria-hidden="true" />}
        <nav aria-label="Secties in dit rapport" className={sectiesKlaar ? undefined : "hidden"}>
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {SECTIES.map((sectie) => {
              const isActief = actief === sectie.id;
              return (
                <li key={sectie.id}>
                  <a
                    href={`#${sectie.id}`}
                    onClick={(e) => springNaar(e, sectie.id)}
                    aria-current={isActief ? "true" : undefined}
                    className={cn(
                      "relative inline-block rounded-md px-2.5 py-1.5 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActief
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {sectie.kort}
                    {isActief && (
                      <m.span
                        layoutId="rapportage-anker-actief"
                        className="absolute inset-x-2.5 -bottom-[9px] h-[2px] rounded-full bg-primary"
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { duration: 0.32, ease: [0.23, 1, 0.32, 1] }
                        }
                      />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        {acties && (
          <div className="flex flex-wrap items-center gap-2">{acties}</div>
        )}
      </div>
    </div>
  );
}
