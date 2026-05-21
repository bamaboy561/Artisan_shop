import "server-only";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(payload: EmailPayload) {
  if (!isEmailEnabled()) {
    console.log("[email] Skipped: RESEND_API_KEY not configured");
    return { ok: false, message: "Email not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Artisan <info@artisan.shop.kg>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[email] Resend API error:", text);
      return { ok: false, message: text };
    }

    return { ok: true, message: "sent" };
  } catch (error) {
    console.error("[email] Failed:", error);
    return { ok: false, message: String(error) };
  }
}

export function buildOrderCreatedEmail(params: {
  orderNumber: string;
  customerName: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}) {
  const itemsHtml = params.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eaeaea">${item.name} × ${item.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #eaeaea;text-align:right">${new Intl.NumberFormat("ru-RU").format(item.price * item.quantity)} KGS</td></tr>`,
    )
    .join("");

  return {
    subject: `Заказ ${params.orderNumber} принят — Artisan`,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;color:#171613">
        <h1 style="font-size:20px;color:#c76a43">Artisan</h1>
        <p>${params.customerName}, ваш заказ <strong>${params.orderNumber}</strong> принят.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          ${itemsHtml}
        </table>
        <p style="font-size:18px;font-weight:bold">Итого: ${new Intl.NumberFormat("ru-RU").format(params.total)} KGS</p>
        <p style="color:#615a53;font-size:13px">Менеджер свяжется с вами для подтверждения. Статус заказа можно отслеживать в личном кабинете.</p>
        <p style="margin-top:24px">
          <a href="https://artisan.shop.kg/account/orders" style="display:inline-block;background:#171613;color:white;padding:10px 24px;text-decoration:none;font-size:13px">Перейти в кабинет</a>
        </p>
      </div>
    `,
  };
}