// Rupee amounts spelled out for the foot of a bill — "Sixteen Thousand Five
// Hundred Only." Nepal reads money in the South-Asian system (Thousand, Lakh,
// Crore), so that is the grouping used here, not the international million.
//
// Takes a whole-rupee amount (the bill total is already rounded to the rupee in
// this app). Paisa is not spelled because these bills do not carry it.

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

// A number below 1000 in words, with no leading/trailing spaces.
function twoOrThreeDigits(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} Hundred` + (n % 100 ? ` ${twoOrThreeDigits(n % 100)}` : "");
}

/**
 * Spell a whole-rupee amount for a bill, ending in "Only".
 * Uses the Nepali/Indian grouping: Crore, Lakh, Thousand, Hundred.
 */
export function amountInWords(rupees: number): string {
  const amount = Math.max(0, Math.floor(Number(rupees) || 0));
  if (amount === 0) return "Zero Only";

  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const rest = amount % 1000; // hundreds + tens + ones

  const parts: string[] = [];
  if (crore) parts.push(`${twoOrThreeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoOrThreeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoOrThreeDigits(thousand)} Thousand`);
  if (rest) parts.push(twoOrThreeDigits(rest));

  return `${parts.join(" ")} Only`;
}
