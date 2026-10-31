import type { Metadata } from "next";
import LoadFailure from "@/components/admin/LoadFailure";
import { getAdminSession } from "@/lib/admin-auth";
import { canAccessAdminPath, canAdmin, getSessionAdminRole, type AdminPermission } from "@/lib/admin-role-permissions";
import { toBikramSambatNumeric } from "@/lib/bikram-sambat";
import { getDayBook, getParties } from "@/lib/day-book";
import { chequeBookReady, getUsedBanks } from "@/lib/cheque-book";
import { getCashDay } from "@/lib/cash-days";
import { isDayKey, shiftDay, type DayBookArea } from "@/lib/day-book-rules";
import { nepalDay } from "@/lib/nepal-day";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import TransactionsHub, { type HubView } from "@/app/admin/transactions/_components/TransactionsHub";
import { twoBusinessReady } from "@/lib/two-business";

export const metadata: Metadata = {
  title: "Transactions | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ v?: string; day?: string; tab?: string; saved?: string; said?: string }>;
};

/** Which list a Day Book line comes from, and who may read that list. */
const AREA_PERMISSION: Record<DayBookArea, AdminPermission> = {
  pos: "pos:read",
  purchase: "purchasing:read",
  supplier: "purchasing:read",
  customer: "dues:read",
  wages: "operations:read",
  transfer: "operations:read",
};

/**
 * Transactions (कारोबार): sale, purchase, money in and money out from one
 * door, with the day's book beside them (owner, 2026-10-28, the Tally-style
 * namuna; "garau" with Alt + 1–4).
 *
 * Sale and Purchase open the counter bill and the purchase bill whole — those
 * screens are large, and put inside this one they would slow both. Money in
 * and Money out are small forms on the books' own rules. Each person sees the
 * buttons and the lines their role may use.
 */
export default async function TransactionsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const session = await getAdminSession();
  const role = getSessionAdminRole(session);
  const can = (permission: AdminPermission) => canAdmin(role, permission);

  const today = nepalDay();
  const day = isDayKey(params.day) && params.day <= today ? params.day : today;
  const views: HubView[] = ["sale", "buy", "in", "out"];
  const view = views.includes(params.v as HubView) ? (params.v as HubView) : "in";

  let loaded;
  try {
    loaded = await Promise.all([
      getDayBook(day),
      getParties(),
      // The cheque book, for a cheque taken in Money in. Never fatal.
      can("operations:write") ? chequeBookReady().catch(() => false) : Promise.resolve(false),
      // The drawer's morning cash and evening count; null until its table is there.
      getCashDay(day).catch(() => null),
    ]);
  } catch (error) {
    reportError("load the transactions page", error);
    return (
      <LoadFailure
        what="the day book"
        message={saveFailureMessage(error, "Could not load the day book.")}
        retryHref="/admin/transactions"
      />
    );
  }
  const [rows, parties, chequeReady, cashDay] = loaded;
  // The drawer check writes back with ?tab=book and no ?v=.
  const drawerMessage = params.tab === "book" && !params.v && Boolean(params.saved || params.said);
  const usedBanks = chequeReady ? await getUsedBanks("in").catch(() => []) : [];
  // The factory and the shop apart, once they are two businesses (owner, 2026-10-31).
  const twoBusiness = await twoBusinessReady().catch(() => false);

  return (
    <TransactionsHub
      initialView={view}
      initialTab={params.tab === "parties" ? "parties" : "book"}
      day={day}
      dayBs={toBikramSambatNumeric(day)}
      today={today}
      previousDay={shiftDay(day, -1)}
      nextDay={day < today ? shiftDay(day, 1) : ""}
      rows={rows === null ? null : rows.filter((row) => can(AREA_PERMISSION[row.area]))}
      parties={(parties ?? []).filter((party) => (party.side === "customer" ? can("dues:read") : can("purchasing:read")))}
      saved={params.saved ?? ""}
      said={params.said ?? ""}
      cheque={{ ready: chequeReady, usedBanks, todayKey: today }}
      twoBusiness={twoBusiness}
      drawerMessage={drawerMessage}
      drawer={{
        ready: cashDay !== null,
        opening: cashDay?.opening ?? null,
        counted: cashDay?.counted ?? null,
        mayWrite: can("pos:write"),
        mayPrepare: can("settings:write"),
        saved: drawerMessage ? params.saved ?? "" : "",
        said: drawerMessage ? params.said ?? "" : "",
      }}
      may={{
        sale: can("pos:write"),
        purchase: can("purchasing:write"),
        moneyIn: can("operations:write"),
        moneyOut: can("purchasing:write"),
        wages: canAccessAdminPath(role, "/admin/operations/production-accounts/payments") && can("wages:write"),
        customerLedger: canAccessAdminPath(role, "/admin/operations/ledger"),
        supplierLedger: canAccessAdminPath(role, "/admin/purchasing/supplier"),
        reports: can("pos:read"),
      }}
    />
  );
}
