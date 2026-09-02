import Link from "next/link";
import type { Metadata } from "next";
import { emailLinkStillValid } from "@/app/admin/login/actions";
import EmailLinkSignIn from "./EmailLinkSignIn";
import T from "@/components/T";

export const metadata: Metadata = {
  title: "Sign in from email | KRISHOE Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Signing in by opening the link in the two-step email.
 *
 * The code works and is slow in exactly the place it is needed most: on a
 * phone, it means leaving the shop, opening the inbox, reading six digits,
 * coming back, and typing them before they expire. The owner spent eleven
 * minutes in that loop this morning. The link removes the typing.
 *
 * The one rule this page exists to keep: opening it must not sign anyone in.
 * Mail providers and link scanners fetch every URL in a message to build a
 * preview, and a session created by a machine reading an inbox is a session
 * nobody asked for. So the GET only looks the token up — never spends it — and
 * renders a button. The sign-in happens on the press.
 *
 * The token is spent when that button is pressed, so a link works once and for
 * the ten minutes its code was already good for.
 */
export default async function EmailSignInLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; c?: string }>;
}) {
  const { t = "", c = "" } = await searchParams;
  const usable = t.trim() !== "" && /^\d{6}$/.test(c.trim()) && (await emailLinkStillValid(t));

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-green-ink px-5 py-16">
      <section className="w-full max-w-md rounded-2xl border border-white/15 bg-brand-paper p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE · Admin
        </p>

        {usable ? (
          <EmailLinkSignIn token={t} code={c} />
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink">
              <T en="This link no longer works" ne="यो link अब चल्दैन" />
            </h1>
            <p className="mt-3 text-sm leading-7 text-brand-muted">
              <T
                en="A link works for 10 minutes only, and ends once it has been used. If a new code was requested, the old link is cancelled automatically."
                ne="Link १० मिनेटसम्म मात्र चल्छ, र एक पटक प्रयोग भएपछि सकिन्छ। नयाँ कोड मागेको भए पनि पुरानो link आफैँ रद्द हुन्छ।"
              />
            </p>
            <Link
              href="/admin/login"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white"
            >
              <T en="Log in again" ne="फेरि login गर्ने" />
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
