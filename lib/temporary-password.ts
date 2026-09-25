import { adminPasswordPolicyMessage } from "@/lib/admin-password-policy";

/**
 * A temporary password the Owner can read out to a worker, and a check on the
 * ones the Owner types.
 *
 * The Owner used to invent them, and eight characters were enough — so they
 * came out as "ram12345": the worker's name and a count. This makes two short,
 * everyday words and four digits ("Chappal-Hill-4827"): easy to say across the
 * factory floor, hard to guess, and replaced by the worker at the first
 * sign-in anyway.
 */

// Short, plain, unambiguous when spoken — no two that sound alike, nothing that
// reads as an insult in Nepali or English.
const WORDS = [
  "Chappal", "Shoe", "Sandal", "Sole", "Lace", "Heel", "Buckle", "Leather",
  "Hill", "Lake", "River", "Cloud", "Stone", "Forest", "Valley", "Garden",
  "Tiger", "Rhino", "Eagle", "Falcon", "Yak", "Crane", "Panda", "Deer",
  "Mango", "Lemon", "Apple", "Orange", "Banana", "Guava", "Cherry", "Grape",
  "Copper", "Silver", "Golden", "Marble", "Cotton", "Bamboo", "Candle", "Lantern",
  "Rocket", "Bridge", "Tower", "Window", "Ladder", "Basket", "Bottle", "Pencil",
  "Summer", "Winter", "Monsoon", "Sunrise", "Sunset", "Morning", "Evening", "Thunder",
  "Kettle", "Drum", "Flute", "Kite", "Boat", "Train", "Wheel", "Anchor",
];

function randomInt(max: number) {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function generateTemporaryPassword() {
  const first = WORDS[randomInt(WORDS.length)];
  let second = WORDS[randomInt(WORDS.length)];
  while (second === first) second = WORDS[randomInt(WORDS.length)];
  const digits = String(1000 + randomInt(9000));
  return `${first}-${second}-${digits}`;
}

/**
 * Why a typed temporary password is refused, or "" if it will do.
 *
 * The same rules as a password someone chooses for themselves — twelve
 * characters, a letter and a number, nothing on the list of obvious ones — and
 * one more: not the person's own name, which is the first thing anyone guesses.
 */
export function temporaryPasswordProblem(password: string, personName: string) {
  const policy = adminPasswordPolicyMessage(password);
  if (policy) return policy;
  const lowered = password.toLowerCase();
  const nameParts = personName.toLowerCase().split(/\s+/).filter((part) => part.length >= 3);
  if (nameParts.some((part) => lowered.includes(part))) {
    return "Do not use the person's own name in the password.";
  }
  return "";
}
