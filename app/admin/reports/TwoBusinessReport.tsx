import Link from "next/link";
import AlertText from "@/components/admin/AlertText";
import { Amount } from "@/components/admin/PageKit";
import { money } from "@/lib/format-money";
import type { BusinessFigures, TwoBusinessReport as Report } from "@/lib/two-business-report";

/**
 * The factory and the shop, each with its own profit, and the factory's price
 * list (owner, 2026-10-31, two businesses, part four).
 */
export default function TwoBusinessReport({ report }: { report: Report }) {
  return (
    <section id="two-businesses" className="mt-8 scroll-mt-24">
      <h2 className="text-base font-black text-brand-green-ink">
        <AlertText en="🏭 Factory and 🛒 shop, each on its own" ne="🏭 कारखाना र 🛒 पसल, छुट्टाछुट्टै" />
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
        <AlertText
          en="A management view, not the tax books. Made shoes the shop takes on challans are the factory's sale and the shop's cost, at the factory price — so the two profits add up to the whole, only split."
          ne="व्यवस्थापनको हिसाब, करको होइन। पसलले challan मा लिएको बनाएको जुत्ता कारखाना मूल्यमा कारखानाको बिक्री र पसलको लागत हो — त्यसैले दुवै नाफाको जोड पूरै हुन्छ, बाँडिन मात्र।"
        />
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Side
          tone="factory"
          figures={report.factory}
          lines={[
            { en: "Own bills (KRF, less returns)", ne: "आफ्ना बिल (KRF, फिर्ता घटाएर)", value: report.factory.sales },
            { en: "Sold to the shop (challans)", ne: "पसललाई बेचेको (challan)", value: report.factory.toShop },
            { en: "Cost to make those pairs", ne: "ती जोडी बनाउने लागत", value: -report.factory.cost },
          ]}
          note={
            report.shopOwes === null || report.shopOwes === 0
              ? null
              : report.shopOwes > 0
                ? { en: `Still owed by the shop: ${money(report.shopOwes)}`, ne: `पसलबाट पाउन बाँकी: ${money(report.shopOwes)}` }
                : { en: `The shop has paid ahead: ${money(-report.shopOwes)}`, ne: `पसलले बढी तिरेको: ${money(-report.shopOwes)}` }
          }
        />
        <Side
          tone="shop"
          figures={report.shop}
          lines={[
            { en: "Shop bills (KRB, online too, less returns)", ne: "पसलको बिल (KRB, अनलाइन सहित, फिर्ता घटाएर)", value: report.shop.sales },
            { en: "Cost of what it sold", ne: "बेचेको सामानको लागत", value: -report.shop.cost },
          ]}
          note={
            report.shopOwes === null || report.shopOwes === 0
              ? null
              : report.shopOwes > 0
                ? { en: `Still owed to the factory: ${money(report.shopOwes)}`, ne: `कारखानालाई तिर्न बाँकी: ${money(report.shopOwes)}` }
                : { en: `Paid the factory ahead: ${money(-report.shopOwes)}`, ne: `कारखानालाई बढी तिरेको: ${money(-report.shopOwes)}` }
          }
        />
      </div>
      {report.withoutCost.length > 0 ? (
        <p className="mt-2 text-xs font-bold text-brand-gold-ink">
          <AlertText
            en={`Counted at no cost — no cost a pair yet: ${report.withoutCost.slice(0, 8).join(", ")}${report.withoutCost.length > 8 ? " …" : ""}`}
            ne={`लागत ० मा गनिएको — जोडीको लागत अझै छैन: ${report.withoutCost.slice(0, 8).join(", ")}${report.withoutCost.length > 8 ? " …" : ""}`}
          />
        </p>
      ) : null}

      <h3 id="factory-prices" className="mt-6 scroll-mt-24 text-base font-black text-brand-green-ink">
        <AlertText en="The factory's price list" ne="कारखाना मूल्य सूची" />
      </h3>
      {report.prices.length === 0 ? (
        <p className="mt-2 text-sm text-brand-muted">
          <AlertText en="No made shoes yet." ne="अझै कुनै बनाएको जुत्ता छैन।" />
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-2xl border border-brand-green-line bg-brand-paper">
          <table className="min-w-[720px] w-full text-sm tabular-nums">
            <thead className="border-b border-brand-green-line text-left text-xs text-brand-muted">
              <tr>
                <th className="px-3 py-2"><AlertText en="Shoe" ne="जुत्ता" /></th>
                <th className="px-3 py-2 text-right"><AlertText en="Cost to make" ne="बनाउने लागत" /></th>
                <th className="px-3 py-2 text-right"><AlertText en="Factory price" ne="कारखाना मूल्य" /></th>
                <th className="px-3 py-2 text-right"><AlertText en="Wholesale" ne="थोक" /></th>
                <th className="px-3 py-2 text-right"><AlertText en="Retail" ne="खुद्रा" /></th>
                <th className="px-3 py-2 text-right"><AlertText en="🏭 a pair" ne="🏭 जोडीको नाफा" /></th>
                <th className="px-3 py-2 text-right"><AlertText en="🛒 a pair" ne="🛒 जोडीको नाफा" /></th>
              </tr>
            </thead>
            <tbody>
              {report.prices.map((row) => {
                const factoryMargin = row.price > 0 && row.cost > 0 ? row.price - row.cost : null;
                const shopMargin = row.price > 0 && row.retail > 0 ? row.retail - row.price : null;
                return (
                  <tr key={row.id} className="border-b border-brand-green-line/60 last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/products?edit=${encodeURIComponent(row.id)}`} className="font-bold text-brand-green-ink underline decoration-brand-green-line underline-offset-2">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.cost > 0 ? money(row.cost) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {row.price > 0 ? (
                        <>
                          {money(row.price)}
                          {row.ownPrice > 0 ? null : (
                            <span className="ml-1 text-xs text-brand-muted">
                              (<AlertText en="wholesale" ne="थोक" />)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="font-black text-brand-clay">
                          <AlertText en="No price" ne="मूल्य छैन" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{row.wholesale > 0 ? money(row.wholesale) : "—"}</td>
                    <td className="px-3 py-2 text-right">{row.retail > 0 ? money(row.retail) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-black ${factoryMargin !== null && factoryMargin < 0 ? "text-brand-clay" : "text-brand-green-ink"}`}>
                      {factoryMargin === null ? "—" : `${money(factoryMargin)}${factoryMargin < 0 ? " ⚠" : ""}`}
                    </td>
                    <td className={`px-3 py-2 text-right font-black ${shopMargin !== null && shopMargin < 0 ? "text-brand-clay" : "text-brand-green-ink"}`}>
                      {shopMargin === null ? "—" : `${money(shopMargin)}${shopMargin < 0 ? " ⚠" : ""}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-brand-muted">
        <AlertText
          en="⚠ means one side loses on each pair: the factory price is under the cost to make, or over the retail price. Press a shoe to change its prices."
          ne="⚠ भनेको एउटा पक्षलाई हरेक जोडीमा घाटा: कारखाना मूल्य बनाउने लागतभन्दा कम, वा खुद्राभन्दा बढी। मूल्य बदल्न जुत्ताको नाम थिच्नुहोस्।"
        />
      </p>
    </section>
  );
}

function Side({
  tone,
  figures,
  lines,
  note,
}: {
  tone: "factory" | "shop";
  figures: BusinessFigures;
  lines: Array<{ en: string; ne: string; value: number }>;
  note: { en: string; ne: string } | null;
}) {
  const border = tone === "factory" ? "border-[#2F5C8A]" : "border-brand-green";
  const ink = tone === "factory" ? "text-[#2F5C8A]" : "text-brand-green";
  return (
    <div className={`grid gap-1.5 rounded-2xl border-2 ${border} bg-brand-paper p-4`}>
      <p className={`text-lg font-black ${ink}`}>
        {tone === "factory" ? <AlertText en="🏭 Factory" ne="🏭 कारखाना" /> : <AlertText en="🛒 Shop" ne="🛒 पसल" />}
      </p>
      {lines.map(({ value: raw, ...line }) => ({ ...line, value: raw === 0 ? 0 : raw })).map((line) => (
        <p key={line.en} className="flex justify-between gap-3 text-sm">
          <span className="text-brand-muted">
            <AlertText en={line.en} ne={line.ne} />
          </span>
          <span className={`font-bold tabular-nums ${line.value < 0 ? "text-brand-clay" : "text-brand-green-ink"}`}>
            <Amount>{line.value < 0 ? `−${money(-line.value)}` : money(line.value)}</Amount>
          </span>
        </p>
      ))}
      <p className="flex justify-between gap-3 border-t border-brand-green-line pt-1.5 text-base font-black">
        <span className="text-brand-green-ink">
          {tone === "factory" ? <AlertText en="Factory's profit" ne="कारखानाको नाफा" /> : <AlertText en="Shop's profit" ne="पसलको नाफा" />}
        </span>
        <span className={`tabular-nums ${figures.profit < 0 ? "text-brand-clay" : ink}`}>
          <Amount>{figures.profit < 0 ? `−${money(-figures.profit)}` : money(figures.profit)}</Amount>
        </span>
      </p>
      {note ? (
        <p className="text-xs font-bold text-brand-muted">
          <AlertText en={note.en} ne={note.ne} />
        </p>
      ) : null}
    </div>
  );
}
