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

const loginSchema = z.object({
  email: z.email("Введите корректный email").trim(),
  password: z.string().min(8, "Введите пароль"),
  next: z.string().optional(),
});

const registerSchema = z
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

export type LoginFormState = {
  message?: string;
  success?: boolean;
  redirectTo?: string;
};

export type RegisterFormState = {
  message?: string;
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
          "Сначала подключите PostgreSQL и выполните seed, после этого вход станет доступен.",
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
  if (!hasDatabaseUrl()) {
    return {
      message: isDemoAdminEnabled()
        ? "Сейчас включен demo-режим для команды. Регистрация клиентов откроется после подключения PostgreSQL."
        : "Сначала подключите PostgreSQL и выполните seed, после этого регистрация станет доступна.",
    };
  }

  if (!isSessionConfigured()) {
    return {
      message:
        "Регистрация пока недоступна: добавьте SESSION_SECRET в .env и перезапустите проект.",
    };
  }

  const validated = registerSchema.safeParse({
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
      message:
        validated.error.issues[0]?.message ??
        "Проверьте корректность данных регистрации.",
    };
  }

  const { hash } = await import("bcryptjs");
  const db = getDb();
  const normalizedEmail = validated.data.email.toLowerCase();

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return {
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

  const hashedPassword = await hash(validated.data.password, 10);

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      hashedPassword,
      firstName: validated.data.firstName,
      lastName: validated.data.lastName || null,
      phone: validated.data.phone || null,
      companyName: validated.data.companyName || null,
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
    redirectTo: getSafeRedirectPath(validated.data.next, "/account"),
  };
}

export async function signOutAction() {
  await destroySession();
  revalidatePath("/");
  redirect("/login");
}
