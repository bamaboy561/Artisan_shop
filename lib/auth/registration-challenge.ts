import "server-only";

import { createHash, randomInt } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";

export const registrationChallengeCookieName = "artisan-registration-challenge";
export const registrationChallengeTtlMs = 10 * 60 * 1000;
export const maxRegistrationChallengeAttempts = 5;

const registrationChallengeSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  hashedPassword: z.string().min(1),
  codeHash: z.string().min(1),
  attempts: z.number().int().min(0).max(maxRegistrationChallengeAttempts),
  expiresAt: z.number().int().positive(),
  next: z.string().optional(),
});

export type RegistrationChallenge = z.infer<typeof registrationChallengeSchema>;

export type RegistrationChallengeInput = Omit<
  RegistrationChallenge,
  "attempts" | "codeHash" | "expiresAt"
>;

export type RegistrationChallengeCreateResult = {
  code: string;
  expiresAt: Date;
};

type VerificationResult =
  | {
      ok: true;
      challenge: RegistrationChallenge;
    }
  | {
      ok: false;
      reason: "missing" | "expired" | "invalid" | "locked";
      attemptsLeft?: number;
    };

function getRegistrationChallengeSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Registration verification needs encrypted cookies.",
    );
  }

  return createHash("sha256").update(secret).digest();
}

function generateVerificationCode() {
  return String(randomInt(100000, 1000000));
}

function getCodePayload(email: string, code: string) {
  return `${email.toLowerCase()}:${code.trim()}`;
}

async function encryptChallenge(challenge: RegistrationChallenge) {
  return new EncryptJWT(challenge)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .encrypt(getRegistrationChallengeSecret());
}

async function writeRegistrationChallenge(challenge: RegistrationChallenge) {
  const token = await encryptChallenge(challenge);
  const cookieStore = await cookies();

  cookieStore.set(registrationChallengeCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/register",
    maxAge: registrationChallengeTtlMs / 1000,
  });
}

export async function clearRegistrationChallenge() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: registrationChallengeCookieName,
    path: "/register",
  });
}

export async function readRegistrationChallenge() {
  const cookieStore = await cookies();
  const token = cookieStore.get(registrationChallengeCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtDecrypt(
      token,
      getRegistrationChallengeSecret(),
      {
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      },
    );
    const parsed = registrationChallengeSchema.safeParse(payload);

    if (!parsed.success || parsed.data.expiresAt <= Date.now()) {
      await clearRegistrationChallenge();
      return null;
    }

    return parsed.data;
  } catch {
    await clearRegistrationChallenge();
    return null;
  }
}

export async function createRegistrationChallenge(
  input: RegistrationChallengeInput,
): Promise<RegistrationChallengeCreateResult> {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + registrationChallengeTtlMs);
  const codeHash = await hash(getCodePayload(input.email, code), 10);

  await writeRegistrationChallenge({
    ...input,
    codeHash,
    attempts: 0,
    expiresAt: expiresAt.getTime(),
  });

  return { code, expiresAt };
}

export async function refreshRegistrationChallengeCode(
  challenge: RegistrationChallenge,
): Promise<RegistrationChallengeCreateResult> {
  return createRegistrationChallenge({
    email: challenge.email,
    firstName: challenge.firstName,
    lastName: challenge.lastName,
    phone: challenge.phone,
    companyName: challenge.companyName,
    hashedPassword: challenge.hashedPassword,
    next: challenge.next,
  });
}

export async function verifyRegistrationChallengeCode(
  code: string,
): Promise<VerificationResult> {
  const challenge = await readRegistrationChallenge();

  if (!challenge) {
    return { ok: false, reason: "missing" };
  }

  if (challenge.expiresAt <= Date.now()) {
    await clearRegistrationChallenge();
    return { ok: false, reason: "expired" };
  }

  if (challenge.attempts >= maxRegistrationChallengeAttempts) {
    await clearRegistrationChallenge();
    return { ok: false, reason: "locked" };
  }

  const isValid = await compare(
    getCodePayload(challenge.email, code),
    challenge.codeHash,
  );

  if (!isValid) {
    const attempts = challenge.attempts + 1;
    const attemptsLeft = Math.max(
      0,
      maxRegistrationChallengeAttempts - attempts,
    );

    if (attemptsLeft === 0) {
      await clearRegistrationChallenge();
      return { ok: false, reason: "locked", attemptsLeft };
    }

    await writeRegistrationChallenge({
      ...challenge,
      attempts,
    });

    return { ok: false, reason: "invalid", attemptsLeft };
  }

  return {
    ok: true,
    challenge,
  };
}
