import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { sendMail } from "./mail";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) =>
      sendMail(
        user.email,
        "Reset your TRUF password",
        `Use this link to reset your password: ${url}`,
      ),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) =>
      sendMail(
        user.email,
        "Verify your TRUF email",
        `Verify your email: ${url}`,
      ),
  },
  plugins: [twoFactor({ issuer: "TRUF" })],
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "PLAYER", input: false },
      suspended: { type: "boolean", defaultValue: false, input: false },
    },
  },
});
