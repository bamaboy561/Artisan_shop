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

type ResendDeliveryResult =
  | {
      ok: true;
      message: string;
      id?: string;
    }
  | {
      ok: false;
      message: string;
      status?: number;
      providerMessage?: string;
      missingEnv?: string[];
    };

type SendRegistrationVerificationCodeInput = {
  email: string;
  firstName: string;
  code: string;
  expiresAt: Date;
};

type ResendEmailInput = {
  to: string[];
  subject: string;
  text: string;
  html: string;
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

function getMissingEmailEnv() {
  const missingEnv: string[] = [];

  if (!getResendApiKey()) {
    missingEnv.push("RESEND_API_KEY");
  }

  if (!getRegistrationEmailFrom()) {
    missingEnv.push("AUTH_EMAIL_FROM");
  }

  return missingEnv;
}

export function getRegistrationEmailStatus() {
  const from = getRegistrationEmailFrom();
  const missingEnv = getMissingEmailEnv();

  return {
    ready: missingEnv.length === 0,
    apiKeyConfigured: Boolean(getResendApiKey()),
    fromConfigured: Boolean(from),
    from: from || null,
    missingEnv,
    debugCodeEnabled: isDebugCodeEnabled(),
  };
}

function getProviderMessage(value: string) {
  if (!value) {
    return "";
  }

  try {
    const payload = JSON.parse(value) as {
      message?: unknown;
      error?: unknown;
      name?: unknown;
    };

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (typeof payload.name === "string") {
      return payload.name;
    }
  } catch {
    return value;
  }

  return value;
}

async function sendResendEmail(input: ResendEmailInput): Promise<ResendDeliveryResult> {
  const apiKey = getResendApiKey();
  const from = getRegistrationEmailFrom();
  const missingEnv = getMissingEmailEnv();

  if (missingEnv.length > 0) {
    return {
      ok: false,
      message: `Не настроены переменные email: ${missingEnv.join(", ")}.`,
      missingEnv,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    const responseText = await response.text();

    if (response.ok) {
      let id: string | undefined;

      try {
        const payload = JSON.parse(responseText) as { id?: unknown };
        id = typeof payload.id === "string" ? payload.id : undefined;
      } catch {
        id = undefined;
      }

      return {
        ok: true,
        message: "Письмо отправлено через Resend.",
        id,
      };
    }

    const providerMessage = getProviderMessage(responseText);

    return {
      ok: false,
      status: response.status,
      providerMessage,
      message: providerMessage
        ? `Resend вернул ошибку ${response.status}: ${providerMessage}`
        : `Resend вернул ошибку ${response.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Не удалось подключиться к Resend: ${error.message}`
          : "Не удалось подключиться к Resend.",
    };
  }
}

export async function sendRegistrationEmailTest(
  email: string,
): Promise<ResendDeliveryResult> {
  const safeEmail = escapeHtml(email);

  return sendResendEmail({
    to: [email],
    subject: "Тест email Artisan",
    text: [
      "Это тестовое письмо Artisan.",
      "Если вы его получили, RESEND_API_KEY и AUTH_EMAIL_FROM настроены корректно.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#151411">
        <h1 style="font-size:22px;margin:0 0 12px">Тест email Artisan</h1>
        <p>Это тестовое письмо отправлено на ${safeEmail}.</p>
        <p style="color:#777">Если письмо пришло, RESEND_API_KEY, AUTH_EMAIL_FROM и домен отправителя настроены корректно.</p>
      </div>
    `,
  });
}

export async function sendRegistrationVerificationCode(
  input: SendRegistrationVerificationCodeInput,
): Promise<RegistrationVerificationDeliveryResult> {
  const email = buildVerificationEmail(input);
  const delivery = await sendResendEmail({
    to: [input.email],
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (delivery.ok) {
    return {
      ok: true,
      message: "Код подтверждения отправлен на email.",
    };
  }

  console.error("Registration verification email failed", delivery);

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
