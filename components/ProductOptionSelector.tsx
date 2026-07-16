type ProductOptionSelectorProps = {
  title: string;
  options: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  variant?: "default" | "color";
};

const COLOR_SWATCHES: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
  tan: "#D2B48C",
  brown: "#7B4B27",
  red: "#C0392B",
  maroon: "#7B1E2B",
  blue: "#2C3E90",
  navy: "#1B2A4A",
  green: "#2E7D32",
  gold: "#C8A04D",
  grey: "#808080",
  gray: "#808080",
  silver: "#C0C0C0",
  pink: "#E59BB0",
  beige: "#E8DCC0",
  cream: "#F5F0E1",
  yellow: "#EBC531",
  orange: "#E07B39",
  purple: "#6A4C93",
};

function swatchColor(name: string) {
  return COLOR_SWATCHES[name.trim().toLowerCase()] ?? null;
}

export default function ProductOptionSelector({
  title,
  options,
  selectedValue,
  onValueChange,
  variant = "default",
}: ProductOptionSelectorProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-deep">{title}</p>
        {selectedValue ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-green-ink">
            {variant === "color" && swatchColor(selectedValue) ? (
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-black/15"
                style={{ backgroundColor: swatchColor(selectedValue) as string }}
              />
            ) : null}
            {selectedValue}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((item) => {
          const isSelected = selectedValue === item;
          const color = variant === "color" ? swatchColor(item) : null;

          return (
            <button
              key={item}
              type="button"
              onClick={() => onValueChange(item)}
              aria-pressed={isSelected}
              className={`inline-flex h-11 min-w-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 ${
                isSelected
                  ? variant === "color"
                    ? "border-brand-green bg-brand-green-mist text-brand-green"
                    : "border-brand-green bg-brand-green text-white"
                  : "border-black/10 text-brand-green-ink hover:border-brand-green"
              }`}
            >
              {color ? (
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 rounded-full border border-black/15"
                  style={{ backgroundColor: color }}
                />
              ) : null}
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
