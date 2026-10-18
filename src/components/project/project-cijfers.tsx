/**
 * Kleine bouwstenen voor de projectpagina's Overzicht en Planning (okt 2026):
 * Nederlandse getalnotatie, een voortgangsbalkje en de scope-stip.
 *
 * Bewust klein gehouden; alleen gedeeld tussen die twee pagina's en de
 * componenten die alleen zij gebruiken.
 */

import { cn } from "@/lib/utils";

const NL_1 = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

/** `17,6` — hooguit één decimaal, nooit `35.150000000000006`. */
export function getal(n: number): string {
  return NL_1.format(n);
}

/** Percentage als geheel getal, begrensd op 0 aan de onderkant. */
export function procent(deel: number, geheel: number): number {
  if (geheel <= 0) return 0;
  return Math.max(0, Math.round((deel / geheel) * 100));
}

/** Hele werkdagen: 1,93 dag is in de praktijk 2 werkdagen. */
export function heleWerkdagen(dagen: number): number {
  if (dagen <= 0) return 0;
  return Math.ceil(Math.round(dagen * 100) / 100);
}

/**
 * Voortgangsbalkje. Puur visueel (`aria-hidden`): de tekst ernaast draagt
 * altijd hetzelfde getal, zodat kleur nooit het enige signaal is.
 */
export function VoortgangsBalk({
  waarde,
  vulling = "bg-status-afgerond-dot",
  spoor = "bg-muted",
  className,
}: {
  /** 0–100; daarboven loopt de balk vol. */
  waarde: number;
  vulling?: string;
  spoor?: string;
  className?: string;
}) {
  const breedte = Math.min(100, Math.max(0, waarde));
  return (
    <span
      aria-hidden="true"
      className={cn("block h-1.5 overflow-hidden rounded-full", spoor, className)}
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-500 ease-standaard motion-reduce:transition-none", vulling)}
        style={{ width: `${breedte}%` }}
      />
    </span>
  );
}

/**
 * Stipkleur per scope, uit de `--scope-*`-tokens. Scopes zonder eigen token
 * lenen die van hun familie (beregening → water, parkeerplaats → bestrating);
 * de rest is neutraal grijs.
 */
const SCOPE_STIP: Record<string, string> = {
  grondwerk: "bg-scope-grondwerk",
  bestrating: "bg-scope-bestrating",
  parkeerplaats: "bg-scope-bestrating",
  beregening: "bg-scope-water",
  water_elektra: "bg-scope-water",
  borders: "bg-scope-borders",
  borders_onderhoud: "bg-scope-borders",
  gras: "bg-scope-gras",
  gras_onderhoud: "bg-scope-gras",
  houtwerk: "bg-scope-houtwerk",
  specials: "bg-scope-specials",
};

export function scopeStip(scope: string): string {
  return SCOPE_STIP[scope] ?? "bg-muted-foreground/60";
}
