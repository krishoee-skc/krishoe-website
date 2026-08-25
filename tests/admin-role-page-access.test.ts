import { describe, expect, it } from "vitest";
import {
  canAccessAdminPath,
  canAdmin,
  getAdminPagePermission,
} from "@/lib/admin-role-permissions";

describe("admin page and action access", () => {
  it("maps every sensitive admin destination to a permission", () => {
    const paths = [
      "/admin",
      "/admin/factory",
      "/admin/alerts",
      "/admin/analytics",
      "/admin/feedback",
      "/admin/monitoring",
      "/admin/sms",
      "/admin/stock",
      "/admin/pos",
      "/admin/dues",
      "/admin/purchasing",
      "/admin/costing",
      "/admin/factory",
      "/admin/operations",
      "/admin/orders",
      "/admin/customers",
      "/admin/payments",
      "/admin/notifications",
      "/admin/reviews",
      "/admin/insights",
      "/admin/activity",
      "/admin/security",
      "/admin/settings",
      "/admin/products",
      "/admin/messages",
      "/admin/devices",
    ];

    for (const path of paths) {
      expect(getAdminPagePermission(path), path).not.toBeNull();
    }
  });

  it("keeps a Factory account inside factory and security tools", () => {
    expect(canAccessAdminPath("Factory", "/admin/factory")).toBe(true);
    expect(canAccessAdminPath("Factory", "/admin/devices")).toBe(true);
    expect(canAccessAdminPath("Factory", "/admin/pos")).toBe(false);
    expect(canAccessAdminPath("Factory", "/admin/settings")).toBe(false);
  });

  it("lets Sales read and operate sales without wage or settings access", () => {
    expect(canAccessAdminPath("Sales", "/admin/pos")).toBe(true);
    expect(canAccessAdminPath("Sales", "/admin/orders")).toBe(true);
    expect(canAdmin("Sales", "pos:write")).toBe(true);
    expect(canAccessAdminPath("Sales", "/admin/factory")).toBe(false);
    expect(canAdmin("Sales", "wages:write")).toBe(false);
    expect(canAdmin("Sales", "settings:write")).toBe(false);
  });

  it("keeps Viewer read-only", () => {
    expect(canAccessAdminPath("Viewer", "/admin/stock")).toBe(true);
    expect(canAdmin("Viewer", "stock:read")).toBe(true);
    expect(canAdmin("Viewer", "products:write")).toBe(false);
    expect(canAdmin("Viewer", "payments:write")).toBe(false);
    expect(canAdmin("Viewer", "feedback:read")).toBe(true);
    expect(canAdmin("Viewer", "feedback:write")).toBe(false);
  });

  it("keeps Worker accounts out of every admin page and action", () => {
    expect(canAccessAdminPath("Worker", "/admin")).toBe(false);
    expect(canAccessAdminPath("Worker", "/admin/factory")).toBe(false);
    expect(canAdmin("Worker", "dashboard:read")).toBe(false);
    expect(canAdmin("Worker", "production:entry")).toBe(false);
  });
});
