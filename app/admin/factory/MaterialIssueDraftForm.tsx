import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { createFactoryMaterialIssueDraftAction } from "@/app/admin/factory/actions";

export default function MaterialIssueDraftForm({
  workOrderId,
  materials,
}: {
  workOrderId: string;
  materials: Array<{
    bomLineId: string;
    name: string;
    unit: string;
    plannedQuantity: number;
    allocatedQuantity: number;
    remainingQuantity: number;
    availableStock: number;
    averageUnitCost: number;
  }>;
}) {
  return (
    <form action={createFactoryMaterialIssueDraftAction} className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <p className="text-xs font-black uppercase tracking-wider text-orange-900">
        Raw material issue draft
      </p>
      <label className="mt-3 block text-xs font-bold text-orange-950">
        BOM material
        <select name="bomLineId" required className="mt-1 h-11 w-full rounded-lg border border-orange-200 bg-white px-3 font-normal">
          {materials.map((material) => (
            <option key={material.bomLineId} value={material.bomLineId}>
              {material.name} · remaining {material.remainingQuantity} {material.unit} · stock {material.availableStock}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-orange-950">
          Draft quantity
          <input name="quantity" type="number" min="0.0001" step="0.0001" required className="mt-1 h-11 w-full rounded-lg border border-orange-200 bg-white px-3 font-normal" />
        </label>
        <label className="text-xs font-bold text-orange-950">
          Variance / issue note
          <input name="note" placeholder="Required if above BOM plan" className="mt-1 h-11 w-full rounded-lg border border-orange-200 bg-white px-3 font-normal" />
        </label>
      </div>
      <div className="mt-3 space-y-1 rounded-lg bg-white p-3 text-[11px] text-orange-900">
        {materials.map((material) => (
          <p key={material.bomLineId}>
            <strong>{material.name}:</strong> BOM {material.plannedQuantity} {material.unit},
            allocated {material.allocatedQuantity}, average cost Rs. {material.averageUnitCost}/{material.unit}
          </p>
        ))}
      </div>
      <FormSubmitButton className="mt-3 min-h-11 w-full rounded-xl bg-orange-700 px-5 text-sm font-black text-white">
        Save issue draft
      </FormSubmitButton>
      <p className="mt-2 text-[11px] font-semibold text-orange-800">
        Draft only—raw-material stock is not reduced.
      </p>
    </form>
  );
}
