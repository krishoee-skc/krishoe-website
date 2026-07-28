import { MinusIcon, PlusIcon } from "@/components/Icons";

type QuantitySelectorProps = {
  quantity: number;
  setQuantity: (fn: (current: number) => number) => void;
};

export default function QuantitySelector({ quantity, setQuantity }: QuantitySelectorProps) {
  return (
    <div className="flex min-h-14 items-center rounded-full border border-black/10 md:h-12">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
        className="grid min-h-14 w-14 place-items-center text-brand-green transition hover:bg-brand-mist md:h-12 md:w-12"
      >
        <MinusIcon className="h-5 w-5 md:h-4 md:w-4" />
      </button>
      <span className="min-w-12 text-center text-sm font-black text-brand-green-ink">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => setQuantity((current) => Math.min(9, current + 1))}
        className="grid min-h-14 w-14 place-items-center text-brand-green transition hover:bg-brand-mist md:h-12 md:w-12"
      >
        <PlusIcon className="h-5 w-5 md:h-4 md:w-4" />
      </button>
    </div>
  );
}