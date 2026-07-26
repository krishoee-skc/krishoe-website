import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  calculateBomRequirement,
  factoryStages,
  factoryWorkOrderTracePath,
  getFactoryData,
} from "@/lib/factory";

export const metadata: Metadata = { title: "Production Worksheet | KRISHOE Factory" };
export const dynamic = "force-dynamic";

function stageName(code: string) {
  return factoryStages.find((stage) => stage.code === code)?.name ?? code;
}

export default async function FactoryWorkOrderWorksheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("factory:write");
  const { id } = await params;
  const factory = await getFactoryData();
  const order = factory.workOrders.find((entry) => entry.id === id);
  if (!order) notFound();
  const sizes = factory.workOrderSizes.filter((entry) => entry.workOrderId === id);
  const assignments = factory.stageAssignments
    .filter((entry) => entry.workOrderId === id)
    .sort((left, right) => left.sequence - right.sequence);
  const bom = factory.bomLines.filter((entry) => entry.itemId === order.itemId);

  return (
    <section className="p-4 print:p-0 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <Link
            href={factoryWorkOrderTracePath(id)}
            className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-4 text-sm font-black"
          >
            Back to lot trace
          </Link>
          <PrintButton className="min-h-11 rounded-xl bg-brand-green px-5 text-sm font-black text-white">
            Print worksheet
          </PrintButton>
        </div>

        <div className="receipt-print rounded-2xl border border-gray-300 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <header className="grid grid-cols-[1fr_88px] gap-4 border-b-2 border-brand-green-ink pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-clay">
                KRISHOE Factory ERP
              </p>
              <h1 className="mt-1 text-2xl font-black text-brand-green-ink">
                Production Work Order / Worksheet
              </h1>
              <p className="mt-1 text-sm font-bold">
                {order.workOrderNumber} / {order.lotNumber}
              </p>
            </div>
            <Image
              src={`/api/admin/factory/work-orders/${id}/qr`}
              alt={`${order.workOrderNumber} QR`}
              width={88}
              height={88}
              unoptimized
            />
          </header>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <p><strong>Item:</strong> {order.itemCode} - {order.itemName}</p>
            <p><strong>Colour:</strong> {order.color}</p>
            <p><strong>Priority:</strong> {order.priority}</p>
            <p><strong>Status:</strong> {order.status}</p>
            <p><strong>Created:</strong> {order.createdDate}</p>
            <p><strong>Due:</strong> {order.dueDate}</p>
            <p><strong>Total:</strong> {order.totalPairs} pairs</p>
            <p><strong>Prepared:</strong> {order.createdBy}</p>
          </div>

          <h2 className="mt-5 text-sm font-black uppercase tracking-wider">Mixed-size plan</h2>
          <table className="mt-2 w-full border-collapse text-center text-sm">
            <thead><tr>
              {sizes.map((row) => <th key={row.id} className="border border-gray-400 p-2">Size {row.size}</th>)}
              <th className="border border-gray-400 p-2">Total</th>
            </tr></thead>
            <tbody><tr>
              {sizes.map((row) => <td key={row.id} className="border border-gray-400 p-2 font-bold">{row.plannedPairs}</td>)}
              <td className="border border-gray-400 p-2 font-black">{order.totalPairs}</td>
            </tr></tbody>
          </table>

          <h2 className="mt-5 text-sm font-black uppercase tracking-wider">
            Stage assignment and daily production
          </h2>
          <table className="mt-2 w-full border-collapse text-left text-xs">
            <thead><tr>
              {["Stage / Worker", "Date", "Received", "Good", "Reject", "Rework", "Handover / Sign"].map(
                (label) => <th key={label} className="border border-gray-400 p-2">{label}</th>,
              )}
            </tr></thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="h-12">
                  <td className="border border-gray-400 p-2">
                    <strong>{assignment.sequence}. {stageName(assignment.stageCode)}</strong><br />
                    {assignment.workerName} / {assignment.workerId}<br />
                    Rs. {assignment.ratePerGoodPairSnapshot}/good pair
                  </td>
                  {Array.from({ length: 6 }, (_, index) => (
                    <td key={index} className="border border-gray-400 p-2">&nbsp;</td>
                  ))}
                </tr>
              ))}
              {assignments.length === 0 ? (
                <tr><td colSpan={7} className="border border-gray-400 p-3">Release the Work Order to print worker assignments.</td></tr>
              ) : null}
            </tbody>
          </table>

          <h2 className="mt-5 text-sm font-black uppercase tracking-wider">Planned raw material</h2>
          <table className="mt-2 w-full border-collapse text-left text-xs">
            <thead><tr>
              {["Material", "Planned qty", "Issued", "Returned", "Consumed", "Waste", "Store sign"].map(
                (label) => <th key={label} className="border border-gray-400 p-2">{label}</th>,
              )}
            </tr></thead>
            <tbody>
              {bom.map((line) => (
                <tr key={line.id}>
                  <td className="border border-gray-400 p-2 font-bold">{line.materialName}</td>
                  <td className="border border-gray-400 p-2">
                    {calculateBomRequirement(line, order.totalPairs).requiredQuantity} {line.unit}
                  </td>
                  {Array.from({ length: 5 }, (_, index) => (
                    <td key={index} className="border border-gray-400 p-2">&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {order.remarks ? (
            <p className="mt-4 rounded-lg border border-gray-300 p-3 text-xs">
              <strong>Remarks:</strong> {order.remarks}
            </p>
          ) : null}
          <div className="mt-10 grid grid-cols-3 gap-8 text-center text-xs font-bold">
            <p className="border-t border-gray-500 pt-2">Factory supervisor</p>
            <p className="border-t border-gray-500 pt-2">Packing / QC</p>
            <p className="border-t border-gray-500 pt-2">Owner approval</p>
          </div>
        </div>
      </div>
    </section>
  );
}
