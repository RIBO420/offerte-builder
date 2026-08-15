import { cn } from "@/lib/utils";

/**
 * LaadIndicator — de enige laadanimatie van de app.
 *
 * Waarom dit bestaat: er stonden ~50 losse spinners in de app, elk met een eigen
 * kleur en een eigen idee van "midden". Twee klachten kwamen daaruit voort:
 *
 * 1. **Niet gecentreerd.** Pagina's schreven `flex flex-1 items-center
 *    justify-center`, maar de `<main>` in `(dashboard)/layout.tsx` heeft
 *    `PageTransition` als tussenlaag; die `m.div` was géén flexkolom, dus
 *    `flex-1` kreeg geen hoogte om in te centreren en de spinner plakte tegen
 *    de bovenrand. `PageTransition` is nu `flex flex-1 flex-col` (daar staat
 *    dezelfde notitie), en dit component heeft daarnaast een eigen
 *    `min-h`-vloer zodat het óók in een gewone blokcontainer in het midden
 *    van een fatsoenlijk vlak staat.
 * 2. **Rauw felgroen.** `--primary` is in donker de #4ADE80-familie en in het
 *    portaal zelfs letterlijk #4ADE80. Een vol vlak van 32px in die kleur, of
 *    de `from-emerald-500 to-green-600`-tegels met een gloed eromheen, schreeuwt
 *    harder dan de inhoud die eronder verschijnt.
 *
 * De animatie hier: een stille ring in `--border`, een gedempte boog in
 * `--muted-foreground` die de beweging draagt, en één klein zaadje in
 * `--primary` dat voorop loopt. Het merkgroen is dus een accent van ~3px in
 * plaats van het hele symbool. Kleur komt uitsluitend uit tokens — geen
 * `emerald-500`, geen hexwaarden.
 *
 * Rotatie is bewust trager dan Tailwinds `animate-spin` (1s): 1,4s leest als
 * "even geduld", 1s als "er hangt iets". De duur staat inline omdat een
 * arbitraire `animate-[spin_1.4s_…]` de `spin`-keyframes niet gegarandeerd
 * meelevert in Tailwind v4, en `globals.css` hier niet voor open hoeft.
 *
 * `motion-reduce`: de rotatie valt weg en de hele indicator ademt in plaats
 * daarvan zacht op (alleen opacity, geen beweging).
 */

type LaadFormaat = "pagina" | "sectie" | "inline";

/**
 * De ring zelf, zonder omhulsel. Geometrie: cirkel r=16 op (20,20).
 * De boog loopt vanaf de bovenkant tégen de klok in (dus achter de
 * draairichting aan), het zaadje staat op de kop van de boog.
 */
const BOOG_PAD = "M20 4 A16 16 0 0 0 4.24 22.78";

const RING_MAAT: Record<LaadFormaat, string> = {
  pagina: "size-10",
  sectie: "size-7",
  inline: "size-4",
};

function LaadRing({
  formaat = "sectie",
  className,
}: {
  formaat?: LaadFormaat;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ animationDuration: "1.4s" }}
      className={cn(
        "animate-spin motion-reduce:animate-none",
        RING_MAAT[formaat],
        className,
      )}
    >
      <circle
        cx="20"
        cy="20"
        r="16"
        strokeWidth="2"
        className="stroke-border"
      />
      <path
        d={BOOG_PAD}
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-muted-foreground/50"
      />
      <circle cx="20" cy="4" r="2.4" className="fill-primary" />
    </svg>
  );
}

const VLAK: Record<LaadFormaat, string> = {
  // `min-h` is de vangnetvloer voor containers zonder hoogte; in een echte
  // flexkolom wint `flex-1` en staat de ring in het werkelijke midden.
  // Bewust géén eigen `py-`: veel aanroepplekken zitten al in een `CardContent`
  // of paneel met padding, en twee lagen padding maken van een laadstaat de
  // langste sectie van de pagina.
  pagina: "flex w-full flex-1 flex-col items-center justify-center gap-3 min-h-64",
  sectie: "flex w-full flex-1 flex-col items-center justify-center gap-2.5 min-h-24",
  inline: "inline-flex items-center gap-2 align-middle",
};

const TEKST_MAAT: Record<LaadFormaat, string> = {
  pagina: "text-sm",
  sectie: "text-xs",
  inline: "text-xs",
};

export interface LaadIndicatorProps {
  /** pagina = heel contentvlak · sectie = paneel/kaart/tab · inline = in een regel of knop */
  formaat?: LaadFormaat;
  /**
   * Zichtbaar label. Zonder dit blijft alleen de `sr-only`-tekst "Laden…"
   * over — meestal genoeg, want de ring staat er al.
   */
  tekst?: string;
  /** Wat de schermlezer hoort wanneer er geen zichtbare tekst is. */
  label?: string;
  className?: string;
}

export function LaadIndicator({
  formaat = "sectie",
  tekst,
  label = "Laden…",
  className,
}: LaadIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(VLAK[formaat], "animate-none motion-reduce:animate-pulse", className)}
    >
      <LaadRing formaat={formaat} />
      {tekst ? (
        <p className={cn("text-muted-foreground", TEKST_MAAT[formaat])}>{tekst}</p>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

export { LaadRing };
