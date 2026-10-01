"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { addCheque, editChequeDetails, getCheque, moveCheque } from "@/lib/cheque-book";
import {
  actionDateProblem,
  bounceReasonWords,
  chequeActions,
  chequeRupees,
  type ChequeAction,
  type ChequeBookState,
} from "@/lib/cheque-book-rules";
import { chequeAmount, getChequeStates } from "@/lib/cheques";
import { nepalDayKey } from "@/lib/dashboard-figures";
import { getPosInvoiceById } from "@/lib/pos";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Back to the cheque, with a reason when one was refused. */
function backTo(tab: string, id: string, problem = ""): never {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (id) params.set("open", id);
  if (problem) params.set("problem", problem);
  redirect(`/admin/cheques?${params.toString()}${id ? `#cq-${id}` : ""}`);
}

function refresh() {
  revalidatePath("/admin/cheques");
  revalidatePath("/admin/pos");
  revalidatePath("/admin");
}

/**
 * Deposited, cleared, bounced, collected or cancelled. A cheque taken needs
 * the counter's permission, a cheque given the purchasing one.
 */
export async function moveChequeAction(formData: FormData) {
  const id = textValue(formData, "id");
  const tab = textValue(formData, "tab");
  const action = textValue(formData, "action") as ChequeAction;
  if (!chequeActions.includes(action)) backTo(tab, id, "Unknown step.");

  const cheque = await getCheque(id);
  if (!cheque) backTo(tab, "", "That cheque was not found.");
  const { session } = await requireAdminPermission(cheque.direction === "in" ? "pos:write" : "purchasing:write");

  const todayKey = nepalDayKey(new Date());
  const onKey = textValue(formData, "on") || todayKey;
  const problem = actionDateProblem(cheque, action, onKey, todayKey);
  if (problem) backTo(tab, id, problem.en);

  const reason = textValue(formData, "reason");
  const bankCharge = Number(textValue(formData, "bankCharge")) || 0;
  try {
    await moveCheque(id, action, { onKey, reason, bankCharge, note: textValue(formData, "note") }, session.name ?? "");
  } catch (error) {
    backTo(tab, id, error instanceof Error ? error.message : "Could not save that.");
  }

  const why = action === "bounce" ? ` (${bounceReasonWords(reason).en}${bankCharge ? `, bank charge ${chequeRupees(bankCharge)}` : ""})` : "";
  await recordAdminAuditEvent(
    "cheque_moved",
    `Cheque ${cheque.chequeNo || "?"} ${cheque.direction === "in" ? "from" : "to"} ${cheque.partyName} (${chequeRupees(cheque.amount)}) marked ${action}${why} by ${session.name ?? "?"}.`,
  );
  refresh();
  backTo(tab, id);
}

/** Corrects the bank, number, date, name or phone. */
export async function editChequeAction(formData: FormData) {
  const id = textValue(formData, "id");
  const tab = textValue(formData, "tab");
  const cheque = await getCheque(id);
  if (!cheque) backTo(tab, "", "That cheque was not found.");
  const { session } = await requireAdminPermission(cheque.direction === "in" ? "pos:write" : "purchasing:write");
  const chequeDate = textValue(formData, "chequeDate");
  if (!textValue(formData, "chequeBank") || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(chequeDate)) {
    backTo(tab, id, "A cheque needs its bank and its date.");
  }
  await editChequeDetails(
    id,
    {
      bank: textValue(formData, "chequeBank"),
      chequeNo: textValue(formData, "chequeNo"),
      chequeDate,
      nameOnCheque: textValue(formData, "chequeName"),
      partyPhone: textValue(formData, "partyPhone"),
    },
    session.name ?? "",
  );
  await recordAdminAuditEvent("cheque_edited", `Cheque ${cheque.chequeNo || "?"} of ${cheque.partyName} corrected by ${session.name ?? "?"}.`);
  refresh();
  backTo(tab, id);
}

/**
 * A bill paid by cheque before the book existed: its bank and date filled in
 * once. What the counter page already marked (cleared, bounced, collected)
 * comes with it.
 */
export async function addBillChequeAction(formData: FormData) {
  const { session } = await requireAdminPermission("pos:write");
  const invoiceId = textValue(formData, "invoiceId");
  const chequeDate = textValue(formData, "chequeDate");
  if (!textValue(formData, "chequeBank") || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(chequeDate)) {
    backTo("in", "", "A cheque needs its bank and its date.");
  }
  const invoice = await getPosInvoiceById(invoiceId);
  const amount = invoice ? chequeAmount(invoice) : 0;
  if (!invoice || amount <= 0) backTo("in", "", "That bill has no cheque on it.");

  const marked = (await getChequeStates().catch(() => new Map())).get(invoice.id);
  const state: ChequeBookState = marked ?? "waiting";
  const chequePart = (invoice.payments ?? []).find((part) => part.method === "Cheque" && part.purpose !== "refund");
  const cheque = await addCheque({
    direction: "in",
    source: "bill",
    sourceId: invoice.id,
    sourceNumber: invoice.invoiceNumber,
    partyName: invoice.customerName,
    partyPhone: invoice.phone,
    bank: textValue(formData, "chequeBank"),
    chequeNo: textValue(formData, "chequeNo") || chequePart?.reference || invoice.paymentReference,
    amount,
    chequeDate,
    nameOnCheque: textValue(formData, "chequeName"),
    state,
    by: session.name ?? "",
  });
  await recordAdminAuditEvent(
    "cheque_details_added",
    `Cheque details filled in for ${invoice.invoiceNumber} (${invoice.customerName}, ${chequeRupees(amount)}) by ${session.name ?? "?"}.`,
  );
  refresh();
  backTo("in", cheque?.id ?? "");
}
