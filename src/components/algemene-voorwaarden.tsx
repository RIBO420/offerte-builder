"use client";

import * as React from "react";
import { BookOpenIcon, ChevronDownIcon, CheckCircle2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlgemeneVoorwaardenProps {
  mode: "volledig" | "samenvatting" | "popup";
  onGelezen?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Voorwaarden inhoud
// ---------------------------------------------------------------------------

const ARTIKELEN = [
  {
    nummer: 1,
    titel: "Definities",
    punten: [
      '"Opdrachtnemer": Top Tuinen B.V., gevestigd te [adres]',
      '"Opdrachtgever": de natuurlijke of rechtspersoon die een overeenkomst aangaat',
      '"Werkzaamheden": alle overeengekomen diensten zoals beschreven in de offerte',
    ],
  },
  {
    nummer: 2,
    titel: "Offertes en overeenkomsten",
    punten: [
      "Alle offertes zijn vrijblijvend en geldig voor 30 dagen",
      "Een overeenkomst komt tot stand na schriftelijke akkoordverklaring of digitale ondertekening",
      "Wijzigingen in de overeenkomst zijn alleen geldig indien schriftelijk overeengekomen",
    ],
  },
  {
    nummer: 3,
    titel: "Prijzen en betaling",
    punten: [
      "Alle prijzen zijn exclusief BTW, tenzij anders vermeld",
      "Betaling dient te geschieden binnen 14 dagen na factuurdatum",
      "Bij aanlegwerkzaamheden: 30% aanbetaling voor aanvang, 70% na oplevering",
      "Bij onderhoud: maandelijkse facturering achteraf",
    ],
  },
  {
    nummer: 4,
    titel: "Uitvoering werkzaamheden",
    punten: [
      "Opdrachtnemer voert de werkzaamheden uit naar beste inzicht en vakmanschap",
      "Opdrachtgever dient de werkplek toegankelijk te maken op de afgesproken datum",
      "Bij onvoldoende toegankelijkheid worden meerkosten doorberekend",
      "Weersomstandigheden kunnen leiden tot wijziging van de planning",
    ],
  },
  {
    nummer: 5,
    titel: "Garantie",
    punten: [
      "Op aanlegwerkzaamheden geldt een garantie zoals overeengekomen in de offerte",
      "Garantie vervalt bij onjuist gebruik, gebrek aan onderhoud of wijzigingen door derden",
      "Planten-garantie: 1 groeiseizoen bij normaal onderhoud",
      "Bestrating-garantie: 5 jaar op verzakkingen bij normaal gebruik",
    ],
  },
  {
    nummer: 6,
    titel: "Aansprakelijkheid",
    punten: [
      "Aansprakelijkheid is beperkt tot het factuurbedrag van de betreffende opdracht",
      "Opdrachtnemer is niet aansprakelijk voor gevolgschade",
      "Kabels en leidingen: opdrachtgever is verantwoordelijk voor juiste markering",
    ],
  },
  {
    nummer: 7,
    titel: "Annulering",
    punten: [
      "Annulering door opdrachtgever is kosteloos tot 7 werkdagen voor aanvang",
      "Bij latere annulering: 25% van het offertebedrag als annuleringskosten",
      "Bij annulering na aanvang: voltooide werkzaamheden + 10% van resterend bedrag",
    ],
  },
  {
    nummer: 8,
    titel: "Klachten",
    punten: [
      "Klachten dienen binnen 14 dagen na constatering schriftelijk gemeld te worden",
      "Opdrachtnemer heeft het recht gebreken binnen redelijke termijn te herstellen",
    ],
  },
  {
    nummer: 9,
    titel: "Toepasselijk recht",
    punten: [
      "Op alle overeenkomsten is Nederlands recht van toepassing",
      "Geschillen worden voorgelegd aan de bevoegde rechter",
    ],
  },
  {
    nummer: 10,
    titel: "Hogedrukspuit",
    punten: [
      "Bij gebruik van hogedrukspuit kan spatschade optreden",
      "Opdrachtgever verklaart kennis te hebben genomen van dit risico",
      "Opdrachtnemer is niet aansprakelijk voor spatschade bij akkoord hogedrukspuit",
    ],
  },
];

const SAMENVATTING_PUNTEN = [
  {
    artikel: "Art. 2",
    tekst: "Offertes zijn vrijblijvend en 30 dagen geldig; overeenkomst vereist schriftelijke of digitale akkoordverklaring",
  },
  {
    artikel: "Art. 3",
    tekst: "Prijzen excl. BTW; betaling binnen 14 dagen; bij aanleg 30% aanbetaling voor aanvang",
  },
  {
    artikel: "Art. 5",
    tekst: "Planten-garantie 1 groeiseizoen; bestrating-garantie 5 jaar; vervalt bij onjuist gebruik",
  },
  {
    artikel: "Art. 6",
    tekst: "Aansprakelijkheid beperkt tot factuurbedrag; geen aansprakelijkheid voor gevolgschade",
  },
  {
    artikel: "Art. 7",
    tekst: "Kosteloos annuleren tot 7 werkdagen voor aanvang; daarna 25% annuleringskosten",
  },
];

// ---------------------------------------------------------------------------
// Subcomponenten
// ---------------------------------------------------------------------------

function VoorwaardenInhoud() {
  return (
    <div className="space-y-6 pr-2 text-sm">
      <div className="space-y-1">
        <h2 className="text-base font-bold tracking-tight">
          ALGEMENE VOORWAARDEN TOP TUINEN B.V.
        </h2>
        <p className="text-muted-foreground text-xs">
          Versie 2024 — Van toepassing op alle offertes en overeenkomsten
        </p>
      </div>

      <Separator />

      {ARTIKELEN.map((artikel) => (
        <div key={artikel.nummer} className="space-y-2">
          <h3 className="font-semibold text-foreground">
            Artikel {artikel.nummer} — {artikel.titel}
          </h3>
          <ol className="space-y-1.5 list-none">
            {artikel.punten.map((punt, index) => (
              <li key={index} className="flex gap-2 text-muted-foreground leading-relaxed">
                <span className="shrink-0 font-medium text-foreground/70 tabular-nums">
                  {artikel.nummer}.{index + 1}
                </span>
                <span>{punt}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      <Separator />

      <p className="text-xs text-muted-foreground italic">
        Top Tuinen B.V. — KvK [nummer] — BTW [nummer] — Gedeponeerd bij de
        Kamer van Koophandel
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modus: volledig
// ---------------------------------------------------------------------------

function VolledigeModus({
  onGelezen,
  className,
}: {
  onGelezen?: () => void;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [heeftGescrolld, setHeeftGescrolld] = React.useState(false);
  const onGelezenRef = React.useRef(onGelezen);

  // Synchronize the ref so we always have the latest callback without
  // re-running effects that would reset scroll state.
  React.useEffect(() => {
    onGelezenRef.current = onGelezen;
  }, [onGelezen]);

  React.useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
      "[data-slot='scroll-area-viewport']"
    );
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage >= 0.9 && !heeftGescrolld) {
        setHeeftGescrolld(true);
        onGelezenRef.current?.();
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [heeftGescrolld]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Scroll naar beneden om alle voorwaarden te lezen
        </span>
        {heeftGescrolld && (
          <Badge variant="secondary" className="gap-1 text-green-700 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
            <CheckCircle2Icon className="size-3" />
            Gelezen
          </Badge>
        )}
      </div>

      <ScrollArea
        ref={scrollRef}
        className="h-[400px] rounded-md border bg-muted/20 p-4"
      >
        <VoorwaardenInhoud />
      </ScrollArea>

      {!heeftGescrolld && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground animate-bounce">
          <ChevronDownIcon className="size-3" />
          <span>Scroll omlaag voor meer</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modus: samenvatting
// ---------------------------------------------------------------------------

function SamenvattingModus({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <BookOpenIcon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Kernpunten algemene voorwaarden</span>
      </div>

      <ul className="space-y-2">
        {SAMENVATTING_PUNTEN.map((punt, index) => (
          <li key={index} className="flex gap-3 text-sm">
            <Badge
              variant="outline"
              className="shrink-0 self-start mt-0.5 font-mono text-[10px] px-1.5"
            >
              {punt.artikel}
            </Badge>
            <span className="text-muted-foreground leading-relaxed">
              {punt.tekst}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modus: popup
// ---------------------------------------------------------------------------

function PopupModus({
  onGelezen,
  className,
}: {
  onGelezen?: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [heeftGelezen, setHeeftGelezen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = React.useCallback(() => {
    const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
      "[data-slot='scroll-area-viewport']"
    );
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage >= 0.9) {
      setHeeftGelezen(true);
    }
  }, []);

  // Attach scroll listener when dialog opens
  React.useEffect(() => {
    if (!open) return;

    // Wait for the DOM to be ready after dialog opens
    const timer = setTimeout(() => {
      const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
        "[data-slot='scroll-area-viewport']"
      );
      if (!viewport) return;
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      // Trigger an initial check in case content fits without scrolling
      handleScroll();
    }, 100);

    return () => {
      clearTimeout(timer);
      const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
        "[data-slot='scroll-area-viewport']"
      );
      viewport?.removeEventListener("scroll", handleScroll);
    };
  }, [open, handleScroll]);

  const handleGelezen = () => {
    onGelezen?.();
    setOpen(false);
  };

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="link" size="sm" className="h-auto p-0 text-sm">
            Bekijk volledige voorwaarden
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpenIcon className="size-5 text-muted-foreground" />
              Algemene Voorwaarden Top Tuinen B.V.
            </DialogTitle>
          </DialogHeader>

          <ScrollArea
            ref={scrollRef}
            className="flex-1 min-h-0 max-h-[60dvh] rounded-md border bg-muted/20 p-4"
          >
            <VoorwaardenInhoud />
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!heeftGelezen && (
              <p className="text-xs text-muted-foreground self-center mr-auto">
                Scroll naar beneden om de knop te activeren
              </p>
            )}
            <Button
              onClick={handleGelezen}
              disabled={!heeftGelezen}
              className="gap-2"
            >
              {heeftGelezen && <CheckCircle2Icon className="size-4" />}
              Ik heb de voorwaarden gelezen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoofd export
// ---------------------------------------------------------------------------

export function AlgemeneVoorwaarden({
  mode,
  onGelezen,
  className,
}: AlgemeneVoorwaardenProps) {
  if (mode === "volledig") {
    return <VolledigeModus onGelezen={onGelezen} className={className} />;
  }

  if (mode === "samenvatting") {
    return <SamenvattingModus className={className} />;
  }

  return <PopupModus onGelezen={onGelezen} className={className} />;
}
