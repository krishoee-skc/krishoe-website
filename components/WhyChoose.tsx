import { CashIcon, FactoryIcon, TagIcon, WhatsAppIcon } from "@/components/Icons";
import T from "@/components/T";

/**
 * Four reasons, in the reader's language — and in a person's words (owner,
 * 2026-10-02: "not what a robot writes; little, but sweet and true"). "Order
 * requests are captured clearly so the KRISHOE team can confirm quickly" was
 * a software brochure; what a shopper wants is that the pairs are made here,
 * cost what a factory charges, that somebody calls, and that nothing is paid
 * before the shoes arrive.
 *
 * Kept as a server component with the T island doing the translating, so the
 * pages that carry it stay prerendered.
 */
export default function WhyChoose() {
  const features = [
    {
      Icon: FactoryIcon,
      en: "Our own workshop",
      ne: "आफ्नै कारखाना",
      descEn: "Every pair is cut, stitched and checked in Narayangadh.",
      descNe: "हरेक जोडी नारायणगढकै कारखानामा काटिन्छ, सिलाइन्छ र जाँचिन्छ।",
    },
    {
      Icon: TagIcon,
      en: "Factory price",
      ne: "कारखानाकै मूल्य",
      descEn: "No middle shop between us and you.",
      descNe: "हाम्रै कारखाना, बीचमा कोही छैन — त्यसैले मूल्य इमानदार हुन्छ।",
    },
    {
      Icon: WhatsAppIcon,
      en: "A real person calls",
      ne: "साँचो मान्छेको फोन",
      descEn: "We call to confirm your size, colour and day.",
      descNe: "अर्डर गरेपछि हामी चाँडै फोन गरेर पक्का गर्छौँ — साइज, रङ, कहिले पुग्छ।",
    },
    {
      Icon: CashIcon,
      en: "Pay on delivery",
      ne: "आएपछि तिर्ने",
      descEn: "Nothing to pay before the pair is in your hands.",
      descNe: "जुत्ता हातमा नआउँदासम्म केही तिर्नु पर्दैन।",
    },
  ];

  return (
    <section className="bg-brand-mist py-8 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center font-display text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl mb-6 md:mb-10">
          <T en="Why KRISHOE" ne="किन KRISHOE?" />
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {features.map((item) => (
            <div key={item.en} className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-6">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-green-wash text-brand-green">
                <item.Icon className="h-[22px] w-[22px]" />
              </span>
              <h3 className="text-base font-bold text-brand-green-ink sm:text-lg">
                <T en={item.en} ne={item.ne} />
              </h3>
              <p className="mt-1 text-sm leading-6 text-brand-muted">
                <T en={item.descEn} ne={item.descNe} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
