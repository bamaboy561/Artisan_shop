import QRCode from "qrcode";

import { absoluteUrl } from "@/lib/seo";

type CustomerQrCardProps = {
  userId: string;
  displayName: string;
};

export async function CustomerQrCard({
  userId,
  displayName,
}: CustomerQrCardProps) {
  const adminUrl = absoluteUrl(`/client-qr/${userId}`);
  const qrSvg = await QRCode.toString(adminUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  });

  return (
    <section className="grid gap-3 rounded-[26px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_18px_44px_rgba(17,17,17,0.04)] sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5">
      <div
        className="mx-auto size-[220px] overflow-hidden rounded-[22px] border border-[color:var(--line)] bg-white p-3 sm:mx-0"
        aria-label="QR-код клиента"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <div className="min-w-0 self-center">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
          QR клиента
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          Покажите менеджеру в салоне
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          По этому коду менеджер откроет вашу карточку, добавит выбранные
          товары и сохранит покупку в историю кабинета.
        </p>
        <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
          {["Показать QR", "Менеджер добавит товары", "Бонусы появятся после подтверждения"].map(
            (item) => (
              <div
                key={item}
                className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2"
              >
                {item}
              </div>
            ),
          )}
        </div>
        <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
          <span className="block text-xs text-[var(--muted)]">
            Карта клиента
          </span>
          <strong className="mt-1 block truncate text-[var(--foreground)]">
            {displayName}
          </strong>
        </div>
      </div>
    </section>
  );
}
