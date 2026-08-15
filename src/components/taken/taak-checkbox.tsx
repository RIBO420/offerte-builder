"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Het afvinkhokje van een taak — de enige knop in een takenlijst die je de
 * hele dag gebruikt, en precies degene die je niet zag staan.
 *
 * **Waarom niet gewoon `<Checkbox>`.** De basiscomponent tekent zijn rand met
 * `border-input`. Gemeten haalt die 1,03:1 op het loofgroene werkvlak en
 * 1,32:1 op `--card` — ver onder de 3:1 die WCAG 1.4.11 voor niet-tekstuele
 * bedieningselementen vraagt. Het hokje was dus letterlijk een vlek in het
 * vlak. Hier krijgt het een merkgroene rand op 75% dekking: gemeten 3,49:1
 * (licht) en 5,08:1 (donker) op het takenvlak, 4,09:1 op `--card` — overal
 * boven 3:1. De vulling is `--card`, zodat het lege vakje ook als een leeg
 * vakje leest en niet als een gaatje in de tint.
 *
 * Aangevinkt blijft het merkgroene vlak van de basiscomponent staan (5,76:1
 * licht, 7,84:1 donker): een afgevinkte regel is bewijs dat het gedaan is.
 *
 * Twee dingen die de basiscomponent verder in de weg zitten en die hier
 * rechtgezet worden:
 * - De 44px-raakvlakwrapper duwt in een compacte rij de kolommen uit elkaar.
 *   Wrapper neutraliseren, en het vinkje zelf een onzichtbare hitzone geven —
 *   16px is een klein doel voor iets wat je de hele dag aanklikt.
 * - `transition-shadow` alleen: de kleurwissel bij hover sprong. Nu
 *   `transition-colors` erbij.
 *
 * Opvolgpunt: `border-input` is app-breed te licht voor een 3:1-rand. Dat
 * rechttrekken raakt élk formulier en hoort in een eigen ronde thuis.
 */
export function TaakCheckbox({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<typeof Checkbox> & {
  /** Uitlijning van het hokje binnen de rij (bv. `mt-0.5` bij tekst boven). */
  wrapperClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 justify-center [&>span]:min-h-0 [&>span]:min-w-0",
        wrapperClassName
      )}
    >
      <Checkbox
        className={cn(
          "relative size-4 border-primary/75 bg-card transition-colors",
          "before:absolute before:-inset-3 before:content-[''] sm:before:-inset-2",
          "hover:border-primary hover:bg-primary/10",
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
          "dark:bg-card dark:hover:bg-primary/15",
          className
        )}
        {...props}
      />
    </span>
  );
}
