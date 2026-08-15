"use client";

import { useState } from "react";
import {
  adminNavGroups,
  workspaceForPath,
  type AdminWorkspace,
} from "@/app/admin/nav-links";
import { canAccessAdminPath, type AdminRole } from "@/lib/admin-role-permissions";

const STORAGE_KEY = "krishoe-admin-workspace";

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

/**
 * Which side of the business the menu is showing, and the groups to draw.
 *
 * Opening a factory page puts you on the factory side and a shop page on the
 * shop side, so a link from anywhere lands with the right menu already up. A
 * page that belongs to both — Stock, Settings — leaves the side alone rather
 * than throwing the reader across mid-task.
 *
 * The choice is remembered, because the side someone works on is a property of
 * their job, not of this visit.
 */
export function useAdminWorkspace(adminRole: AdminRole, pathname: string) {
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

  function chooseWorkspace(workspace: AdminWorkspace) {
    setChosen(workspace);
    try {
      window.localStorage.setItem(STORAGE_KEY, workspace);
    } catch {
      // Remembering is a convenience; failing to remember is not an error.
    }
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
