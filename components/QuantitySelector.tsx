import { MinusIcon, PlusIcon } from "@/components/Icons";

type QuantitySelectorProps = {
  quantity: number;
  setQuantity: (fn: (current: number) => number) => void;
};

export default function QuantitySelector({ quantity, setQuantity }: QuantitySelectorProps) {
  return (
    <div className="flex h-12 items-center rounded-full border border-black/10">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
        className="grid h-12 w-12 place-items-center text-[#0B4D3B]"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-black text-[#10231D]">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => setQuantity((current) => Math.min(9, current + 1))}
        className="grid h-12 w-12 place-items-center text-[#0B4D3B]"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}