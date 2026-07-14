type ProductOptionSelectorProps = {
  title: string;
  options: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  variant?: "default" | "color";
};

export default function ProductOptionSelector({
  title,
  options,
  selectedValue,
  onValueChange,
  variant = "default",
}: ProductOptionSelectorProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B98A2E]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onValueChange(item)}
            className={`h-11 min-w-11 rounded-full border px-4 text-sm font-semibold transition ${
              selectedValue === item
                ? variant === "color"
                  ? "border-[#0B4D3B] bg-[#E9F2EE] text-[#0B4D3B]"
                  : "border-[#0B4D3B] bg-[#0B4D3B] text-white"
                : "border-black/10 text-[#10231D] hover:border-[#0B4D3B]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}