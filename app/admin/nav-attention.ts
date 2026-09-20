/**
 * Which menu links want looking at, from the checks the shop already runs.
 *
 * The self-check answers eight questions — is anything unpriced, is a customer
 * waiting, is a lot sitting at QC — and each answer carries the screen that
 * puts it right. Those answers live on /admin/alerts, which is a screen you
 * have to think to visit, so the app knows what needs doing and says nothing
 * until asked.
 *
 * This turns the same answers into a mark on the menu. Nothing new is counted
 * and the database is not asked again; the checks are simply shown where the
 * choice of screen is made.
 */

/** How loudly a link is asking. Matches the self-check's own severities. */
export type AttentionLevel = "critical" | "warning" | "info";

/** Only the two fields this needs, so a caller can pass a SelfCheck as-is. */
type Pointed = { severity: AttentionLevel; href: string };

/** Loudest first — the order a link's marks are resolved by. */
const RANK: Record<AttentionLevel, number> = { critical: 3, warning: 2, info: 1 };

/**
 * Every link a check reaches, from the screen itself up to its section.
 *
 * A lot waiting at QC points at /admin/operations/production-accounts/lots and
 * no menu link goes that deep, so marking only the exact path would leave the
 * checks furthest in as the ones nobody ever sees. Walking up means the dot
 * lands on "Operations", which is the link that leads there.
 *
 * Built by path segment rather than by string prefix: /admin/products must not
 * be marked by a check on /admin/products-labels, which a `startsWith` would
 * do — sending the owner to a screen where the thing is not.
 */
function linksAbove(href: string): string[] {
  const parts = String(href ?? "").split("/").filter(Boolean);
  if (parts[0] !== "admin" || parts.length < 2) return [];

  const links: string[] = [];
  let path = "/admin";
  for (const part of parts.slice(1)) {
    path += `/${part}`;
    links.push(path);
  }
  return links;
}

/**
 * The mark for each link, keyed by href.
 *
 * A link with several checks keeps the worst: the inbox can hold an unanswered
 * review and a new message at once, the dot has one colour, and showing the
 * gentler of the two hides the reason to go.
 */
export function attentionByHref(checks: readonly Pointed[]): Map<string, AttentionLevel> {
  const marks = new Map<string, AttentionLevel>();

  for (const check of checks) {
    // No guard on a missing href: linksAbove returns nothing for one, so the
    // loop below simply does not run. A second check here would read as a rule
    // while changing nothing — and a mutation proved it changed nothing.
    for (const link of linksAbove(check?.href)) {
      const current = marks.get(link);
      if (!current || RANK[check.severity] > RANK[current]) {
        marks.set(link, check.severity);
      }
    }
  }

  return marks;
}
