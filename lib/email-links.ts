/**
 * Base URL for links placed inside outbound email.
 *
 * It differs from getSiteUrl() only in its fallback: a reset link sent while
 * developing has to point at localhost, not the production domain.
 *
 * The trim is the part that matters. A value pasted into a hosting dashboard
 * can carry a trailing newline, and `.replace(/\/$/, "")` does not remove it —
 * so the newline survived into the middle of every emailed link. In a
 * plain-text email that splits the URL across two lines, and the recipient
 * clicks a stub that lands on the homepage instead of the reset page. Staff
 * password recovery was broken this way while every audit row said the mail had
 * been sent successfully.
 */
export function emailLinkBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}
