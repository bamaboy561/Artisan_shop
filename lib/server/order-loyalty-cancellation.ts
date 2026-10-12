import { LoyaltyTransactionStatus, type Prisma } from "@/generated/prisma";

export type OrderLoyaltyCancellationResult = {
  number: string | null;
  balanceDelta: number;
  lifetimeDelta: number;
  transactionsCount: number;
};

export async function cancelOrderLoyaltyTransactions(
  tx: Prisma.TransactionClient,
  orderId: string,
  canceledById: string | null = null,
): Promise<OrderLoyaltyCancellationResult | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      number: true,
      loyaltyTransactions: {
        where: {
          status: {
            in: [
              LoyaltyTransactionStatus.APPROVED,
              LoyaltyTransactionStatus.PENDING,
            ],
          },
        },
        select: {
          id: true,
          status: true,
          points: true,
        },
      },
    },
  });

  if (!order || order.loyaltyTransactions.length === 0) {
    return null;
  }

  const now = new Date();
  const canceledTransactions: typeof order.loyaltyTransactions = [];

  // Claim every transaction conditionally so parallel cancellation requests
  // can never apply the same balance reversal twice.
  for (const transaction of order.loyaltyTransactions) {
    const claimed = await tx.loyaltyTransaction.updateMany({
      where: {
        id: transaction.id,
        status: transaction.status,
      },
      data: {
        status: LoyaltyTransactionStatus.CANCELED,
        canceledAt: now,
        canceledById,
      },
    });

    if (claimed.count > 0) {
      canceledTransactions.push(transaction);
    }
  }

  if (canceledTransactions.length === 0) {
    return null;
  }

  const approvedTransactions = canceledTransactions.filter(
    (transaction) => transaction.status === LoyaltyTransactionStatus.APPROVED,
  );
  const balanceDelta = approvedTransactions.reduce(
    (sum, transaction) => sum + transaction.points,
    0,
  );
  const lifetimeDelta = approvedTransactions.reduce(
    (sum, transaction) =>
      transaction.points > 0 ? sum + transaction.points : sum,
    0,
  );

  if (order.userId && approvedTransactions.length > 0) {
    await tx.user.update({
      where: { id: order.userId },
      data: {
        loyaltyPointsBalance: { increment: -balanceDelta },
        loyaltyPointsLifetime: { increment: -lifetimeDelta },
      },
    });
  }

  return {
    number: order.number,
    balanceDelta,
    lifetimeDelta,
    transactionsCount: canceledTransactions.length,
  };
}
