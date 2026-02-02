/**
 * Time Utilities
 *
 * Re-exports time/hour utility functions from the centralized format library.
 * This file is kept for backwards compatibility.
 *
 * @deprecated Import directly from "@/lib/format" instead.
 */

export {
  roundToQuarter,
  formatHoursWithUnit as formatHours,
  formatDuration,
} from "@/lib/format";
