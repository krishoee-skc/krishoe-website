import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getPasswordResetToken } from "@/lib/password-reset-store";
import ResetPasswordForm from "@/components/account/ResetPasswordForm";
import ResetPasswordWithCodeForm from "@/components/account/ResetPasswordWithCodeForm";

/**
 * Two ways in, same page. A working link sets the password straight away;
 * anything else — no link, a stale one, or one a mail client broke in half —
 * falls through to the emailed code rather than a dead end that only offers to
 * send another link that may break the same way.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const token = typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams.token : "";
  const storedToken = token ? await getPasswordResetToken(token) : null;
  const linkWorks = Boolean(storedToken && new Date(storedToken.expiresAt) >= new Date());

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-5 py-16 md:px-8">
        {linkWorks ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="grid gap-4">
            {token ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                <T
              en="That link has stopped working — but the six-digit code in the email still works right now."
              ne="त्यो link चल्न छाड्यो — तर email मा आएको ६ अंकको कोडले अहिल्यै हुन्छ।"
            />
              </p>
            ) : null}
            <ResetPasswordWithCodeForm />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
