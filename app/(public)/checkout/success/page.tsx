import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { noIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Заказ принят",
  robots: noIndexRobots,
};

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    order?: string;
    points?: string;
    redeemed?: string;
  }>;
};

function getPositiveNumber(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const params = await searchParams;
  const orderNumber = params.order?.trim() || null;
  const awardedPoints = getPositiveNumber(params.points);
  const redeemedPoints = getPositiveNumber(params.redeemed);

  return (
    <Container className="py-16 sm:py-24">
      <section className="surface-glow mx-auto max-w-3xl rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-8 text-center sm:p-12">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
          Заказ оформлен
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
          Спасибо, заказ принят в работу
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          Менеджер свяжется с вами для подтверждения комплектации, сроков и
          доставки. Детали заказа уже доступны команде в админке.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] px-5 py-5 text-left">
            <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
              Номер заказа
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {orderNumber ?? "Будет назначен менеджером"}
            </p>
          </div>

          <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] px-5 py-5 text-left">
            <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
              Начислено баллов
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {awardedPoints > 0 ? awardedPoints : "—"}
            </p>
          </div>

          <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] px-5 py-5 text-left">
            <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
              Списано баллов
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {redeemedPoints > 0 ? redeemedPoints : "—"}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account/orders">
            <Button>Мои заказы</Button>
          </Link>
          <Link href="/catalog">
            <Button variant="secondary">Вернуться в каталог</Button>
          </Link>
        </div>
      </section>
    </Container>
  );
}
