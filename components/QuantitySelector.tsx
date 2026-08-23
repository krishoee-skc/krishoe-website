import { MinusIcon, PlusIcon } from "@/components/Icons";
import { useLanguage } from "@/components/LanguageProvider";

type QuantitySelectorProps = {
  quantity: number;
  setQuantity: (fn: (current: number) => number) => void;
  maxQuantity?: number;
};

export default function QuantitySelector({ quantity, setQuantity, maxQuantity = 9 }: QuantitySelectorProps) {
  const { text } = useLanguage();
  const max = Math.max(1, Math.floor(maxQuantity));
  const canDecrease = quantity > 1;
  const canIncrease = quantity < max;

  return (
    <div className="flex min-h-14 items-center rounded-full border border-black/10 md:h-12">
      <button
        type="button"
        aria-label={text("Decrease quantity", "सङ्ख्या घटाउने")}
        disabled={!canDecrease}
        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
        className="grid min-h-14 w-14 place-items-center text-brand-green transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:text-brand-muted/45 disabled:hover:bg-transparent md:h-12 md:w-12"
      >
        <MinusIcon className="h-5 w-5 md:h-4 md:w-4" />
      </button>
      <span className="min-w-12 text-center text-sm font-black text-brand-green-ink">{quantity}</span>
      <button
        type="button"
        aria-label={text("Increase quantity", "सङ्ख्या बढाउने")}
        disabled={!canIncrease}
        onClick={() => setQuantity((current) => Math.min(max, current + 1))}
        className="grid min-h-14 w-14 place-items-center text-brand-green transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:text-brand-muted/45 disabled:hover:bg-transparent md:h-12 md:w-12"
      >
        <PlusIcon className="h-5 w-5 md:h-4 md:w-4" />
      </button>
    </div>
  );
}
