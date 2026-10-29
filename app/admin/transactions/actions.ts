"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { addLedgerTransaction } from "@/lib/operations";
import { addSupplierTransaction } from "@/lib/purchasing";
import { savedMessage } from "@/lib/saved-message";

// Money in and Money out on the Transactions page (owner, 2026-10-28, namuna
// "garau"). They write through the same book functions as the customer's
// ledger and the supplier's statement — the same rules, the same refusal when
// more is paid than is owed — so a payment taken here is the same line as one
// taken there.

/** Both halves of a message, side by side, for the URL. */
function pair(words: { en: string; ne: string }) {
  return savedMessage(words.en, words.ne);
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Whole rupees, as the books keep them. */
function amountValue(formData: FormData) {
  return Math.max(0, Math.round(Number(textValue(formData, "amount")) || 0));
}

/** The account's own "no" — more than is owed — said on the form, not an error page. */
const ACCOUNT_RULE = / has only Rs\. ([\d.,-]+) (supplier )?due\. Cannot post Rs\. [\d.,]+\.$/;

/** The account's refusal in both languages, for the form that asked. */
function refusal(message: string, amount: number) {
  const owed = ACCOUNT_RULE.exec(message)?.[1] ?? "";
  return pair({
    en: `${message} Lower the amount and press again.`,
    ne: `बाँकी रु. ${owed} मात्र छ, रु. ${amount} लेखियो। रकम घटाएर फेरि थिच्नुहोस्।`,
  });
}

function back(view: "in" | "out", key: "saved" | "said", message: string): never {
  redirect(`/admin/transactions?v=${view}&${key}=${encodeURIComponent(message.slice(0, 240))}`);
}

function refreshBooks(...paths: string[]) {
  for (const path of ["/admin", "/admin/transactions", "/admin/dues", "/admin/operations", "/admin/purchasing", ...paths]) {
    revalidatePath(path);
  }
}

const MONEY_IN_TYPES = ["Cash Payment", "Cheque Payment"] as const;
const MONEY_OUT_TYPES = ["Cash Payment", "Cheque Payment", "Bank Payment", "QR Payment"] as const;

export async function recordMoneyInAction(formData: FormData) {
  await requireAdminPermission("operations:write");

  const ledgerId = textValue(formData, "ledgerId");
  const amount = amountValue(formData);
  const typed = textValue(formData, "type");
  const type = MONEY_IN_TYPES.find((option) => option === typed) ?? "Cash Payment";
  if (!ledgerId || amount <= 0) {
    back("in", "said", pair({ en: "Choose who paid and an amount above 0.", ne: "कसले तिर्‍यो र ० भन्दा बढी रकम लेख्नुहोस्।" }));
  }

  let transaction;
  try {
    transaction = await addLedgerTransaction({ ledgerId, type, amount, note: textValue(formData, "note") });
  } catch (error) {
    if (error instanceof Error && ACCOUNT_RULE.test(error.message)) back("in", "said", refusal(error.message, amount));
    throw error;
  }

  await recordAdminAuditEvent(
    "transactions_money_in",
    `${type} Rs. ${amount} taken from ${transaction.customerName} (ledger ${ledgerId}).`,
  );
  refreshBooks(`/admin/operations/ledger/${ledgerId}`);
  back(
    "in",
    "saved",
    pair({ en: `✓ Rs. ${amount.toLocaleString("en-IN")} taken from ${transaction.customerName}.`, ne: `✓ ${transaction.customerName} बाट रु. ${amount.toLocaleString("en-IN")} लिइयो।` }),
  );
}

export async function recordMoneyOutAction(formData: FormData) {
  await requireAdminPermission("purchasing:write");

  const supplierLedgerId = textValue(formData, "supplierLedgerId");
  const amount = amountValue(formData);
  const typed = textValue(formData, "type");
  const type = MONEY_OUT_TYPES.find((option) => option === typed) ?? "Cash Payment";
  if (!supplierLedgerId || amount <= 0) {
    back("out", "said", pair({ en: "Choose the supplier and an amount above 0.", ne: "साहु र ० भन्दा बढी रकम लेख्नुहोस्।" }));
  }

  let transaction;
  try {
    transaction = await addSupplierTransaction({ supplierLedgerId, type, amount, note: textValue(formData, "note") });
  } catch (error) {
    if (error instanceof Error && ACCOUNT_RULE.test(error.message)) back("out", "said", refusal(error.message, amount));
    throw error;
  }

  await recordAdminAuditEvent(
    "supplier_transaction_create",
    `${transaction.type} recorded for ${transaction.supplierName}: Rs. ${transaction.amount} (Transactions page).`,
  );
  refreshBooks(`/admin/purchasing/supplier/${supplierLedgerId}`);
  back(
    "out",
    "saved",
    pair({ en: `✓ Rs. ${amount.toLocaleString("en-IN")} paid to ${transaction.supplierName}.`, ne: `✓ ${transaction.supplierName} लाई रु. ${amount.toLocaleString("en-IN")} तिरियो।` }),
  );
}
