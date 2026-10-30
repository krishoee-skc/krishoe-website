"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatPrice } from "@/lib/products";
import type { Product, Category } from "@/lib/products";
import { upsertProductAction, type ActionState } from "./actions";
import ActionMessage from "@/components/admin/ActionMessage";
import { useLanguage } from "@/components/LanguageProvider";
import ImageUploadField from "@/components/admin/ImageUploadField";
import AiDraftButton from "./AiDraftButton";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { codeProblem, codeTakenBy, nextShoeCode } from "@/lib/shoe-code";
import { colourList, colourSwap, coloursNotOnShoe, swapColourWords } from "@/lib/colour-words";
import type { StockOrigin } from "@/lib/stock-origin";
import type { ChosenOrigin } from "@/lib/product-origins";

/** The four boxes that describe the shoe, where its colour is said again. */
const DESCRIPTION_FIELDS = ["description", "descriptionNe", "longDescription", "longDescriptionNe"] as const;

type ProductFormProps = {
  product?: Product | null;
  categories: Category[];
  /** Every shoe's code, so a new one is numbered after them and a clash is seen. */
  takenCodes?: Array<{ id: string; sku: string; name: string }>;
  /** Start the AI draft as the form opens (the Drafts panel's "✨ AI" link). */
  autoDraft?: boolean;
  /**
   * Made or bought (owner, 2026-10-29): the stock history's word when it has
   * one, otherwise what the Owner says here — once its table is there.
   */
  origin?: { history?: StockOrigin; chosen: ChosenOrigin | ""; canChoose: boolean };
};

/** Rupees as typed, shown the way the storefront will show them. */
function rupeeLabel(rupees: number) {
  return formatPrice(Math.round(rupees * 100));
}

export default function ProductForm({ product, categories, takenCodes = [], autoDraft = false, origin }: ProductFormProps) {
  const isEditing = Boolean(product);
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const { text } = useLanguage();
  const [pricePreview, setPricePreview] = useState(
    product ? String(product.priceValue / 100) : "",
  );
  const [isSaving, startSaving] = useTransition();
  // A new shoe opens with the next KR code for its category, and follows the
  // category until the owner types a code of their own.
  const firstCategory = product?.categorySlug ?? categories[0]?.slug ?? "";
  const [sku, setSku] = useState(() => product?.sku ?? nextShoeCode(takenCodes.map((taken) => taken.sku), firstCategory));
  const [skuTyped, setSkuTyped] = useState(Boolean(product));
  const skuClash = codeTakenBy(takenCodes, sku, product?.id ?? "");
  const skuProblem = codeProblem(sku);
  // Held so the AI drafter can read what is typed and fill what is not, without
  // this form having to mirror every field into React state first.
  const formRef = useRef<HTMLFormElement>(null);

  // The colour said again in the descriptions (owner, 2026-10-20): change the
  // colour and the descriptions follow, on the form, before Save. A
  // description that names another colour is pointed out, with one press.
  const savedColours = product?.colors ?? [];
  const coloursBefore = useRef<string[]>(savedColours);
  const [colourNote, setColourNote] = useState("");
  const [wrongColours, setWrongColours] = useState<string[]>(() =>
    coloursNotOnShoe(
      [product?.description ?? "", product?.descriptionNe ?? "", product?.longDescription ?? "", product?.longDescriptionNe ?? ""],
      savedColours,
    ),
  );
  const [typedColours, setTypedColours] = useState<string[]>(savedColours);

  const descriptionBox = (name: (typeof DESCRIPTION_FIELDS)[number]) =>
    formRef.current?.elements.namedItem(name) as HTMLTextAreaElement | null;

  const checkDescriptions = (colours = typedColours) => {
    const texts = DESCRIPTION_FIELDS.map((name) => descriptionBox(name)?.value ?? "");
    setWrongColours(coloursNotOnShoe(texts, colours));
  };

  /** Every description box with `from` said as `to`; true when any changed. */
  const sayColourAs = (from: string, to: string) => {
    let changed = false;
    for (const name of DESCRIPTION_FIELDS) {
      const box = descriptionBox(name);
      if (!box) continue;
      const next = swapColourWords(box.value, from, to);
      if (next !== box.value) {
        box.value = next;
        changed = true;
      }
    }
    return changed;
  };

  const coloursChanged = (typed: string) => {
    const colours = colourList(typed);
    const swap = colourSwap(coloursBefore.current, colours);
    coloursBefore.current = colours;
    setTypedColours(colours);
    if (swap && sayColourAs(swap.from, swap.to)) {
      setColourNote(text(`The descriptions now say ${swap.to} (they said ${swap.from}).`, `विवरणमा पनि ${swap.from} → ${swap.to} बदलियो।`));
    } else {
      setColourNote("");
    }
    checkDescriptions(colours);
  };

  const putRightColour = () => {
    const colour = typedColours[0];
    if (!colour) return;
    for (const wrong of wrongColours) sayColourAs(wrong, colour);
    setColourNote(text(`The descriptions now say ${colour} (they said ${wrongColours.join(", ")}).`, `विवरणमा पनि ${wrongColours.join(", ")} → ${colour} बदलियो।`));
    checkDescriptions();
  };

  // Submitted here rather than through `action={...}` so a failure comes back as
  // a message beside the button. The form is never re-rendered from scratch, so
  // every field — and the uploaded photo URL — survives a failed attempt.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startSaving(async () => {
      const result = await upsertProductAction(state, formData);
      setState(result);

      // Pull the saved row back into the list behind the form. Staying on the
      // page is deliberate: the owner sees the confirmation instead of landing
      // somewhere new and wondering whether it went through.
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    // Enter walks box to box and asks before it saves (owner, 2026-09-30):
    // on a plain form Enter in any box filed the shoe half-typed.
    <EnterWalkForm formRef={formRef} onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-brand-paper p-6 shadow-sm">
      <input type="hidden" name="id" defaultValue={product?.id ?? ""} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            {isEditing ? text("Edit product", "जुत्ता सच्याउने") : text("Create product", "नयाँ जुत्ता थप्ने")}
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            {isEditing
              ? text(`Updating ${product?.name}`, `${product?.name} सच्याउँदै`)
              : text("Add a new item to the KRISHOE catalog.", "पसलमा नयाँ जुत्ता थप्नुहोस्।")}
          </p>
        </div>
        {isEditing ? (
          <Link
            href="/admin/products"
            className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            {text("Cancel edit", "रद्द गर्ने")}
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Product name", "जुत्ताको नाम")}</span>
          <input name="name" defaultValue={product?.name} required className="form-input" />
        </label>
        {/* The half of the shop the language switch could never reach: a shoe's
            name comes out of the database, and the database held one. Leaving
            this blank shows the English name to a Nepali shopper, which is what
            the shop did before the column existed — so it can be filled in one
            shoe at a time with nothing broken in between. */}
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Name in Nepali", "नेपालीमा नाम")}</span>
          <input
            name="nameNe"
            defaultValue={product?.nameNe ?? ""}
            placeholder={text("e.g. Doctor Chappal", "जस्तै: डाक्टर चप्पल")}
            className="form-input"
          />
          <span className="text-xs text-brand-muted">
            {text(
              "Left blank, the English name is shown to Nepali readers too.",
              "नलेखे English नाम नै देखिन्छ।",
            )}
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("SKU", "SKU — सामानको कोड")}</span>
          <input
            name="sku"
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
              setSkuTyped(true);
            }}
            required
            spellCheck={false}
            autoCapitalize="characters"
            className="form-input font-mono"
          />
          {skuClash ? (
            <span className="text-xs font-bold text-brand-clay">
              {text(`⚠ ${skuClash.name} already has this code.`, `⚠ यो कोड ${skuClash.name} मा पहिल्यै छ।`)}
            </span>
          ) : skuProblem === "looks-like-size" ? (
            <span className="text-xs font-bold text-brand-clay">
              {text("⚠ One or two digits read as a size at the counter — use three.", "⚠ १–२ अङ्क POS मा साइज जस्तो बुझिन्छ — ३ अङ्क राख्नुहोस्।")}
            </span>
          ) : (
            <span className="text-xs text-brand-muted">
              {text("KR-1xx gents · 2xx ladies · 3xx slippers · 4xx kids · 5xx other", "KR-1xx gents · 2xx ladies · 3xx चप्पल · 4xx केटाकेटी · 5xx अरू")}
            </span>
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Category", "कुन किसिम")}</span>
          <select
            name="categorySlug"
            defaultValue={product?.categorySlug}
            onChange={(event) => {
              if (!skuTyped) setSku(nextShoeCode(takenCodes.map((taken) => taken.sku), event.target.value));
            }}
            className="form-input"
          >
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.title}
              </option>
            ))}
          </select>
        </label>
        {/* Asked for in rupees, stored in paisa.
            This said "Price (paisa)" and expected 179900 for a Rs. 1,799 heel.
            Nobody prices stock in paisa, so the owner typed 5000 for a
            Rs. 5,000 shoe — which would have saved as Rs. 50 and undercut the
            shop by a factor of a hundred, silently, with the form looking
            perfectly filled in. */}
        {/* Shown back as the shopper will see it, while it is being typed.
            The owner reads "priceValue is in paisa" in a report and reasonably
            wonders whether the shop is storing the wrong thing — this answers
            that where the question actually arises, without touching the
            storage, which is in paisa for the same reason every payment system
            is: a rupee held as a decimal loses a paisa to rounding, and fifty
            bills a day is fifty chances for the books not to balance. */}
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Price (Rs.)", "मूल्य — रुपैयाँमा")}</span>
          <input
            name="priceRupees"
            defaultValue={product ? product.priceValue / 100 : ""}
            type="number"
            min={0}
            step="0.01"
            required
            className="form-input"
            placeholder="1799"
            onChange={(event) => setPricePreview(event.target.value)}
          />
          <span className="text-xs text-brand-muted">
            {pricePreview.trim() === "" || Number.isNaN(Number(pricePreview))
              ? text("The customer will see: —", "ग्राहकले देख्नेछन्: —")
              : text(
                  `The customer will see: ${rupeeLabel(Number(pricePreview))}`,
                  `ग्राहकले देख्नेछन्: ${rupeeLabel(Number(pricePreview))}`,
                )}
          </span>
        </label>
        {/* Not an input any more. Stock has one door — Operations — and a box
            here was a second one: two answers to "how many pairs are there",
            with nothing to say which was true. The count is shown because it is
            worth seeing while editing a product; it is changed where the pairs
            actually move. */}
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Stock", "कति जोडी छ")}</span>
          <div className="flex min-h-[46px] items-center justify-between gap-3 rounded-lg border border-dashed border-brand-green-line bg-brand-paper-deep px-4">
            <span className="text-lg font-black text-brand-green-ink">
              {text(
                `${product?.stock ?? 0} pair${(product?.stock ?? 0) === 1 ? "" : "s"}`,
                `${product?.stock ?? 0} जोडी`,
              )}
            </span>
            {/* Straight to the form that moves pairs, with this shoe's name
                already in it (owner, 2026-10-30): "Operations" alone left him
                on whichever tab he used last. */}
            <Link
              href={`/admin/operations${product?.name ? `?design=${encodeURIComponent(product.name)}` : ""}#stock-movement`}
              className="shrink-0 text-xs font-black text-brand-green underline"
            >
              {text("Change in Operations", "Operations बाट बदल्ने")}
            </Link>
          </div>
          <span className="text-xs leading-5 text-brand-muted">
            {text(
              "Made, bought or opening stock — all of it through Operations. It cannot be changed here.",
              "बनाएको · किनेको · सुरुको बाँकी — सबै Operations बाट। यहाँबाट बदलिँदैन।",
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Wholesale price (Rs.)", "थोकको मूल्य (रु.)")}</span>
          <input
            name="wholesalePriceRupees"
            defaultValue={product?.wholesalePriceValue ? product.wholesalePriceValue / 100 : ""}
            type="number"
            min={0}
            step="0.01"
            className="form-input"
            placeholder="0 = no wholesale rate"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Minimum wholesale order (pairs)", "थोकमा कम्तीमा कति जोडी")}</span>
          <input
            name="minWholesaleQty"
            defaultValue={product?.minWholesaleQty ?? 1}
            type="number"
            min={1}
            className="form-input"
            placeholder="1"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Badge", "चिनो")}</span>
          <input name="badge" defaultValue={product?.badge ?? ""} className="form-input" placeholder="New, Limited, Premium" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Rating", "तारा")}</span>
          <input name="rating" defaultValue={product?.rating ?? "0"} className="form-input" />
        </label>
      </div>

      <AiDraftButton formRef={formRef} autoStart={autoDraft} />

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{text("Short description", "छोटो विवरण")}</span>
        <textarea name="description" defaultValue={product?.description} rows={2} onInput={() => checkDescriptions()} className="form-input" />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{text("Short description in Nepali", "नेपालीमा छोटो विवरण")}</span>
        <textarea
          name="descriptionNe"
          defaultValue={product?.descriptionNe ?? ""}
          onInput={() => checkDescriptions()}
          rows={2}
          placeholder={text(
            "e.g. Comfortable all day. Rain does not spoil them.",
            "जस्तै: दिनभर लगाउँदा खुट्टा दुख्दैन। भिजे पनि बिग्रँदैन।",
          )}
          className="form-input"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{text("Long description", "लामो विवरण")}</span>
        <textarea name="longDescription" defaultValue={product?.longDescription} rows={4} onInput={() => checkDescriptions()} className="form-input" />
      </label>

      {/*
        The save has always accepted this column and the form never offered a
        box for it, so a shopper reading the shop in Nepali got the English
        paragraph on every product page. Nothing to migrate — no product could
        have a value there.
      */}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">
          {text("Long description in Nepali", "नेपालीमा लामो विवरण")}
        </span>
        <textarea
          name="longDescriptionNe"
          defaultValue={product?.longDescriptionNe ?? ""}
          onInput={() => checkDescriptions()}
          rows={4}
          className="form-input"
        />
      </label>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ImageUploadField
          name="image"
          label="Main Image"
          initialValue={product?.image ?? ""}
          placeholder="/images/products/… or Upload photo"
        />
        <ImageUploadField
          name="gallery"
          label="Gallery Images"
          initialValue={product?.gallery.join(", ") ?? ""}
          multiple
          placeholder="comma-separated URLs, or Upload photos"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Colours (comma-separated)", "रङ — कमाले छुट्याउने")}</span>
          <input
            name="colors"
            defaultValue={product?.colors.join(", ")}
            placeholder={text("As in the photo — e.g. Maroon, Cream", "फोटोमा जस्तो — जस्तै Maroon, Cream")}
            onBlur={(event) => coloursChanged(event.currentTarget.value)}
            className="form-input"
          />
          {colourNote ? (
            <span role="status" className="text-sm font-semibold text-brand-green">
              ✓ {colourNote}
            </span>
          ) : null}
          {wrongColours.length > 0 && typedColours.length > 0 ? (
            <span className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <span>
                ⚠{" "}
                {text(
                  `The descriptions say ${wrongColours.join(", ")}, but the colour is ${typedColours.join(", ")}.`,
                  `विवरणमा ${wrongColours.join(", ")} लेखिएको छ, तर रङ ${typedColours.join(", ")} छ।`,
                )}
              </span>
              {typedColours.length === 1 ? (
                <button
                  type="button"
                  onClick={putRightColour}
                  className="min-h-11 w-fit rounded-full bg-brand-green px-4 text-sm font-bold text-white"
                >
                  {text(`Say ${typedColours[0]} in the descriptions too`, `विवरणमा पनि ${typedColours[0]} बनाउने`)}
                </button>
              ) : null}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Sizes (comma-separated)", "साइज — कमाले छुट्याउने")}</span>
          <input name="sizes" defaultValue={product?.sizes.join(", ")} className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Material", "केबाट बनेको")}</span>
          <input name="material" defaultValue={product?.material} className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Fit", "खुट्टामा कस्तो")}</span>
          <input name="fit" defaultValue={product?.fit} className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Highlights (comma-separated)", "मुख्य कुरा — कमाले छुट्याउने")}</span>
          <textarea name="highlights" defaultValue={product?.highlights.join(", ")} rows={3} className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Care instructions (comma-separated)", "कसरी सम्हाल्ने — कमाले छुट्याउने")}</span>
          <textarea name="care" defaultValue={product?.care.join(", ")} rows={3} className="form-input" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{text("Status", "पसलमा देखाउने कि नदेखाउने")}</span>
          <select name="status" defaultValue={product?.status ?? "Active"} className="form-input">
            {/* The values are what the database stores and must not move;
                only what the reader sees does. */}
            <option value="Active">{text("Active — in the shop", "पसलमा देखिने")}</option>
            <option value="Draft">{text("Draft — hidden", "लुकाइएको")}</option>
          </select>
        </label>
        {origin?.history ? (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{text("How it came", "कसरी आयो")}</span>
            <span className="form-input flex items-center bg-brand-mist">
              {[origin.history.made ? text("🏭 Made", "🏭 बनाएको") : "", origin.history.bought ? text("🛒 Bought", "🛒 किनेको") : ""]
                .filter(Boolean)
                .join(" · ")}{" "}
              <span className="ml-1 text-xs text-brand-muted">{text("— from its stock history", "— स्टक इतिहासबाट")}</span>
            </span>
          </div>
        ) : origin?.canChoose ? (
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{text("How it came", "कसरी आयो")}</span>
            <select name="origin" defaultValue={origin.chosen} className="form-input">
              <option value="">{text("Not said", "भनिएको छैन")}</option>
              <option value="made">{text("🏭 Made in our factory", "🏭 हाम्रो कारखानामा बनाएको")}</option>
              <option value="bought">{text("🛒 Bought ready-made", "🛒 तयारी किनेको")}</option>
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-8 pt-5">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" defaultChecked={product?.featured} />
            {text("Featured", "मुख्य पानामा")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="bestSeller" defaultChecked={product?.bestSeller} />
            {text("Best seller", "धेरै बिक्ने")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="newArrival" defaultChecked={product?.newArrival} />
            {text("New arrival", "नयाँ आएको")}
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <ActionMessage state={state} linkLabel={text("View all products", "सबै जुत्ता हेर्ने")} />
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving
            ? isEditing
              ? text("Saving…", "सुरक्षित गर्दै…")
              : text("Creating…", "थप्दै…")
            : isEditing
              ? text("Save changes", "सच्याइएको राख्ने")
              : text("Create product", "जुत्ता थप्ने")}
        </button>
      </div>
    </EnterWalkForm>
  );
}
