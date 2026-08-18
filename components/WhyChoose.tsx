import { CheckIcon } from "@/components/Icons";
import T from "@/components/T";

/**
 * Four reasons, in the reader's language.
 *
 * Kept as a server component with the T island doing the translating, so the
 * home and category pages that carry this section stay statically prerendered.
 *
 * The Nepali is not a word-for-word rendering of the English. "Fast
 * Confirmation" is a phrase from a software brochure; what a Nepali shopper
 * wants to know is that someone will pick up the phone. The claims stay the
 * same — only the way of saying them changes.
 */
export default function WhyChoose() {
  const features = [
    {
      en: "Premium Quality",
      ne: "राम्रो गुणस्तर",
      descEn: "Selected pairs with reliable materials, clean finishing, and a polished look.",
      descNe: "छानिएको सामान, सफा सिलाइ — कारखानाबाट निस्कनुअघि हरेक जोडी जाँचिन्छ।",
    },
    {
      en: "Comfort",
      ne: "आरामदायी",
      descEn: "Built around easy movement for daily wear, work days, and family outings.",
      descNe: "दिनभरि लगाउन मिल्ने — काममा, बजारमा, घुम्न जाँदा।",
    },
    {
      en: "Fast Confirmation",
      ne: "छिटो जवाफ",
      descEn: "Order requests are captured clearly so the KRISHOE team can confirm quickly.",
      descNe: "अर्डर गरेपछि हामी चाँडै फोन गरेर पक्का गर्छौँ — साइज, रङ, कहिले पुग्छ।",
    },
    {
      en: "Fair Price",
      ne: "इमानदार मूल्य",
      descEn: "Premium everyday footwear with pricing that makes sense for repeat use.",
      descNe: "हाम्रै कारखाना, बीचमा कोही छैन — त्यसैले मूल्य इमानदार हुन्छ।",
    },
  ];

  return (
    <section className="bg-brand-mist py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-4xl font-bold text-brand-green">
          <T en="Why Choose KRISHOE?" ne="किन KRISHOE?" />
        </h2>

        <p className="mb-14 mt-4 text-center text-gray-500">
          <T
            en="A cleaner shopping experience for everyday footwear."
            ne="दिनहुँ लगाउने जुत्ता — सिधै कारखानाबाट, झन्झट बिना।"
          />
        </p>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <div
              key={item.en}
              className="rounded-lg bg-white p-8 text-center shadow-lg duration-300 hover:shadow-2xl"
            >
              <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-brand-green-mist text-brand-green">
                <CheckIcon className="h-6 w-6" />
              </div>

              <h3 className="text-2xl font-bold text-brand-green">
                <T en={item.en} ne={item.ne} />
              </h3>
              <p className="mt-4 text-gray-600">
                <T en={item.descEn} ne={item.descNe} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
