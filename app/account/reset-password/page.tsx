import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getPasswordResetToken } from "@/lib/password-reset-store";
import ResetPasswordForm from "@/components/account/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const token = typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams.token : "";

  if (!token) {
    notFound();
  }

  const storedToken = await getPasswordResetToken(token);

  if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-lg px-5 py-16 md:px-8">
          <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-red-700">Invalid Link</h1>
            <p className="mt-2 text-sm text-gray-500">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-5 py-16 md:px-8">
        <ResetPasswordForm token={token} />
      </main>
      <Footer />
    </>
  );
}
