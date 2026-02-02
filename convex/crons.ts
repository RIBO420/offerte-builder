/**
 * Convex Cron Jobs Configuration
 *
 * This file defines scheduled background tasks that run automatically.
 * Convex cron jobs run in the Convex cloud and are reliable and serverless.
 *
 * Available scheduling options:
 * - crons.interval("name", { hours: N }, fn) - Run every N hours
 * - crons.daily("name", { hourUTC: N, minuteUTC: M }, fn) - Run daily at specific UTC time
 * - crons.weekly("name", { dayOfWeek: "monday", hourUTC: N, minuteUTC: M }, fn) - Run weekly
 * - crons.monthly("name", { day: N, hourUTC: H, minuteUTC: M }, fn) - Run monthly
 * - crons.cron("name", "cron expression", fn) - Run on custom cron schedule
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily Cleanup Job
 *
 * Runs at 3:00 AM UTC every day to perform maintenance tasks:
 * - Clean up soft-deleted items older than 30 days (offertes and projects)
 * - Clean up expired share tokens (older than 30 days)
 * - Clean up old read notifications (older than 90 days)
 * - Clean up old notification logs (older than 30 days)
 * - Clean up old push notification logs (older than 30 days)
 *
 * This helps keep the database clean and reduces storage costs.
 */
crons.daily(
  "daily cleanup",
  { hourUTC: 3, minuteUTC: 0 }, // 3:00 AM UTC (4:00 AM CET / 5:00 AM CEST)
  internal.softDelete.runDailyCleanup
);

export default crons;
