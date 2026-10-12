import { z } from "zod";
export function runtimeEnv() {
  return z
    .object({
      DATABASE_URL: z.string().min(1),
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url(),
    })
    .parse(process.env);
}
export function assertTestPayments() {
  if (!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"))
    throw new Error("PAYMENTS_NOT_CONFIGURED");
  if (!process.env.RAZORPAY_KEY_SECRET)
    throw new Error("PAYMENTS_NOT_CONFIGURED");
}
