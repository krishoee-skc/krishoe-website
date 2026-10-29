import AdminNav from "./AdminNav";
import AdminCommandBar from "./AdminCommandBar";
import PasskeyInvite from "@/components/admin/PasskeyInvite";
import OfflineSync from "@/components/admin/OfflineSync";
import AdminMobileNav from "./AdminMobileNav";
import WorkspaceBand from "./WorkspaceBand";
import AdminTrail from "./AdminTrail";
import AttentionReasons from "./AttentionReasons";
import { attentionByHref } from "./nav-attention";
import { runShopSelfCheck } from "@/lib/shop-self-check";
import AdminQuickDock from "./AdminQuickDock";
import { SidebarProvider } from "@/components/admin/SidebarProvider";
import { ToastProvider } from "@/components/admin/ToastProvider";
import LanguageSwitch from "@/components/LanguageSwitch";
import AdminTextSize, { AdminTextSizeApplier } from "@/components/admin/AdminTextSize";
import ThemeToggle from "@/components/ThemeToggle";
import AdminBell from "./AdminBell";
import { AdminProfileButton } from "./AdminAccount";
import { getAdminBell } from "@/lib/admin-bell";
import Image from "next/image";
import Link from "next/link";
import { getAdminSession, readViewingBranchId } from "@/lib/admin-auth";
import BranchSwitch from "@/components/admin/BranchSwitch";
import { getSessionAdminRole } from "@/lib/admin-permissions";
import { allBranchAdminRole } from "@/lib/admin-branch-context";
import { getAdminSettings } from "@/lib/admin-settings";
import { redirect } from "next/navigation";
import { canAccessAdminPath } from "@/lib/admin-role-permissions";
import { workerInboxCounts } from "@/lib/worker-portal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  const adminRole = getSessionAdminRole(session);

  // The branch's name for the menu. Never let this break the whole admin: a
  // settings read that fails should cost the label, not the page, so the card
  // falls back to the id it was already showing.
  const settings = await getAdminSettings().catch(() => null);

  // Whether every branch is on screen, decided the same two ways the database
  // access is: the legacy environment-password login carries no staff identity,
  // and the Owner is exempt by the rule in lib/admin-auth.ts. Read from
  // allBranchAdminRole rather than spelled again, so the screen cannot keep
  // saying "Owner" on the day that rule changes.
  const canSeeAllBranches = !session.staffId || adminRole === allBranchAdminRole;

  // The branch chosen from the switcher, or "" while all of them show. Read
  // from the same helper getAdminSession used, so the menu cannot disagree with
  // the rows on the page, and ignored for anyone who may not choose at all.
  const viewingBranchId = canSeeAllBranches ? await readViewingBranchId() : "";

  // The chip says "all branches" only when all of them really are on screen —
  // entitled to see them, and not currently narrowed to one.
  const seesAllBranches = canSeeAllBranches && !viewingBranchId;

  // The branch the menu names: the chosen one while narrowed, otherwise the one
  // the account is posted to. This is the branch whose rows the page is showing.
  const branch = settings?.branches.find(
    (row) => row.id === (viewingBranchId || session.branchId),
  );

  // What the shop already knows needs doing, shown on the menu rather than
  // only on /admin/alerts — a screen you have to think to visit. The same
  // eight checks, no extra question asked of the database.
  //
  // Never fatal: the menu is how every screen is reached, and a failing
  // check must not take the whole admin down with it.
  const [checks, inbox] = await Promise.all([
    runShopSelfCheck().catch(() => []),
    // How many workers' photos and questions wait, as a number on the menu
    // (owner, 2026-10-03). Only for those who may open that screen.
    canAccessAdminPath(adminRole, "/admin/factory/photos")
      ? workerInboxCounts().catch(() => ({ photos: 0, requests: 0 }))
      : Promise.resolve({ photos: 0, requests: 0 }),
  ]);
  const inboxWaiting = inbox.photos + inbox.requests;
  const counts: Record<string, number> = inboxWaiting > 0 ? { "/admin/factory/photos": inboxWaiting } : {};
  const attention = attentionByHref(checks);
  // The same checks, in words, at the top of the page the dot sends you to.
  const reasons = checks.map(({ id, severity, title, titleNe, detail, detailNe, href, action, actionNe }) => ({
    id, severity, title, titleNe, detail, detailNe, href, action, actionNe,
  }));
  // Everything that waits, under the 🔔 (owner, 2026-10-14) — the same checks
  // and counts, and the orders not billed yet. Never fatal.
  const bell = await getAdminBell({ role: adminRole, checks, inbox }).catch(() => []);

  const branchSwitch = canSeeAllBranches && settings ? (
    <BranchSwitch branches={settings.branches} viewingBranchId={viewingBranchId} />
  ) : null;
  const identity = {
    adminRole,
    adminName: session?.name,
    adminEmail: session?.email,
    branchId: session?.branchId,
    branchName: branch?.name,
    branchType: branch?.type,
    seesAllBranches,
    branchCount: settings?.branches.length,
    branchSwitch,
  };

  return (
    <ToastProvider>
    <SidebarProvider>
      <AdminNav
        attention={attention}
        counts={counts}
        {...identity}
      />
      <main className="admin-canvas min-w-0 overflow-x-clip bg-brand-paper-deep">
        <AdminTextSizeApplier />
        {/* The one top bar (owner, 2026-10-14, the menu sample). On a phone it
            was three layers — a bar, a search row and a coloured band, 164px
            before a page began — and on a computer two, 108px. Now one: 64px
            on a phone, 72px on a computer. Left, the page's name with its side
            above it (WorkspaceBand, which also draws the side's colour as a
            3px line along the top); then the search — a 🔍 on a phone — the 🔔
            of everything waiting, and on a tablet or computer the text size,
            the language and light or dark. On a phone those sit behind the
            round initials. It stays at the top while a phone scrolls; on a
            computer it scrolls away with the page, as the top row did, so the
            screens' own sticky rows keep their place. Relative there, not static
            (owner, 2026-10-21): static dropped its z-40, so the 🔔 list opened
            under the red notice below it and the two texts sat on each other. */}
        <header data-admin-chrome className="sticky top-0 z-40 border-b border-brand-green-line bg-brand-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:relative lg:bg-brand-paper print:hidden dark:bg-admin-sidebar-dark/95">
          <div className="relative flex h-16 items-center gap-2 px-3 sm:px-4 lg:h-[4.5rem] lg:gap-3 lg:px-6">
            <Link href="/admin/hub/home" aria-label="KRISHOE" className="shrink-0 md:hidden">
              <Image src="/images/logo-mark.png" alt="" width={72} height={72} className="h-9 w-9" />
            </Link>
            <WorkspaceBand />
            <div className="ml-auto flex items-center gap-2 md:ml-0 md:min-w-0 md:flex-1 lg:gap-3">
              <div className="md:min-w-0 md:max-w-xl md:flex-1">
                <AdminCommandBar />
              </div>
              <AdminBell items={bell} />
              {/* अ, the language and 🌙 as one button each, as the sample draws them. */}
              <div className="hidden items-center gap-2 md:flex lg:gap-3">
                <AdminTextSize single />
                <LanguageSwitch single />
                <ThemeToggle className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-green-line bg-brand-paper text-brand-green-ink transition hover:border-brand-green" />
              </div>
              <div className="md:hidden">
                <AdminProfileButton identity={identity} />
              </div>
            </div>
          </div>
        </header>
        <AdminMobileNav counts={counts} adminRole={adminRole} />
        {/* Where this screen sits, for the ones deep enough to need saying.
            Drawn here so every screen gets it without asking, and a new one is
            covered the day it appears. */}
        <AdminTrail />
        <AttentionReasons checks={reasons} />
        {children}
        <AdminQuickDock adminRole={adminRole} />
        {/* Offered just after signing in, on the device being held. It
            hides itself when this account already has a passkey, and once
            declined it does not come back. */}
        <PasskeyInvite />
        {/* Bills and work kept on this phone while the internet was away,
            sent from whichever screen is open when it is back (rule 4). */}
        <OfflineSync />
      </main>
    </SidebarProvider>
    </ToastProvider>
  );
}
