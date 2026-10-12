import type { Metadata } from "next";
import { RecoveryForm } from "@/app/forgot-password/recovery-form";
import { Container } from "@/components/ui/container";
import { noIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "Новый пароль", robots: noIndexRobots, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <Container className="grid min-h-[calc(100vh-9rem)] place-items-center py-12">
    <section className="w-full max-w-md rounded-lg border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Новый пароль</h1>
      <RecoveryForm token={typeof token === "string" && token.length <= 165 ? token : ""} />
    </section>
  </Container>;
}
