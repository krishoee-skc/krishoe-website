"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminNavGroups,
  workspaceDestination,
  workspaceForPath,
  type AdminWorkspace,
} from "@/app/admin/nav-links";
import { canAccessAdminPath, type AdminRole } from "@/lib/admin-role-permissions";

const STORAGE_KEY = "krishoe-admin-workspace";
const lastPageKey = (side: "factory" | "shop") => `krishoe-admin-last-page-${side}`;

function storedWorkspace(): AdminWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "factory" || value === "shop" ? value : null;
  } catch {
    // Private browsing and locked-down devices throw here. Losing the
    // remembered side is not worth taking the menu down for.
    return null;
  }
}

function storedLastPage(side: "factory" | "shop"): string | null {
  try {
    return window.localStorage.getItem(lastPageKey(side));
  } catch {
    return null;
  }
}

/**
 * Which side of the business the menu is showing, and the groups to draw.
 *
 * Opening a factory page puts you on the factory side and a shop page on the
 * shop side, so a link from anywhere lands with the right menu already up. A
 * page that belongs to both — Stock, Settings — leaves the side alone rather
 * than throwing the reader across mid-task.
 *
 * Pressing a side opens that side too, not only its menu: the last screen used
 * there, or its home. The switch once changed the menu alone, and the owner,
 * standing on POS, pressed Factory and was left with the factory menu beside a
 * bill.
 *
 * The choice is remembered, because the side someone works on is a property of
 * their job, not of this visit.
 */
export function useAdminWorkspace(adminRole: AdminRole, pathname: string) {
  const router = useRouter();
  const pathWorkspace = workspaceForPath(pathname);
  const [chosen, setChosen] = useState<AdminWorkspace>(() => {
    if (pathWorkspace !== "both") return pathWorkspace;
    return storedWorkspace() ?? "factory";
  });
  const [lastPath, setLastPath] = useState(pathname);

  // Render-time adjustment rather than an effect: React's sanctioned pattern
  // for state that follows a prop, and this project's lint forbids setState in
  // an effect.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (pathWorkspace !== "both" && pathWorkspace !== chosen) {
      setChosen(pathWorkspace);
    }
  }

  // The screen last used on each side, so coming back to a side returns to
  // the work that was left there rather than to its front door.
  useEffect(() => {
    if (pathWorkspace === "both") return;
    try {
      window.localStorage.setItem(lastPageKey(pathWorkspace), pathname);
    } catch {
      // Remembering is a convenience; failing to remember is not an error.
    }
  }, [pathWorkspace, pathname]);

  function chooseWorkspace(workspace: AdminWorkspace) {
    setChosen(workspace);
    try {
      window.localStorage.setItem(STORAGE_KEY, workspace);
    } catch {
      // Remembering is a convenience; failing to remember is not an error.
    }

    if (workspace === "both") return;
    const destination = workspaceDestination(
      workspace,
      pathname,
      storedLastPage(workspace),
      (href) => canAccessAdminPath(adminRole, href),
    );
    if (destination) router.push(destination);
  }

  const groups = adminNavGroups
    .filter((group) => group.workspace === chosen || group.workspace === "both")
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => canAccessAdminPath(adminRole, link.href)),
    }))
    .filter((group) => group.links.length > 0);

  return { workspace: chosen, chooseWorkspace, groups };
}
