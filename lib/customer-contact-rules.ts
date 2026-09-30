/**
 * Plain checks on who a bill is for, kept pure so the counter's form and its
 * tests read them the same way (owner, 2026-09-30).
 */

function digitsOf(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * What is odd about a typed phone number, or null when it reads right or is
 * blank. Only a warning — the bill still saves: bills went through with
 * 5555555 (seven digits) and 11111111111 (eleven), numbers nobody can ring.
 *
 * A Nepali mobile is ten digits starting 97 or 98 (with or without +977); a
 * landline starts 0 and has eight to ten digits with its area code.
 */
export function phoneProblem(phone: string): { en: string; ne: string } | null {
  let number = digitsOf(phone);
  if (!number) return null;
  if (number.length === 13 && number.startsWith("977")) number = number.slice(3);
  if (/^9[78]\d{8}$/.test(number)) return null;
  if (/^0\d{7,9}$/.test(number)) return null;
  if (/^(\d)\1+$/.test(number)) {
    return { en: "Every digit is the same — is this a real number?", ne: "सबै अंक एउटै छन् — साँच्चैको नम्बर हो?" };
  }
  if (/^9/.test(number) && number.length !== 10) {
    return {
      en: `${number.length} digits — a mobile number has 10.`,
      ne: `${number.length} अंक मात्र — मोबाइल नम्बर १० अंकको हुन्छ।`,
    };
  }
  return {
    en: "This does not read like a Nepali number (mobile: 10 digits from 97 or 98).",
    ne: "नेपाली नम्बरजस्तो लागेन (मोबाइल: 97 वा 98 बाट सुरु हुने १० अंक)।",
  };
}

export type KnownCustomer = { name: string; phone: string };

const nameKey = (value: string) => String(value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const phoneKey = (value: string) => digitsOf(value).slice(-10);

const NOT_A_NAME = new Set(["walkincustomer", "walkin", "customer"]);

/**
 * Everyone the shop has billed or given an account, once each by name and
 * phone. "Walk-in Customer" is nobody. The first seen wins, so pass the newest
 * first.
 */
export function knownCustomersFrom(people: Iterable<{ name: string; phone: string }>, limit = 500) {
  const seen = new Set<string>();
  const out: KnownCustomer[] = [];
  for (const person of people) {
    const name = String(person.name ?? "").trim();
    const key = nameKey(name);
    if (!key || NOT_A_NAME.has(key)) continue;
    const id = `${key}|${phoneKey(person.phone)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ name, phone: digitsOf(person.phone) });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Customers already on the books whose name reads like the one being typed —
 * so the same customer is picked, phone and all, rather than written in again
 * ("sample 2" came to be there twice, under two phones). Names starting with
 * what was typed come first. Nothing is offered once a name and phone that
 * are on the books are both in.
 */
export function customerSuggestions(typedName: string, typedPhone: string, known: KnownCustomer[], limit = 3) {
  const typed = nameKey(typedName);
  if (typed.length < 2) return [];
  const phone = phoneKey(typedPhone);
  if (known.some((person) => nameKey(person.name) === typed && phoneKey(person.phone) === phone)) return [];
  const starts: KnownCustomer[] = [];
  const within: KnownCustomer[] = [];
  for (const person of known) {
    const key = nameKey(person.name);
    if (key.startsWith(typed)) starts.push(person);
    else if (typed.length >= 3 && key.includes(typed)) within.push(person);
  }
  return [...starts, ...within].slice(0, limit);
}

/** The customer a typed phone belongs to on an earlier bill, when the name box is still empty. */
export function customerForPhone(typedPhone: string, known: KnownCustomer[]) {
  const phone = phoneKey(typedPhone);
  if (phone.length < 7) return null;
  return known.find((person) => person.phone && phoneKey(person.phone) === phone) ?? null;
}
