/**
 * Drafts the shop-front words for one pair of shoes.
 *
 * This is a drafting tool and nothing more. It returns text; it does not save
 * it, does not publish it, and cannot. The owner reads what came back in the
 * ordinary product form, changes what he wants, and presses Save himself — the
 * same Save that has always been there. If he closes the page, nothing happened.
 *
 * Two rules are enforced here in code rather than asked for in the prompt,
 * because a prompt is a request and a request can be declined:
 *
 *   1. What is sent. `describe()` builds the payload field by field from a
 *      fixed list. There is no spread of the product object, so a column added
 *      to `Product` later — a supplier's cost, a customer's name — cannot
 *      travel to Google by being forgotten about. Google trains on free-tier
 *      input; everything on that list is already printed on the public website.
 *
 *   2. What comes back. `clean()` drops any draft containing a promise the shop
 *      has not made. A model that invents "1 year warranty" is not a nuisance,
 *      it is a claim a customer can hold the shop to, and it must not reach a
 *      field the owner might skim past.
 */

import type { Product } from "@/lib/products";
import { askGemini, isAiConfigured, type Bilingual } from "@/lib/ai/gemini";

export { isAiConfigured };

/** The fields the owner can ask for a draft of. Nothing else is ever written. */
export const draftableFields = [
  "nameNe",
  "description",
  "descriptionNe",
  "longDescription",
  "longDescriptionNe",
  "highlights",
  "care",
  "material",
  "fit",
] as const;

export type DraftableField = (typeof draftableFields)[number];

export type ProductDraft = Partial<Record<DraftableField, string>>;

export type DraftResult =
  | { ok: true; draft: ProductDraft; model: string; tookMs: number; dropped: string[] }
  | { ok: false; reason: Bilingual; detail: string };

/**
 * Promises the shop has not made.
 *
 * Each of these is something a customer could reasonably act on: wait for a
 * delivery, ask for money back, expect a repair. The shop may well offer some
 * of them — but the offer has to come from the owner typing it, not from a
 * model filling a silence.
 */
const UNMADE_PROMISES = [
  /\bwarrant(y|ies)\b/i,
  /\bguarantee[ds]?\b/i,
  /\bmoney[- ]back\b/i,
  /\brefund/i,
  /\bfree (delivery|shipping)\b/i,
  /\b(same|next)[- ]day\b/i,
  /\bwaterproof\b/i,
  /\b(genuine |real )?leather\b/i,
  /\b(discount|sale)\b/i,
  /ग्यारेन्टी/,
  /वारेन्टी/,
  /पैसा\s*फिर्ता/,
  /नि:?शुल्क\s*(ढुवानी|डेलिभरी)/,
  /छुट/,
  /असली\s*छाला/,
];

/**
 * The shop's name, spelt wrong.
 *
 * The first real draft came back calling the shop कृसु — a plausible-looking
 * Nepali transliteration of KRISHOE, and not the shop's name. A wrong price is
 * obvious and a wrong name is not: it reads fine, and it would go up on the
 * website under a business that does not exist.
 *
 * The prompt now says to keep KRISHOE in Latin letters. This is the part that
 * does not depend on the model agreeing. Spellings are added as they are seen,
 * the same way `lib/postgres/refusal.ts` collects the constraints the shop has
 * actually hit — guessing at every possible transliteration in advance would
 * mean rejecting ordinary Nepali words.
 */
const MISSPELT_BRAND = [/कृसु/, /क्रिसो/, /क्रिशो/, /कृशु/, /कृष्णो/];

/**
 * Everything about a shoe that is already public, and nothing else.
 *
 * Written out one line at a time on purpose. The temptation is `{...product}`
 * minus a blocklist, but a blocklist has to be updated every time the shop
 * learns a new fact about a shoe, and the day somebody forgets is the day a
 * cost price goes to Google.
 */
function describe(product: Product) {
  return [
    `Name        ${product.name}`,
    `Category    ${product.category}`,
    `Price       ${product.price}`,
    product.material ? `Material    ${product.material}` : null,
    product.fit ? `Fit         ${product.fit}` : null,
    product.colors.length ? `Colours     ${product.colors.join(", ")}` : null,
    product.sizes.length ? `Sizes       ${product.sizes.join(", ")}` : null,
    product.badge ? `Badge       ${product.badge}` : null,
  ]
    .filter(Boolean)
    .join("\n  ");
}

const ASKS: Record<DraftableField, string> = {
  nameNe: `"nameNe": "the shoe's name written in Nepali script, short — 2 to 4 words"`,
  description: `"description": "one line of English, under 90 characters"`,
  descriptionNe: `"descriptionNe": "one line of Nepali, under 90 characters"`,
  longDescription: `"longDescription": "2 to 3 sentences of English"`,
  longDescriptionNe: `"longDescriptionNe": "2 to 3 sentences of Nepali"`,
  highlights: `"highlights": "three short selling points in Nepali, separated by ', '"`,
  care: `"care": "two care instructions in Nepali, separated by ', '"`,
  material: `"material": "the material in plain English, 2 to 4 words"`,
  fit: `"fit": "how it fits in plain English, 2 to 4 words"`,
};

function buildPrompt(product: Product, wanted: DraftableField[]) {
  return `You write shop-front copy for KRISHOE, a footwear factory and shop in
Narayangadh, Bharatpur, Chitwan, Nepal. Customers read it on their phones, and
most of them read Nepali.

This pair:

  ${describe(product)}

Rules, in order of importance:

1. Never state a fact that is not listed above. No warranty, no guarantee, no
   refund, no delivery promise, no discount, no waterproofing, no material the
   list does not name, no invented customer reviews. If you do not know
   something, leave it out — an empty field is correct and a made-up one is not.

2. Nepali must read like a Nepali shopkeeper wrote it, in everyday words. Not
   translated English word order, not Hindi, not heavy Sanskrit.

3. English must read like English, not like Nepali rearranged.

4. The one origin claim you may make is that it is made in KRISHOE's own
   factory in Nepal, because it is.

5. Write the shop's name as KRISHOE, in Latin letters, in both languages. Never
   transliterate it into Nepali script — it is a name, and a guessed spelling of
   a name is a different shop.

Reply with ONLY this JSON object, no markdown fence, no commentary:

{
  ${wanted.map((field) => ASKS[field]).join(",\n  ")}
}`;
}

/**
 * Keeps the drafts that are safe to show and says which were dropped.
 *
 * Dropped, not sanitised: cutting the offending sentence out would leave a
 * paragraph the model built around a promise, and the owner would have no way
 * of knowing a hole had been left in it.
 */
function clean(parsed: Record<string, unknown>, wanted: DraftableField[]) {
  const draft: ProductDraft = {};
  const dropped: string[] = [];

  for (const field of wanted) {
    const value = parsed[field];
    if (typeof value !== "string") continue;

    const text = value.trim();
    if (!text) continue;

    if ([...UNMADE_PROMISES, ...MISSPELT_BRAND].some((pattern) => pattern.test(text))) {
      dropped.push(field);
      continue;
    }

    draft[field] = text;
  }

  return { draft, dropped };
}

function isEmpty(product: Product, field: DraftableField) {
  const value = product[field];
  return Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
}

/**
 * Asks for a draft of the fields named, or of every empty field if none are.
 *
 * Defaulting to the empty ones is what makes this safe to press twice: words
 * the owner has already written are never among the fields asked for, so they
 * cannot come back replaced.
 */
export async function draftProductCopy(
  product: Product,
  fields?: DraftableField[],
): Promise<DraftResult> {
  const asked = fields?.length
    ? fields.filter((field) => draftableFields.includes(field))
    : draftableFields.filter((field) => isEmpty(product, field));

  if (!asked.length) {
    return {
      ok: false,
      reason: { en: "Every description is already written", ne: "सबै विवरण पहिले नै लेखिएको छ" },
      detail: "Every draftable field on this product already has words in it.",
    };
  }

  const answer = await askGemini(buildPrompt(product, asked), { asJson: true });

  if (!answer.ok) return answer;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(answer.text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: { en: "The AI answer could not be read", ne: "AI को जवाफ पढ्न सकिएन" },
      detail: `The model replied with something that is not JSON: ${answer.text.slice(0, 120)}`,
    };
  }

  const { draft, dropped } = clean(parsed, asked);

  if (!Object.keys(draft).length) {
    return {
      ok: false,
      reason: dropped.length
        ? { en: "The AI promised something the shop has not — thrown away", ne: "AI ले नगरेको वाचा लेख्यो — फालियो" }
        : { en: "The AI wrote nothing", ne: "AI ले केही लेखेन" },
      detail: dropped.length
        ? `Every draft contained a claim the shop has not made (${dropped.join(", ")}), so none were kept.`
        : "The model answered, but with none of the fields that were asked for.",
    };
  }

  return { ok: true, draft, model: answer.model, tookMs: answer.tookMs, dropped };
}
