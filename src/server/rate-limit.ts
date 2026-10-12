import { db } from "./db";
import { AppError } from "./access";
export async function limit(userId: string, bucket: string, max = 60) {
  const minute = Math.floor(Date.now() / 60000),
    key = "app:" + bucket + ":" + userId + ":" + minute;
  const record = await db.rateLimit.upsert({
    where: { key },
    create: { id: key, key, count: 1, lastRequest: BigInt(Date.now()) },
    update: { count: { increment: 1 } },
  });
  if (record.count > max)
    throw new AppError(429, "Too many requests. Please retry in one minute.");
}
