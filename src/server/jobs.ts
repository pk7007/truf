import { Prisma } from "@prisma/client";
export async function enqueue(
  tx: Prisma.TransactionClient,
  key: string,
  kind: string,
  payload: Prisma.InputJsonValue,
  runAt = new Date(),
) {
  return tx.job.upsert({
    where: { key },
    create: { key, kind, payload, runAt },
    update: {},
  });
}
export async function notify(
  tx: Prisma.TransactionClient,
  userId: string,
  title: string,
  body: string,
  href: string,
) {
  await tx.notification.create({ data: { userId, title, body, href } });
}
