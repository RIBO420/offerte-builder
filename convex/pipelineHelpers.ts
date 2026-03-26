/**
 * Pipeline Helpers — CRM-002 Klant Lifecycle Pipeline
 *
 * Helper functions for managing klant pipeline status transitions.
 * Pipeline status only upgrades, never downgrades.
 */

import { GenericMutationCtx } from "convex/server";
import { DataModel } from "./_generated/dataModel";
import { Id } from "./_generated/dataModel";

// Ordered pipeline stages — index determines hierarchy
export const PIPELINE_ORDER = [
  "lead",
  "offerte_verzonden",
  "getekend",
  "in_uitvoering",
  "opgeleverd",
  "onderhoud",
] as const;

export type PipelineStatus = (typeof PIPELINE_ORDER)[number];

/**
 * Determine if a pipeline status should be upgraded.
 * Returns true only if the new status is higher in the pipeline than the current one.
 */
export function shouldUpgradePipeline(
  current: string | undefined,
  next: string
): boolean {
  const currentIdx = current
    ? PIPELINE_ORDER.indexOf(current as PipelineStatus)
    : -1;
  const nextIdx = PIPELINE_ORDER.indexOf(next as PipelineStatus);
  return nextIdx > currentIdx;
}

/**
 * Upgrade klant pipeline status if the new status is higher than the current one.
 * This is a no-op if the klant is already at a higher pipeline stage.
 *
 * @param ctx - Convex mutation context
 * @param klantId - ID of the klant to update
 * @param newStatus - The pipeline status to set
 */
export async function upgradeKlantPipeline(
  ctx: GenericMutationCtx<DataModel>,
  klantId: Id<"klanten">,
  newStatus: PipelineStatus
): Promise<void> {
  const klant = await ctx.db.get(klantId);
  if (!klant) return;

  if (shouldUpgradePipeline(klant.pipelineStatus, newStatus)) {
    await ctx.db.patch(klantId, {
      pipelineStatus: newStatus,
      updatedAt: Date.now(),
    });
  }
}
