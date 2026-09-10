import fs from "node:fs";

/**
 * The test sent an English month where a Bikram one belongs.
 *
 * `salaryPeriodMonth` is a Bikram Sambat key — "2083-04" for Shrawan — and the
 * salary-payment route validates that before it will accept a request. The test
 * passed "2026-07", which no real caller can send, and it only surfaced once
 * the payment path started rebuilding the month from that key.
 *
 * Shrawan 2083 is the month containing 31 July 2026, which is the date this
 * test was already using, so the fixture keeps its meaning.
 */
const P = "tests/factory-mutations.test.ts";
const raw = fs.readFileSync(P, "utf8");
const crlf = raw.includes("\r\n");
let s = crlf ? raw.split("\r\n").join("\n") : raw;

const one = (from, to) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`matched ${n}x: ${from.slice(0, 55)}`);
  s = s.replace(from, to);
};

one(
  `      salaryPeriodMonth: "2026-07",`,
  `      // A Bikram Sambat month, which is what the route validates and what
      // writeMonthlySummary needs: Shrawan 2083 holds 31 July 2026.
      salaryPeriodMonth: "2083-04",`,
);

fs.writeFileSync(P, crlf ? s.split("\n").join("\r\n") : s);
console.log("fixture now uses a Bikram month");
