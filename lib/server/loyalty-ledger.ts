import {
  LoyaltyTransactionStatus,
  type LoyaltyTransactionType,
  type Prisma,
} from "@/generated/prisma";

export class InsufficientLoyaltyBalanceError extends Error {
  constructor() {
    super("Недостаточно бонусов. Обновите страницу и проверьте баланс.");
    this.name = "InsufficientLoyaltyBalanceError";
  }
}

type ApprovedLoyaltyDeltaInput = {
  userId: string;
  orderId?: string | null;
  type: LoyaltyTransactionType;
  points: number;
  title: string;
  description?: string | null;
  approvedById?: string | null;
  externalId?: string | null;
  requireSufficientBalance?: boolean;
  recordBalanceBefore?: boolean;
};

export async function applyApprovedLoyaltyDelta(
  tx: Prisma.TransactionClient,
  input: ApprovedLoyaltyDeltaInput,
) {
  if (input.externalId) {
    const existing = await tx.loyaltyTransaction.findUnique({
      where: { externalId: input.externalId },
      select: { id: true, points: true, balanceAfter: true },
    });

    if (existing) {
      return { ...existing, applied: false };
    }
  }

  if (input.points < 0 && input.requireSufficientBalance) {
    const updated = await tx.user.updateMany({
      where: {
        id: input.userId,
        loyaltyPointsBalance: { gte: Math.abs(input.points) },
      },
      data: {
        loyaltyPointsBalance: { increment: input.points },
      },
    });

    if (updated.count === 0) {
      throw new InsufficientLoyaltyBalanceError();
    }
  } else {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        loyaltyPointsBalance: { increment: input.points },
        ...(input.points > 0
          ? { loyaltyPointsLifetime: { increment: input.points } }
          : {}),
      },
    });
  }

  const user = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { loyaltyPointsBalance: true },
  });
  const transaction = await tx.loyaltyTransaction.create({
    data: {
      userId: input.userId,
      orderId: input.orderId ?? null,
      type: input.type,
      status: LoyaltyTransactionStatus.APPROVED,
      points: input.points,
      balanceBefore: input.recordBalanceBefore
        ? user.loyaltyPointsBalance - input.points
        : undefined,
      balanceAfter: user.loyaltyPointsBalance,
      approvedAt: new Date(),
      approvedById: input.approvedById ?? null,
      externalId: input.externalId ?? null,
      title: input.title,
      description: input.description ?? null,
    },
    select: { id: true, points: true, balanceAfter: true },
  });

  return { ...transaction, applied: true };
}
