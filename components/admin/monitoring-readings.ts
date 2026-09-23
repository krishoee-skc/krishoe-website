import type { ServiceStatus, UptimeEvidence } from "@/lib/monitoring";
import type { BranchIsolationStatus } from "@/lib/branch-isolation-status";

/**
 * What the monitoring screen reads, apart from how it draws it.
 *
 * MonitoringDashboard was 807 lines in one client component: the shape the API
 * sends, two functions that turn a number and a timestamp into words a person
 * can read, and the whole of the markup. All of it shipped to the phone as one
 * chunk, and the two readings below — which are ordinary functions over plain
 * values, with no React in them — could only be read by reading past the
 * dashboard.
 *
 * Nothing here renders anything. It is the same code, in a file that says what
 * it is.
 */

/**
 * "6 मिनेटअघि" rather than a timestamp.
 *
 * The question this answers is "is it answering right now", and a reader should
 * not have to subtract two clock times to find out — least of all across the
 * five-and-three-quarter hours between Kathmandu and the server.
 */
export function minutesAgo(minutes: number | null): { en: string; ne: string } {
  if (minutes === null) return { en: "—", ne: "—" };
  if (minutes < 2) return { en: "just now", ne: "अहिल्यै" };
  if (minutes < 60) return { en: `${minutes} minutes ago`, ne: `${minutes} मिनेटअघि` };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { en: `${hours} hours ago`, ne: `${hours} घण्टाअघि` };

  const days = Math.round(hours / 24);
  return { en: `${days} days ago`, ne: `${days} दिनअघि` };
}

/** Nepal time, as a clock reads it. The column stores UTC. */
export function formatWhen(value?: string | null) {
  if (!value) return "—";

  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "—";

  return when.toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export interface MonitoringData {
  errors: {
    totalErrors: number;
    errorsByLevel: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
    recentErrors: Array<{
      id: string;
      message: string;
      level: string;
      context?: string | null;
      timestamp?: string;
      created_at?: string;
    }>;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowestEndpoints: Array<{
      path: string;
      rating: string;
      avgTime: number;
      /** The middle reading — what a typical shopper waited. */
      medianTime: number;
      /** The worst single reading, kept visible rather than averaged away. */
      slowest: number;
      count: number;
    }>;
    errorRate: number;
    samples: number;
    setAside: number;
  };
  // The library type, not a copy of it. This block was a hand-written
  // duplicate of UptimeEvidence and went stale the moment that grew a field.
  uptime: UptimeEvidence;
  health: {
    scope: "live" | "local";
    database: ServiceStatus;
    cache: ServiceStatus;
    api: ServiceStatus;
    email: ServiceStatus;
    sms: ServiceStatus;
    storage: ServiceStatus;
  };
  // The API has sent this since the day it was written and no screen read it,
  // so the promise that branch isolation was "shown where somebody opens it"
  // was not true. The library type again, not a copy.
  branchIsolation?: BranchIsolationStatus;
}
