"use client";

import { useMemo, useState } from "react";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { createFactoryWorkOrderAction } from "@/app/admin/factory/actions";

type ItemOption = {
  id: string;
  code: string;
  name: string;
  colors: string[];
  sizes: string[];
};

export default function WorkOrderForm({ items }: { items: ItemOption[] }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const selected = useMemo(
    () => items.find((item) => item.id === itemId) ?? items[0],
    [itemId, items],
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const total = selected?.sizes.reduce(
    (sum, size) => sum + Math.max(0, quantities[`${selected.id}:${size}`] ?? 0),
    0,
  ) ?? 0;
  const minDueDate = new Date().toISOString().slice(0, 10);

  if (!selected) {
    return <p className="text-sm text-gray-500">Add an active production item first.</p>;
  }

  return (
    <form action={createFactoryWorkOrderAction} className="space-y-4">
      <label className="block text-sm font-bold text-brand-green-ink">
        Production item
        <select
          name="itemId"
          value={selected.id}
          onChange={(event) => setItemId(event.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-bold text-brand-green-ink">
          Colour
          <select name="color" required className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
            {selected.colors.map((color) => <option key={color}>{color}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-brand-green-ink">
          Due date
          <input name="dueDate" type="date" min={minDueDate} required className="mt-1 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" />
        </label>
        <label className="text-sm font-bold text-brand-green-ink">
          Priority
          <select name="priority" className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
            <option>Normal</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-black text-brand-green-ink">Mixed-size plan</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {selected.sizes.map((size) => {
            const key = `${selected.id}:${size}`;
            return (
              <label key={size} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-black">
                Size {size}
                <input
                  key={key}
                  name={`size__${size}`}
                  type="number"
                  min="0"
                  step="1"
                  value={quantities[key] ?? 0}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [key]: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-base font-normal"
                />
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="block text-sm font-bold text-brand-green-ink">
        Remarks
        <textarea name="remarks" rows={3} placeholder="Special instruction, order reference, or production note" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-green-wash p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-brand-green">Planned total</p>
          <p className="mt-1 text-2xl font-black text-brand-green-ink">{total} pairs</p>
        </div>
        <FormSubmitButton
          disabled={total <= 0}
          className="min-h-12 rounded-xl bg-brand-green px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create draft Work Order
        </FormSubmitButton>
      </div>
    </form>
  );
}
