import { promises as fs } from "fs";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import path from "path";
import { promisify } from "node:util";
import { adminRoles, type AdminRole } from "@/lib/admin-permissions";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

export const companyBranchTypes = ["Factory", "Wholesale", "Retail", "Online", "Office"] as const;
export const companyBranchStatuses = ["Active", "Inactive"] as const;
export const adminStaffStatuses = ["Active", "Disabled"] as const;

export type CompanyBranchType = (typeof companyBranchTypes)[number];
export type CompanyBranchStatus = (typeof companyBranchStatuses)[number];
export type AdminStaffStatus = (typeof adminStaffStatuses)[number];

export type CompanySettings = {
  id: "default";
  companyName: string;
  legalName: string;
  phone: string;
  email: string;
  address: string;
  panVatNumber: string;
  currency: string;
  timezone: string;
  defaultBranchId: string;
  updatedAt: string;
};

export type CompanyBranch = {
  id: string;
  name: string;
  code: string;
  type: CompanyBranchType;
  phone: string;
  address: string;
  status: CompanyBranchStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminStaffAccount = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  branchId: string;
  status: AdminStaffStatus;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type SafeAdminStaffAccount = Omit<AdminStaffAccount, "passwordHash">;

export type AdminSettingsSnapshot = {
  company: CompanySettings;
  branches: CompanyBranch[];
  staff: SafeAdminStaffAccount[];
};

type AdminSettingsStore = {
  company: CompanySettings;
  branches: CompanyBranch[];
  staff: AdminStaffAccount[];
};

type CompanySettingsRow = {
  id: string;
  company_name: string;
  legal_name: string;
  phone: string;
  email: string;
  address: string;
  pan_vat_number: string;
  currency: string;
  timezone: string;
  default_branch_id: string;
  updated_at: Date | string;
};

type CompanyBranchRow = {
  id: string;
  name: string;
  code: string;
  type: CompanyBranchType;
  phone: string;
  address: string;
  status: CompanyBranchStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

type AdminStaffAccountRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  branch_id: string;
  status: AdminStaffStatus;
  password_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
};

const dataDir = path.join(process.cwd(), "data");
const adminSettingsFile = path.join(dataDir, "admin-settings.json");
const scrypt = promisify(scryptCallback);

function nowIso() {
  return new Date().toISOString();
}

function isoDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

function requiredText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

function optionalText(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function allowedValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeCode(value: string | undefined, fallback: string) {
  const code = requiredText(value, fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);

  return code || fallback;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(storedHash, "hex");

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function createDefaultBranches(stamp = nowIso()): CompanyBranch[] {
  return [
    {
      id: "branch-factory-main",
      name: "Main Factory",
      code: "FACTORY",
      type: "Factory",
      phone: "",
      address: "",
      status: "Active",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: "branch-retail-main",
      name: "Main Retail Shop",
      code: "RETAIL",
      type: "Retail",
      phone: "",
      address: "",
      status: "Active",
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];
}

function createDefaultSettings(): AdminSettingsStore {
  const stamp = nowIso();
  const branches = createDefaultBranches(stamp);

  return {
    company: {
      id: "default",
      companyName: "KRISHOE",
      legalName: "KRISHOE",
      phone: "",
      email: "",
      address: "",
      panVatNumber: "",
      currency: "NPR",
      timezone: "Asia/Kathmandu",
      defaultBranchId: branches[0]?.id ?? "",
      updatedAt: stamp,
    },
    branches,
    staff: [],
  };
}

function branchFromRow(row: CompanyBranchRow): CompanyBranch {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: allowedValue(row.type, companyBranchTypes, "Office"),
    phone: row.phone,
    address: row.address,
    status: allowedValue(row.status, companyBranchStatuses, "Active"),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function staffFromRow(row: AdminStaffAccountRow): AdminStaffAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: allowedValue(row.role, adminRoles, "Viewer"),
    branchId: row.branch_id,
    status: allowedValue(row.status, adminStaffStatuses, "Active"),
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastLoginAt: isoDate(row.last_login_at),
  };
}

function companyFromRow(row: CompanySettingsRow, defaultBranchId: string): CompanySettings {
  return {
    id: "default",
    companyName: row.company_name,
    legalName: row.legal_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    panVatNumber: row.pan_vat_number,
    currency: row.currency,
    timezone: row.timezone,
    defaultBranchId: row.default_branch_id || defaultBranchId,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function normalizeStore(value: unknown): AdminSettingsStore {
  const fallback = createDefaultSettings();
  const source = value && typeof value === "object" ? (value as Partial<AdminSettingsStore>) : {};
  const rawBranches = Array.isArray(source.branches) ? source.branches : fallback.branches;
  const branches = rawBranches.map((branch, index) => {
    const item = branch as Partial<CompanyBranch>;
    const stamp = nowIso();
    const name = requiredText(item.name, index === 0 ? "Main Factory" : "Branch");

    return {
      id: requiredText(item.id, `branch-${crypto.randomUUID()}`),
      name,
      code: normalizeCode(item.code, name.toUpperCase().slice(0, 12) || "BRANCH"),
      type: allowedValue(item.type, companyBranchTypes, "Office"),
      phone: optionalText(item.phone),
      address: optionalText(item.address),
      status: allowedValue(item.status, companyBranchStatuses, "Active"),
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : stamp,
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : stamp,
    };
  });
  const defaultBranchId = branches.some((branch) => branch.id === source.company?.defaultBranchId)
    ? source.company?.defaultBranchId ?? branches[0]?.id ?? ""
    : branches[0]?.id ?? "";

  return {
    company: {
      id: "default",
      companyName: requiredText(source.company?.companyName, fallback.company.companyName),
      legalName: requiredText(source.company?.legalName, fallback.company.legalName),
      phone: optionalText(source.company?.phone),
      email: optionalText(source.company?.email),
      address: optionalText(source.company?.address),
      panVatNumber: optionalText(source.company?.panVatNumber),
      currency: requiredText(source.company?.currency, "NPR").toUpperCase().slice(0, 3),
      timezone: requiredText(source.company?.timezone, "Asia/Kathmandu"),
      defaultBranchId,
      updatedAt: source.company?.updatedAt ? new Date(source.company.updatedAt).toISOString() : nowIso(),
    },
    branches,
    staff: (Array.isArray(source.staff) ? source.staff : []).reduce<AdminStaffAccount[]>(
      (records, staff) => {
        const item = staff as Partial<AdminStaffAccount>;
        const email = normalizeEmail(item.email ?? "");

        if (!email || !item.passwordHash) {
          return records;
        }

        const stamp = nowIso();
        const lastLoginAt = isoDate(item.lastLoginAt);
        const record: AdminStaffAccount = {
          id: requiredText(item.id, `staff-${crypto.randomUUID()}`),
          name: requiredText(item.name, email),
          email,
          role: allowedValue(item.role, adminRoles, "Viewer"),
          branchId: branches.some((branch) => branch.id === item.branchId)
            ? item.branchId ?? defaultBranchId
            : defaultBranchId,
          status: allowedValue(item.status, adminStaffStatuses, "Active"),
          passwordHash: item.passwordHash,
          createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : stamp,
          updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : stamp,
          ...(lastLoginAt ? { lastLoginAt } : {}),
        };

        records.push(record);
        return records;
      },
      [],
    ),
  };
}

async function readSettingsFromLocalJson(): Promise<AdminSettingsStore> {
  try {
    const content = await fs.readFile(adminSettingsFile, "utf8");
    return normalizeStore(JSON.parse(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createDefaultSettings();
    }

    throw error;
  }
}

async function writeSettingsToLocalJson(settings: AdminSettingsStore) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(adminSettingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

async function readSettingsFromPostgres(): Promise<AdminSettingsStore> {
  const [branchRows, staffRows] = await Promise.all([
    queryPostgres<CompanyBranchRow>(
      "admin settings",
      `
        SELECT id, name, code, type, phone, address, status, created_at, updated_at
        FROM company_branches
        ORDER BY created_at ASC
      `,
    ),
    queryPostgres<AdminStaffAccountRow>(
      "admin settings",
      `
        SELECT id, name, email, role, branch_id, status, password_hash, created_at, updated_at, last_login_at
        FROM admin_staff_accounts
        ORDER BY created_at DESC
      `,
    ),
  ]);
  const branches = branchRows.map(branchFromRow);
  const fallback = createDefaultSettings();
  const defaultBranchId = branches[0]?.id ?? fallback.company.defaultBranchId;
  const companyRows = await queryPostgres<CompanySettingsRow>(
    "admin settings",
    `
      SELECT id, company_name, legal_name, phone, email, address, pan_vat_number,
        currency, timezone, default_branch_id, updated_at
      FROM company_settings
      WHERE id = 'default'
      LIMIT 1
    `,
  );

  return {
    company: companyRows[0] ? companyFromRow(companyRows[0], defaultBranchId) : fallback.company,
    branches: branches.length > 0 ? branches : fallback.branches,
    staff: staffRows.map(staffFromRow),
  };
}

function toSafeStaff(staff: AdminStaffAccount): SafeAdminStaffAccount {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    branchId: staff.branchId,
    status: staff.status,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    lastLoginAt: staff.lastLoginAt,
  };
}

function toSnapshot(settings: AdminSettingsStore): AdminSettingsSnapshot {
  return {
    company: settings.company,
    branches: settings.branches,
    staff: settings.staff.map(toSafeStaff),
  };
}

export async function getAdminSettings() {
  const settings = await runWithDataBackend({
    storeName: "admin settings",
    localJson: readSettingsFromLocalJson,
    postgres: readSettingsFromPostgres,
  });

  return toSnapshot(settings);
}

export async function getAdminSettingsForBackup() {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: readSettingsFromLocalJson,
    postgres: readSettingsFromPostgres,
  });
}

async function saveCompanySettingsToLocalJson(input: Partial<CompanySettings>) {
  const settings = await readSettingsFromLocalJson();
  const defaultBranchId = settings.branches.some((branch) => branch.id === input.defaultBranchId)
    ? input.defaultBranchId ?? settings.company.defaultBranchId
    : settings.company.defaultBranchId;

  settings.company = {
    ...settings.company,
    companyName: requiredText(input.companyName, settings.company.companyName),
    legalName: requiredText(input.legalName, settings.company.legalName),
    phone: optionalText(input.phone),
    email: optionalText(input.email),
    address: optionalText(input.address),
    panVatNumber: optionalText(input.panVatNumber),
    currency: requiredText(input.currency, settings.company.currency).toUpperCase().slice(0, 3),
    timezone: requiredText(input.timezone, settings.company.timezone),
    defaultBranchId,
    updatedAt: nowIso(),
  };
  await writeSettingsToLocalJson(settings);
  return settings.company;
}

async function saveCompanySettingsToPostgres(input: Partial<CompanySettings>) {
  const settings = await readSettingsFromPostgres();
  const defaultBranchId = settings.branches.some((branch) => branch.id === input.defaultBranchId)
    ? input.defaultBranchId ?? settings.company.defaultBranchId
    : settings.company.defaultBranchId;
  const nextCompany: CompanySettings = {
    ...settings.company,
    companyName: requiredText(input.companyName, settings.company.companyName),
    legalName: requiredText(input.legalName, settings.company.legalName),
    phone: optionalText(input.phone),
    email: optionalText(input.email),
    address: optionalText(input.address),
    panVatNumber: optionalText(input.panVatNumber),
    currency: requiredText(input.currency, settings.company.currency).toUpperCase().slice(0, 3),
    timezone: requiredText(input.timezone, settings.company.timezone),
    defaultBranchId,
    updatedAt: nowIso(),
  };
  const defaultBranch = settings.branches.find((branch) => branch.id === defaultBranchId);

  if (defaultBranch) {
    await ensureCompanyBranchInPostgres(defaultBranch);
  }

  const rows = await queryPostgres<CompanySettingsRow>(
    "admin settings",
    `
      INSERT INTO company_settings (
        id, company_name, legal_name, phone, email, address, pan_vat_number,
        currency, timezone, default_branch_id, updated_at
      )
      VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        legal_name = EXCLUDED.legal_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        pan_vat_number = EXCLUDED.pan_vat_number,
        currency = EXCLUDED.currency,
        timezone = EXCLUDED.timezone,
        default_branch_id = EXCLUDED.default_branch_id,
        updated_at = EXCLUDED.updated_at
      RETURNING id, company_name, legal_name, phone, email, address, pan_vat_number,
        currency, timezone, default_branch_id, updated_at
    `,
    [
      nextCompany.companyName,
      nextCompany.legalName,
      nextCompany.phone,
      nextCompany.email,
      nextCompany.address,
      nextCompany.panVatNumber,
      nextCompany.currency,
      nextCompany.timezone,
      nextCompany.defaultBranchId,
      new Date(nextCompany.updatedAt),
    ],
  );

  return companyFromRow(rows[0], nextCompany.defaultBranchId);
}

export async function saveCompanySettings(input: Partial<CompanySettings>) {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: () => saveCompanySettingsToLocalJson(input),
    postgres: () => saveCompanySettingsToPostgres(input),
  });
}

async function createBranchRecord(input: Partial<CompanyBranch>): Promise<CompanyBranch> {
  const stamp = nowIso();
  const name = requiredText(input.name, "");

  if (!name) {
    throw new Error("Branch name is required.");
  }

  return {
    id: `branch-${crypto.randomUUID()}`,
    name,
    code: normalizeCode(input.code, name.toUpperCase().slice(0, 12) || "BRANCH"),
    type: allowedValue(input.type, companyBranchTypes, "Retail"),
    phone: optionalText(input.phone),
    address: optionalText(input.address),
    status: allowedValue(input.status, companyBranchStatuses, "Active"),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

async function addCompanyBranchToLocalJson(input: Partial<CompanyBranch>) {
  const settings = await readSettingsFromLocalJson();
  const branch = await createBranchRecord(input);

  if (settings.branches.some((item) => item.code === branch.code)) {
    throw new Error("Branch code already exists.");
  }

  settings.branches.push(branch);
  await writeSettingsToLocalJson(settings);
  return branch;
}

async function addCompanyBranchToPostgres(input: Partial<CompanyBranch>) {
  const branch = await createBranchRecord(input);
  const rows = await queryPostgres<CompanyBranchRow>(
    "admin settings",
    `
      INSERT INTO company_branches (id, name, code, type, phone, address, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, code, type, phone, address, status, created_at, updated_at
    `,
    [
      branch.id,
      branch.name,
      branch.code,
      branch.type,
      branch.phone,
      branch.address,
      branch.status,
      new Date(branch.createdAt),
      new Date(branch.updatedAt),
    ],
  );

  return branchFromRow(rows[0]);
}

async function ensureCompanyBranchInPostgres(branch: CompanyBranch) {
  await queryPostgres<{ id: string }>(
    "admin settings",
    `
      INSERT INTO company_branches (id, name, code, type, phone, address, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    [
      branch.id,
      branch.name,
      branch.code,
      branch.type,
      branch.phone,
      branch.address,
      branch.status,
      new Date(branch.createdAt),
      new Date(branch.updatedAt),
    ],
  );
}

export async function addCompanyBranch(input: Partial<CompanyBranch>) {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: () => addCompanyBranchToLocalJson(input),
    postgres: () => addCompanyBranchToPostgres(input),
  });
}

function assertAtLeastOneActiveOwner(staff: AdminStaffAccount[]) {
  if (staff.length === 0) {
    return;
  }

  const hasActiveOwner = staff.some((member) => member.role === "Owner" && member.status === "Active");

  if (!hasActiveOwner) {
    throw new Error("At least one active Owner staff account is required.");
  }
}

async function staffRecordFromInput(
  input: {
    id?: string;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    branchId?: string;
    status?: string;
  },
  existing?: AdminStaffAccount,
  defaultBranchId = "",
) {
  const email = normalizeEmail(input.email ?? existing?.email ?? "");
  const password = input.password?.trim() ?? "";

  if (!email) {
    throw new Error("Staff email is required.");
  }

  if (!existing && password.length < 8) {
    throw new Error("New staff password must be at least 8 characters.");
  }

  if (existing && password && password.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  const stamp = nowIso();

  return {
    id: existing?.id ?? input.id ?? `staff-${crypto.randomUUID()}`,
    name: requiredText(input.name, existing?.name ?? email),
    email,
    role: allowedValue(input.role, adminRoles, existing?.role ?? "Viewer"),
    branchId: requiredText(input.branchId, existing?.branchId ?? defaultBranchId),
    status: allowedValue(input.status, adminStaffStatuses, existing?.status ?? "Active"),
    passwordHash: password ? await hashPassword(password) : existing?.passwordHash ?? "",
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    lastLoginAt: existing?.lastLoginAt,
  } satisfies AdminStaffAccount;
}

async function saveAdminStaffAccountToLocalJson(input: Parameters<typeof staffRecordFromInput>[0]) {
  const settings = await readSettingsFromLocalJson();
  const existingIndex = settings.staff.findIndex((member) =>
    input.id ? member.id === input.id : normalizeEmail(member.email) === normalizeEmail(input.email ?? ""),
  );
  const existing = existingIndex >= 0 ? settings.staff[existingIndex] : undefined;
  const defaultBranchId = settings.company.defaultBranchId || settings.branches[0]?.id || "";
  const nextStaff = await staffRecordFromInput(input, existing, defaultBranchId);

  if (!settings.branches.some((branch) => branch.id === nextStaff.branchId)) {
    throw new Error("Choose a valid branch for this staff account.");
  }

  if (settings.staff.some((member) => member.id !== nextStaff.id && normalizeEmail(member.email) === nextStaff.email)) {
    throw new Error("Staff email already exists.");
  }

  if (existingIndex >= 0) {
    settings.staff[existingIndex] = nextStaff;
  } else {
    settings.staff.unshift(nextStaff);
  }

  assertAtLeastOneActiveOwner(settings.staff);
  await writeSettingsToLocalJson(settings);
  return toSafeStaff(nextStaff);
}

async function saveAdminStaffAccountToPostgres(input: Parameters<typeof staffRecordFromInput>[0]) {
  const settings = await readSettingsFromPostgres();
  const existing = input.id
    ? settings.staff.find((member) => member.id === input.id)
    : settings.staff.find((member) => normalizeEmail(member.email) === normalizeEmail(input.email ?? ""));
  const defaultBranchId = settings.company.defaultBranchId || settings.branches[0]?.id || "";
  const nextStaff = await staffRecordFromInput(input, existing, defaultBranchId);

  if (!settings.branches.some((branch) => branch.id === nextStaff.branchId)) {
    throw new Error("Choose a valid branch for this staff account.");
  }

  const staffBranch = settings.branches.find((branch) => branch.id === nextStaff.branchId);

  if (staffBranch) {
    await ensureCompanyBranchInPostgres(staffBranch);
  }

  const staffAfterSave = settings.staff
    .filter((member) => member.id !== nextStaff.id)
    .concat(nextStaff);
  assertAtLeastOneActiveOwner(staffAfterSave);

  const rows = await queryPostgres<AdminStaffAccountRow>(
    "admin settings",
    `
      INSERT INTO admin_staff_accounts (
        id, name, email, role, branch_id, status, password_hash, created_at, updated_at, last_login_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        status = EXCLUDED.status,
        password_hash = EXCLUDED.password_hash,
        updated_at = EXCLUDED.updated_at,
        last_login_at = EXCLUDED.last_login_at
      RETURNING id, name, email, role, branch_id, status, password_hash, created_at, updated_at, last_login_at
    `,
    [
      nextStaff.id,
      nextStaff.name,
      nextStaff.email,
      nextStaff.role,
      nextStaff.branchId,
      nextStaff.status,
      nextStaff.passwordHash,
      new Date(nextStaff.createdAt),
      new Date(nextStaff.updatedAt),
      nextStaff.lastLoginAt ? new Date(nextStaff.lastLoginAt) : null,
    ],
  );

  return toSafeStaff(staffFromRow(rows[0]));
}

export async function saveAdminStaffAccount(input: Parameters<typeof staffRecordFromInput>[0]) {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: () => saveAdminStaffAccountToLocalJson(input),
    postgres: () => saveAdminStaffAccountToPostgres(input),
  });
}

async function getStaffByEmailFromLocalJson(email: string) {
  const settings = await readSettingsFromLocalJson();
  return settings.staff.find((member) => normalizeEmail(member.email) === normalizeEmail(email));
}

async function getStaffByEmailFromPostgres(email: string) {
  const rows = await queryPostgres<AdminStaffAccountRow>(
    "admin settings",
    `
      SELECT id, name, email, role, branch_id, status, password_hash, created_at, updated_at, last_login_at
      FROM admin_staff_accounts
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return rows[0] ? staffFromRow(rows[0]) : undefined;
}

async function markStaffLoginInLocalJson(staffId: string, lastLoginAt: string) {
  const settings = await readSettingsFromLocalJson();
  const index = settings.staff.findIndex((member) => member.id === staffId);

  if (index >= 0) {
    settings.staff[index] = {
      ...settings.staff[index],
      lastLoginAt,
      updatedAt: settings.staff[index].updatedAt,
    };
    await writeSettingsToLocalJson(settings);
  }
}

async function markStaffLoginInPostgres(staffId: string, lastLoginAt: string) {
  await queryPostgres<{ id: string }>(
    "admin settings",
    `
      UPDATE admin_staff_accounts
      SET last_login_at = $2
      WHERE id = $1
      RETURNING id
    `,
    [staffId, new Date(lastLoginAt)],
  );
}

export async function authenticateAdminStaff(email: string, password: string) {
  const staff = await runWithDataBackend({
    storeName: "admin settings",
    localJson: () => getStaffByEmailFromLocalJson(email),
    postgres: () => getStaffByEmailFromPostgres(email),
  });

  if (!staff || staff.status !== "Active") {
    return null;
  }

  const validPassword = await verifyPassword(password, staff.passwordHash);

  if (!validPassword) {
    return null;
  }

  const lastLoginAt = nowIso();
  await runWithDataBackend({
    storeName: "admin settings",
    localJson: () => markStaffLoginInLocalJson(staff.id, lastLoginAt),
    postgres: () => markStaffLoginInPostgres(staff.id, lastLoginAt),
  });

  return toSafeStaff({ ...staff, lastLoginAt });
}

export async function seedAdminSettingsToPostgres(settings: AdminSettingsStore) {
  return transactionPostgres("admin settings", async (db) => {
    await db.query(
      `
        INSERT INTO company_settings (
          id, company_name, legal_name, phone, email, address, pan_vat_number,
          currency, timezone, default_branch_id, updated_at
        )
        VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          legal_name = EXCLUDED.legal_name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          pan_vat_number = EXCLUDED.pan_vat_number,
          currency = EXCLUDED.currency,
          timezone = EXCLUDED.timezone,
          default_branch_id = EXCLUDED.default_branch_id,
          updated_at = EXCLUDED.updated_at
      `,
      [
        settings.company.companyName,
        settings.company.legalName,
        settings.company.phone,
        settings.company.email,
        settings.company.address,
        settings.company.panVatNumber,
        settings.company.currency,
        settings.company.timezone,
        settings.company.defaultBranchId,
        new Date(settings.company.updatedAt),
      ],
    );

    for (const branch of settings.branches) {
      await db.query(
        `
          INSERT INTO company_branches (id, name, code, type, phone, address, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            code = EXCLUDED.code,
            type = EXCLUDED.type,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `,
        [
          branch.id,
          branch.name,
          branch.code,
          branch.type,
          branch.phone,
          branch.address,
          branch.status,
          new Date(branch.createdAt),
          new Date(branch.updatedAt),
        ],
      );
    }

    for (const staff of settings.staff) {
      await db.query(
        `
          INSERT INTO admin_staff_accounts (
            id, name, email, role, branch_id, status, password_hash, created_at, updated_at, last_login_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            branch_id = EXCLUDED.branch_id,
            status = EXCLUDED.status,
            password_hash = EXCLUDED.password_hash,
            updated_at = EXCLUDED.updated_at,
            last_login_at = EXCLUDED.last_login_at
        `,
        [
          staff.id,
          staff.name,
          staff.email,
          staff.role,
          staff.branchId,
          staff.status,
          staff.passwordHash,
          new Date(staff.createdAt),
          new Date(staff.updatedAt),
          staff.lastLoginAt ? new Date(staff.lastLoginAt) : null,
        ],
      );
    }
  });
}
