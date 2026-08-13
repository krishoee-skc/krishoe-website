import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Worker Login | KRISHOE",
  description: "Secure KRISHOE worker portal sign-in.",
};

export default async function WorkerLoginPage() {
  if (await getAdminSession()) redirect("/worker/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-brand-green-ink px-5 py-16">
      <Image
        src="/images/hero-banner.png"
        alt="KRISHOE footwear factory"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,35,29,0.96),rgba(16,35,29,0.7))]" />
      <div className="relative z-10 flex w-full justify-center">
        <AdminLoginForm nextPath="/worker/dashboard" portal="worker" />
      </div>
    </main>
  );
}
