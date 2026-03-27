/**
 * Pure offerte status transition logic.
 *
 * Extracted from convex/offertes.ts so it can be unit-tested without
 * spinning up a Convex backend.  The canonical transition map lives here;
 * the Convex mutation should ideally import from this module in the future.
 *
 * Workflow: concept -> voorcalculatie -> verzonden -> geaccepteerd / afgewezen
 * Backward transitions are allowed at certain stages (see map below).
 */

export const OFFERTE_STATUSES = [
  "concept",
  "voorcalculatie",
  "verzonden",
  "geaccepteerd",
  "afgewezen",
] as const;

export type OfferteStatus = (typeof OFFERTE_STATUSES)[number];

/**
 * Map of every status to the list of statuses it may transition to.
 * Mirrors the `validTransitions` object in `convex/offertes.ts`.
 */
export const validTransitions: Record<OfferteStatus, readonly OfferteStatus[]> = {
  concept: ["voorcalculatie"],
  voorcalculatie: ["concept", "verzonden"],
  verzonden: ["voorcalculatie", "geaccepteerd", "afgewezen"],
  geaccepteerd: ["verzonden"],
  afgewezen: ["verzonden"],
};

/**
 * Returns `true` when moving from `from` to `to` is a valid offerte
 * status transition.  Returns `false` for any unknown or invalid input.
 */
export function isValidTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from || !to) return false;
  const allowed = validTransitions[from as OfferteStatus];
  if (!allowed) return false;
  return allowed.includes(to as OfferteStatus);
}

/**
 * Returns the list of statuses that `status` may transition to.
 * Returns an empty array for unknown / invalid input.
 */
export function getValidNextStatuses(
  status: string | null | undefined,
): readonly OfferteStatus[] {
  if (!status) return [];
  return validTransitions[status as OfferteStatus] ?? [];
}

/**
 * Type-guard: returns `true` when the supplied string is one of the
 * known offerte statuses.
 */
export function isOfferteStatus(value: unknown): value is OfferteStatus {
  return (
    typeof value === "string" &&
    OFFERTE_STATUSES.includes(value as OfferteStatus)
  );
}
