import "server-only";

import { companyContacts } from "@/lib/site-config";

type CustomerEmailInput = {
  to: string;
  subject: string;
  greeting: string;
  lines: string[];
  action?: {
    text: string;
    url: string;
  };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Письма клиентам идут через тот же Resend, что и коды регистрации.
export function isCustomerEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim(),
  );
}

export async function sendCustomerEmail(input: CustomerEmailInput) {
  if (!isCustomerEmailConfigured()) {
    return false;
  }

  const footer = `${companyContacts.address}, ${companyContacts.hours}. Телефон: ${companyContacts.phone}`;
  const text = [
    input.greeting,
    "",
    ...input.lines,
    ...(input.action ? ["", `${input.action.text}: ${input.action.url}`] : []),
    "",
    footer,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#151411">
      <p>${escapeHtml(input.greeting)}</p>
      ${input.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      ${
        input.action
          ? `<p><a href="${escapeHtml(input.action.url)}" style="display:inline-block;background:#a94730;color:#fff;padding:12px 20px;text-decoration:none">${escapeHtml(input.action.text)}</a></p>`
          : ""
      }
      <p style="color:#777">${escapeHtml(footer)}</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM?.trim(),
      to: [input.to],
      subject: input.subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Customer email failed with status ${response.status}`);
  }

  return true;
}
