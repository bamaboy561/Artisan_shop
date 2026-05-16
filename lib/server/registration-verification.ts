import "server-only";

type RegistrationVerificationDeliveryResult =
  | {
      ok: true;
      message: string;
      debugCode?: string;
    }
  | {
      ok: false;
      message: string;
    };

type SendRegistrationVerificationCodeInput = {
  email: string;
  firstName: string;
  code: string;
  expiresAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRegistrationEmailFrom() {
  return process.env.AUTH_EMAIL_FROM?.trim() || "";
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

function isDebugCodeEnabled() {
  if (process.env.REGISTRATION_2FA_DEBUG_CODE === "true") {
    return true;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    process.env.REGISTRATION_2FA_DEBUG_CODE !== "false"
  );
}

function buildVerificationEmail(input: SendRegistrationVerificationCodeInput) {
  const safeName = escapeHtml(input.firstName);
  const safeCode = escapeHtml(input.code);
  const expiresAt = input.expiresAt.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    subject: "Код подтверждения Artisan",
    text: [
      `${input.firstName}, ваш код подтверждения Artisan: ${input.code}`,
      `Код действует до ${expiresAt}.`,
      "Если вы не регистрировались на artisan.shop.kg, просто игнорируйте это письмо.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#151411">
        <p>${safeName}, ваш код подтверждения Artisan:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:18px 0">${safeCode}</p>
        <p>Код действует до ${escapeHtml(expiresAt)}.</p>
        <p style="color:#777">Если вы не регистрировались на artisan.shop.kg, просто игнорируйте это письмо.</p>
      </div>
    `,
  };
}

export async function sendRegistrationVerificationCode(
  input: SendRegistrationVerificationCodeInput,
): Promise<RegistrationVerificationDeliveryResult> {
  const apiKey = getResendApiKey();
  const from = getRegistrationEmailFrom();
  const email = buildVerificationEmail(input);

  if (apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.email],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });

      if (response.ok) {
        return {
          ok: true,
          message: "Код подтверждения отправлен на email.",
        };
      }

      console.error(
        "Registration verification email failed",
        response.status,
        await response.text(),
      );
    } catch (error) {
      console.error("Registration verification email failed", error);
    }
  }

  if (isDebugCodeEnabled()) {
    return {
      ok: true,
      message:
        "Email-провайдер не настроен. Для локальной проверки используйте код ниже.",
      debugCode: input.code,
    };
  }

  return {
    ok: false,
    message:
      "Отправка кода подтверждения пока не настроена. Добавьте RESEND_API_KEY и AUTH_EMAIL_FROM в переменные окружения.",
  };
}
