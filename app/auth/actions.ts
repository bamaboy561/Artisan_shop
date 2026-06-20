"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { RoleCode } from "@/generated/prisma";
import {
  getDemoAdminSession,
  isDemoAdminEnabled,
  matchesDemoAdminCredentials,
} from "@/lib/auth/demo-access";
import { getSafeRedirectPath, verifyCredentials } from "@/lib/auth/dal";
import {
  createSession,
  destroySession,
  isSessionConfigured,
} from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  clearRegistrationChallenge,
  createRegistrationChallenge,
  readRegistrationChallenge,
  refreshRegistrationChallengeCode,
  verifyRegistrationChallengeCode,
} from "@/lib/auth/registration-challenge";
import { sendRegistrationVerificationCode } from "@/lib/server/registration-verification";

const loginSchema = z.object({
  email: z.email("Введите корректный email").trim(),
  password: z.string().min(8, "Введите пароль"),
  next: z.string().optional(),
});

const registerDetailsSchema = z
  .object({
    firstName: z.string().trim().min(2, "Введите имя"),
    lastName: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
    companyName: z.string().trim().optional().default(""),
    email: z.email("Введите корректный email").trim(),
    password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
    confirmPassword: z.string().min(8, "Подтвердите пароль"),
    next: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

const registerVerificationSchema = z.object({
  email: z.email("Введите корректный email").trim(),
  verificationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Введите 6 цифр из письма."),
  next: z.string().optional(),
});

export type LoginFormState = {
  message?: string;
  success?: boolean;
  redirectTo?: string;
};

export type RegisterFormState = {
  message?: string;
  tone?: "error" | "info" | "success";
  step?: "details" | "verify";
  email?: string;
  debugCode?: string;
  success?: boolean;
  redirectTo?: string;
};

type AuthCredentials = {
  userId: string;
  roleCode: RoleCode;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export async function signInAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!validated.success) {
    return {
      message:
        validated.error.issues[0]?.message ?? "Проверьте корректность данных.",
    };
  }

  const { email, password, next } = validated.data;
  let credentials: AuthCredentials | null = null;
  let databaseUnavailable = false;

  if (hasDatabaseUrl()) {
    try {
      credentials = await verifyCredentials(email, password);
    } catch {
      databaseUnavailable = true;
    }
  }

  if (!credentials && matchesDemoAdminCredentials(email, password)) {
    credentials = getDemoAdminSession();
  }

  if (!credentials) {
    if (!hasDatabaseUrl() && !isDemoAdminEnabled()) {
      return {
        message:
          "Сначала подключите PostgreSQL и выполните seed. После этого вход станет доступен.",
      };
    }

    if (databaseUnavailable) {
      return {
        message: isDemoAdminEnabled()
          ? "Подключение к базе сейчас недоступно. Для проверки админки используйте demo-аккаунт ниже."
          : "Не удалось подключиться к базе. Проверьте DATABASE_URL и попробуйте снова.",
      };
    }

    return {
      message: isDemoAdminEnabled()
        ? "Неверный email или пароль. Для быстрого входа можно использовать demo-аккаунт администратора."
        : "Неверный email или пароль.",
    };
  }

  try {
    await createSession(credentials);
  } catch {
    return {
      message:
        "Авторизация пока недоступна: добавьте SESSION_SECRET в .env и перезапустите проект.",
    };
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/admin");

  const defaultRedirectTo = canAccessAdmin(credentials.roleCode)
    ? "/admin"
    : "/account";
  const requestedRedirectTo = getSafeRedirectPath(next, defaultRedirectTo);
  const redirectTo =
    canAccessAdmin(credentials.roleCode) &&
    !requestedRedirectTo.startsWith("/admin")
      ? defaultRedirectTo
      : requestedRedirectTo;

  return {
    success: true,
    redirectTo,
  };
}

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const intent = String(formData.get("intent") ?? "request-code");

  if (intent === "restart") {
    await clearRegistrationChallenge();
    return {
      step: "details",
      message: "Введите данные заново, и мы отправим новый код.",
      tone: "info",
    };
  }

  if (!hasDatabaseUrl()) {
    return {
      message: isDemoAdminEnabled()
        ? "Сейчас включен demo-режим для команды. Регистрация клиентов откроется после подключения PostgreSQL."
        : "Сначала подключите PostgreSQL и выполните seed. После этого регистрация станет доступна.",
    };
  }

  if (!isSessionConfigured()) {
    return {
      message:
        "Регистрация пока недоступна: добавьте SESSION_SECRET в .env и перезапустите проект.",
    };
  }

  const db = getDb();

  if (intent === "resend-code") {
    const challenge = await readRegistrationChallenge();

    if (!challenge) {
      return {
        step: "details",
        tone: "error",
        message:
          "Код истек или регистрация была прервана. Заполните форму заново.",
      };
    }

    const existingUser = await db.user.findUnique({
      where: { email: challenge.email },
      select: { id: true },
    });

    if (existingUser) {
      await clearRegistrationChallenge();
      return {
        step: "details",
        tone: "error",
        message:
          "Пользователь с таким email уже существует. Войдите в кабинет или используйте другой адрес.",
      };
    }

    const refreshed = await refreshRegistrationChallengeCode(challenge);
    const delivery = await sendRegistrationVerificationCode({
      email: challenge.email,
      firstName: challenge.firstName,
      code: refreshed.code,
      expiresAt: refreshed.expiresAt,
    });

    if (!delivery.ok) {
      await clearRegistrationChallenge();
      return {
        step: "details",
        tone: "error",
        message: delivery.message,
      };
    }

    return {
      step: "verify",
      tone: "success",
      email: challenge.email,
      debugCode: delivery.debugCode,
      message: delivery.message,
    };
  }

  if (intent === "verify-code") {
    const validatedCode = registerVerificationSchema.safeParse({
      email: formData.get("email"),
      verificationCode: formData.get("verificationCode"),
      next: formData.get("next"),
    });

    if (!validatedCode.success) {
      return {
        step: "verify",
        tone: "error",
        email: String(formData.get("email") ?? ""),
        message:
          validatedCode.error.issues[0]?.message ??
          "Проверьте код подтверждения.",
      };
    }

    const normalizedEmail = validatedCode.data.email.toLowerCase();
    const verification = await verifyRegistrationChallengeCode(
      validatedCode.data.verificationCode,
    );

    if (!verification.ok) {
      const message =
        verification.reason === "expired" || verification.reason === "missing"
          ? "Код истек. Заполните регистрацию заново и получите новый код."
          : verification.reason === "locked"
            ? "Слишком много неверных попыток. Заполните регистрацию заново."
            : `Неверный код. Осталось попыток: ${verification.attemptsLeft ?? 0}.`;

      return {
        step:
          verification.reason === "invalid" && verification.attemptsLeft
            ? "verify"
            : "details",
        tone: "error",
        email: normalizedEmail,
        message,
      };
    }

    if (verification.challenge.email !== normalizedEmail) {
      return {
        step: "details",
        tone: "error",
        message: "Email не совпадает с активным кодом. Заполните форму заново.",
      };
    }

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      await clearRegistrationChallenge();
      return {
        step: "details",
        tone: "error",
        message:
          "Пользователь с таким email уже существует. Войдите в кабинет или используйте другой адрес.",
      };
    }

    await db.role.upsert({
      where: { code: RoleCode.CUSTOMER },
      update: {},
      create: {
        code: RoleCode.CUSTOMER,
        name: "Клиент",
        description:
          "Покупатель с доступом к личному кабинету, заказам и программе лояльности.",
      },
    });

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        hashedPassword: verification.challenge.hashedPassword,
        firstName: verification.challenge.firstName,
        lastName: verification.challenge.lastName,
        phone: verification.challenge.phone,
        companyName: verification.challenge.companyName,
        isActive: true,
        role: {
          connect: {
            code: RoleCode.CUSTOMER,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    await clearRegistrationChallenge();
    await createSession({
      userId: user.id,
      roleCode: RoleCode.CUSTOMER,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    revalidatePath("/");
    revalidatePath("/account");
    revalidatePath("/checkout");

    return {
      success: true,
      redirectTo: getSafeRedirectPath(
        verification.challenge.next ?? validatedCode.data.next,
        "/account",
      ),
    };
  }

  const validated = registerDetailsSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    next: formData.get("next"),
  });

  if (!validated.success) {
    return {
      step: "details",
      tone: "error",
      message:
        validated.error.issues[0]?.message ??
        "Проверьте корректность данных регистрации.",
    };
  }

  const { hash } = await import("bcryptjs");
  const normalizedEmail = validated.data.email.toLowerCase();

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return {
      step: "details",
      tone: "error",
      message:
        "Пользователь с таким email уже существует. Войдите в кабинет или используйте другой адрес.",
    };
  }

  const hashedPassword = await hash(validated.data.password, 10);
  const challenge = await createRegistrationChallenge({
    email: normalizedEmail,
    firstName: validated.data.firstName,
    lastName: validated.data.lastName || null,
    phone: validated.data.phone || null,
    companyName: validated.data.companyName || null,
    hashedPassword,
    next: validated.data.next,
  });
  const delivery = await sendRegistrationVerificationCode({
    email: normalizedEmail,
    firstName: validated.data.firstName,
    code: challenge.code,
    expiresAt: challenge.expiresAt,
  });

  if (!delivery.ok) {
    await clearRegistrationChallenge();
    return {
      step: "details",
      tone: "error",
      message: delivery.message,
    };
  }

  return {
    step: "verify",
    tone: "success",
    email: normalizedEmail,
    debugCode: delivery.debugCode,
    message: delivery.message,
  };
}

export async function signOutAction() {
  await destroySession();
  revalidatePath("/");
  redirect("/login");
}
