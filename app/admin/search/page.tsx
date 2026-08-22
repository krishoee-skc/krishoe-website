import type { Metadata } from "next";
import SearchAsYouType from "@/app/admin/search/SearchAsYouType";

export const metadata: Metadata = {
  title: "Search | KRISHOE Admin",
};

/**
 * One box for the whole shop.
 *
 * What it replaced looked in five places — products, customers, suppliers, POS
 * bills, purchase bills — loaded every one of them in full on each submit, and
 * filtered them in memory. Workers were not among them, so the owner typed
 * "ank" looking for ankus, saw the same hint that had been on screen before,
 * and reported the search as broken. It was: a search that cannot find a name
 * the shop uses every day, and shows nothing until a button nobody mentioned
 * is pressed.
 *
 * The matching moved to the database, where each query returns a handful of
 * already-narrowed rows, and the screen became a client component that answers
 * as you type. Workers, factory items and customer orders are searched for the
 * first time — and so are the screens themselves, because half of what anyone
 * types into a search box is a place rather than a record.
 */
export default function AdminSearchPage() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-black text-brand-green-ink">खोज्नुहोस्</h1>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        कामदार, सामान, कारखानाका item, ग्राहक, अर्डर, बिल, साहु — वा पानाको नाम।
        नेपाली र अङ्ग्रेजी दुवैले चल्छ।
      </p>

      <SearchAsYouType />
    </section>
  );
}
