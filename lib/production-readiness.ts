import { adminRoles, getConfiguredAdminRole } from "@/lib/admin-role-permissions";
import { getAdminSettings, type AdminSettingsSnapshot } from "@/lib/admin-settings";
import { getDataBackendConfig } from "@/lib/data-backend";

export type ReadinessStatus = "ready" | "warning" | "blocked";

export type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  envKeys: string[];
};

const placeholderValues = new Set([
  "change-this-admin-password",
  "replace-with-a-long-random-secret-at-least-32-characters",
  "changeme",
  "password",
]);

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function hasEnv(key: string) {
  const value = envValue(key);
  return value.length > 0 && !placeholderValues.has(value.toLowerCase());
}

function hasLongSecret(key: string, minLength = 32) {
  return hasEnv(key) && envValue(key).length >= minLength;
}

function siteUrlStatus(): ReadinessCheck {
  const siteUrl = envValue("NEXT_PUBLIC_SITE_URL");
  const looksProduction = /^https:\/\/[^/]+/i.test(siteUrl) && !siteUrl.includes("localhost");

  return {
    id: "site-url",
    label: "Production URL",
    status: looksProduction ? "ready" : "warning",
    detail: looksProduction
      ? "Public site URL is configured for metadata, sitemap, robots, and order links."
      : "Set NEXT_PUBLIC_SITE_URL to the final HTTPS domain before launch.",
    envKeys: ["NEXT_PUBLIC_SITE_URL"],
  };
}

function authStatus(): ReadinessCheck {
  const passwordReady = hasEnv("ADMIN_PASSWORD");
  const adminSessionSecretReady = hasLongSecret("ADMIN_SESSION_SECRET");
  const customerSessionSecretReady = hasLongSecret("CUSTOMER_SESSION_SECRET");
  const ready = passwordReady && adminSessionSecretReady && customerSessionSecretReady;

  return {
    id: "auth-security",
    label: "Auth and session security",
    status: ready ? "ready" : "blocked",
    detail:
      ready
        ? "Admin password plus admin/customer signed session secrets are configured."
        : "Set a strong admin password and long random admin/customer session secrets.",
    envKeys: [
      "ADMIN_PASSWORD",
      "ADMIN_SESSION_SECRET",
      "ADMIN_SESSION_TTL_SECONDS",
      "CUSTOMER_SESSION_SECRET",
      "CUSTOMER_SESSION_TTL_SECONDS",
    ],
  };
}

function adminRoleStatus(): ReadinessCheck {
  const configuredRole = envValue("ADMIN_ROLE");
  const role = getConfiguredAdminRole();
  const explicitRole = adminRoles.includes(configuredRole as (typeof adminRoles)[number]);

  return {
    id: "admin-role",
    label: "Admin role permissions",
    status: explicitRole ? "ready" : "warning",
    detail: explicitRole
      ? `ADMIN_ROLE=${role} is configured as the setup fallback. Staff account sessions now enforce their own role permissions.`
      : `ADMIN_ROLE is not set or invalid, so fallback admin sessions default to ${role}. Create real staff accounts and assign Owner, Manager, Accountant, HR, Inventory, Sales, or Viewer before production.`,
    envKeys: ["ADMIN_ROLE"],
  };
}

function staffAccountStatus(settings: AdminSettingsSnapshot): ReadinessCheck {
  const activeStaff = settings.staff.filter((member) => member.status === "Active");
  const activeOwners = activeStaff.filter((member) => member.role === "Owner");
  const disabledStaff = settings.staff.length - activeStaff.length;

  if (activeOwners.length === 0) {
    return {
      id: "staff-accounts",
      label: "Real staff accounts",
      status: "blocked",
      detail:
        settings.staff.length === 0
          ? "No real admin staff account exists yet. Create at least one active Owner in /admin/settings before production and use bootstrap login only for setup."
          : `There are ${settings.staff.length} staff account(s), but no active Owner. Promote or enable one Owner before production.`,
      envKeys: [],
    };
  }

  return {
    id: "staff-accounts",
    label: "Real staff accounts",
    status: "ready",
    detail: `${activeStaff.length} active staff account(s), ${activeOwners.length} active Owner account(s), ${disabledStaff} disabled. Staff login can replace bootstrap admin for production work.`,
    envKeys: [],
  };
}

function databaseStatus(): ReadinessCheck {
  const config = getDataBackendConfig();

  if (!config.isSupported) {
    return {
      id: "database",
      label: "Real database",
      status: "blocked",
      detail: `Unsupported DATA_BACKEND=${config.rawBackend}. Use local-json or postgres.`,
      envKeys: ["DATA_BACKEND", "DATABASE_URL"],
    };
  }

  if (config.backend === "local-json") {
    return {
      id: "database",
      label: "Real database",
      status: "warning",
      detail: "App is still using local JSON persistence. Keep this during development, then switch after Postgres adapter smoke tests pass.",
      envKeys: ["DATA_BACKEND", "DATABASE_URL"],
    };
  }

  if (!config.hasDatabaseUrl) {
    return {
      id: "database",
      label: "Real database",
      status: "blocked",
      detail: "DATA_BACKEND=postgres requires DATABASE_URL.",
      envKeys: ["DATA_BACKEND", "DATABASE_URL"],
    };
  }

  if (config.pendingPostgresStores.length === 0) {
    return {
      id: "database",
      label: "Real database",
      status: "ready",
      detail: "DATA_BACKEND=postgres and DATABASE_URL are configured. Run preview import and read/write smoke tests before production traffic.",
      envKeys: ["DATA_BACKEND", "DATABASE_URL"],
    };
  }

  return {
    id: "database",
    label: "Real database",
    status: "blocked",
    detail: `DATA_BACKEND=postgres is selected, but adapters are partial. Implement pending stores before launch: ${config.pendingPostgresStores.join(", ")}.`,
    envKeys: ["DATA_BACKEND", "DATABASE_URL"],
  };
}

function paymentStatus(): ReadinessCheck {
  const mode = envValue("PAYMENT_MODE").toLowerCase() || "manual";
  const esewaReady = hasEnv("ESEWA_MERCHANT_ID") && hasEnv("ESEWA_SECRET_KEY");
  const khaltiReady = hasEnv("KHALTI_SECRET_KEY");
  const readyProviders = [
    esewaReady ? "eSewa" : "",
    khaltiReady ? "Khalti" : "",
  ].filter(Boolean);

  if (mode === "live") {
    return {
      id: "payment",
      label: "Payment gateways",
      status: "blocked",
      detail: "PAYMENT_MODE=live is blocked until merchant live credentials, production callback URLs, and provider-side verification are fully tested.",
      envKeys: [
        "PAYMENT_MODE",
        "ESEWA_MERCHANT_ID",
        "ESEWA_SECRET_KEY",
        "ESEWA_STATUS_CHECK_URL",
        "ESEWA_VERIFY_WITH_STATUS_CHECK",
        "KHALTI_PUBLIC_KEY",
        "KHALTI_SECRET_KEY",
        "KHALTI_API_BASE_URL",
      ],
    };
  }

  return {
    id: "payment",
    label: "Payment gateways",
    status: mode === "sandbox" && readyProviders.length > 0 ? "ready" : "warning",
    detail:
      mode === "sandbox" && readyProviders.length > 0
        ? `Sandbox payment route(s) configured for: ${readyProviders.join(", ")}. eSewa and Khalti callbacks verify server-side before order settlement.`
        : "Payment is inquiry/manual mode. Set PAYMENT_MODE=sandbox and add eSewa or Khalti keys for sandbox route tests.",
    envKeys: [
      "PAYMENT_MODE",
      "ESEWA_MERCHANT_ID",
      "ESEWA_SECRET_KEY",
      "ESEWA_STATUS_CHECK_URL",
      "ESEWA_VERIFY_WITH_STATUS_CHECK",
      "KHALTI_PUBLIC_KEY",
      "KHALTI_SECRET_KEY",
      "KHALTI_API_BASE_URL",
    ],
  };
}

function notificationStatus(): ReadinessCheck {
  const emailReady =
    hasEnv("EMAIL_PROVIDER_URL") && hasEnv("ADMIN_NOTIFICATION_EMAIL");
  const passwordResetEmailReady = hasEnv("EMAIL_PROVIDER_URL");
  const smsReady =
    hasEnv("SMS_PROVIDER_URL") && hasEnv("ADMIN_NOTIFICATION_PHONE");
  const webhookReady = hasEnv("NOTIFICATION_WEBHOOK_URL");
  const readyChannels = [
    emailReady ? "email" : "",
    smsReady ? "SMS" : "",
    webhookReady ? "webhook" : "",
  ].filter(Boolean);

  return {
    id: "notifications",
    label: "Email / SMS alerts",
    status: readyChannels.length > 0 && passwordResetEmailReady ? "ready" : "warning",
    detail:
      readyChannels.length > 0 && passwordResetEmailReady
        ? `Notification channel(s) configured: ${readyChannels.join(", ")}. Customer password reset email delivery is available.`
        : passwordResetEmailReady
          ? "Customer password reset email delivery is configured. Add admin email/SMS/webhook alerts for order and message operations."
          : "Orders/messages are queued, but password reset emails need EMAIL_PROVIDER_URL before production.",
    envKeys: [
      "ADMIN_NOTIFICATION_EMAIL",
      "ADMIN_NOTIFICATION_PHONE",
      "EMAIL_PROVIDER_URL",
      "EMAIL_PROVIDER_TOKEN",
      "PASSWORD_RESET_SHOW_LOCAL_LINK",
      "SMS_PROVIDER_URL",
      "SMS_PROVIDER_TOKEN",
      "NOTIFICATION_WEBHOOK_URL",
      "NOTIFICATION_WEBHOOK_TOKEN",
      "NOTIFICATION_DELIVERY_TIMEOUT_MS",
    ],
  };
}

function vercelStatus(): ReadinessCheck {
  const vercelEnv = envValue("VERCEL_ENV");
  const vercelUrl = envValue("VERCEL_URL");

  return {
    id: "vercel",
    label: "Vercel env / domain",
    status: vercelEnv || vercelUrl ? "ready" : "warning",
    detail:
      vercelEnv || vercelUrl
        ? `Vercel runtime detected${vercelEnv ? ` (${vercelEnv})` : ""}.`
        : "Local build only. Add production env vars and final domain in Vercel before launch.",
    envKeys: ["VERCEL_ENV", "VERCEL_URL"],
  };
}

export function getProductionReadiness(): ReadinessCheck[] {
  return [
    authStatus(),
    adminRoleStatus(),
    siteUrlStatus(),
    databaseStatus(),
    paymentStatus(),
    notificationStatus(),
    vercelStatus(),
    {
      id: "security-headers",
      label: "Security headers",
      status: "ready",
      detail: "next.config.js disables the powered-by header and applies frame, content-type, referrer, permissions, COOP/CORP, and production HSTS headers.",
      envKeys: [],
    },
    {
      id: "admin-api-permissions",
      label: "Protected admin APIs",
      status: "ready",
      detail: "Proxy returns 401 for logged-out admin API requests and 403 when the staff role lacks the mapped permission; route handlers still re-check permissions.",
      envKeys: [],
    },
    {
      id: "rate-limit",
      label: "Abuse protection",
      status: "ready",
      detail: "Admin login, customer login, and public submissions are rate-limited server-side, with shared Postgres storage when DATA_BACKEND=postgres.",
      envKeys: [],
    },
    {
      id: "backup-audit",
      label: "Backup / audit",
      status: "ready",
      detail: "Login/logout, backup export, sensitive CSV exports, order/product changes, settings, and operations mutations are audited with staff actor identity when available.",
      envKeys: [],
    },
  ];
}

export function summarizeProductionReadiness(checks: ReadinessCheck[]) {
  const blocked = checks.filter((check) => check.status === "blocked").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  const ready = checks.filter((check) => check.status === "ready").length;

  return {
    total: checks.length,
    ready,
    warnings,
    blocked,
    launchReady: blocked === 0 && warnings === 0,
  };
}

export function getProductionReadinessSummary() {
  return summarizeProductionReadiness(getProductionReadiness());
}

export async function getProductionReadinessWithData() {
  const settings = await getAdminSettings();
  const checks = getProductionReadiness();
  const adminRoleIndex = checks.findIndex((check) => check.id === "admin-role");
  const staffCheck = staffAccountStatus(settings);

  if (adminRoleIndex >= 0) {
    checks.splice(adminRoleIndex + 1, 0, staffCheck);
  } else {
    checks.push(staffCheck);
  }

  return checks;
}

export async function getProductionReadinessSummaryWithData() {
  return summarizeProductionReadiness(await getProductionReadinessWithData());
}
