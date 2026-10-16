import { createCipheriv, publicEncrypt, randomBytes } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

// Explicit operator provisioning only. Never called by a public API.
export async function provisionDemo(
  db: PrismaClient,
  batchId: string,
  publicKey: string,
) {
  const marker = `${batchId}-created`;
  return db.$transaction(
    async (tx) => {
      const prior = await tx.auditLog.findUnique({ where: { id: marker } });
      if (prior) return prior.details;
      const credentials = [];
      for (const role of ["player", "owner", "admin"]) {
        const id = `${batchId}-${role}`;
        const email = `${role}@demo.truf.example`;
        const password = randomBytes(24).toString("base64url");
        const walletBalance =
          role === "player" ? 500000 : role === "owner" ? 1250000 : 0;
        // Create, not upsert: never promote or reset any pre-existing account.
        await tx.user.create({
          data: {
            id,
            email,
            name: `TRUF Demo ${role === "admin" ? "Administrator" : role === "owner" ? "Owner" : "Player"}`,
            role: role === "admin" ? "ADMIN" : "PLAYER",
            emailVerified: true,
            accounts: {
              create: {
                id: `${id}-credential`,
                accountId: id,
                providerId: "credential",
                password: await hashPassword(password),
              },
            },
            ...(walletBalance
              ? {
                  wallet: {
                    create: {
                      balancePaise: walletBalance,
                      entries: {
                        create: {
                          type: "TOP_UP",
                          amountPaise: walletBalance,
                          balanceAfterPaise: walletBalance,
                          referenceType: "DEMO",
                          referenceId: batchId,
                          description: "Demo opening balance · fictional funds",
                          idempotencyKey: `demo-opening:${id}`,
                        },
                      },
                    },
                  },
                }
              : {}),
          },
        });
        credentials.push({
          role,
          email,
          password,
          login: `https://truf-red.vercel.app/login/${role}`,
        });
      }
      await tx.organization.create({
        data: {
          id: `${batchId}-org`,
          name: "TRUF Demonstration Organization",
          status: "APPROVED",
          memberships: {
            create: { userId: `${batchId}-owner`, role: "OWNER" },
          },
        },
      });
      const key = randomBytes(32),
        iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(
          JSON.stringify({
            credentials,
            createdAt: new Date().toISOString(),
            adminMfaRequired: true,
          }),
        ),
        cipher.final(),
      ]);
      // Only encrypted delivery data reaches the build artifact or audit log.
      const envelope = {
        algorithm: "RSA-OAEP-SHA256+AES-256-GCM",
        key: publicEncrypt(
          { key: publicKey, oaepHash: "sha256" },
          key,
        ).toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: ciphertext.toString("base64"),
      };
      await tx.auditLog.create({
        data: {
          id: marker,
          actorId: "authorized-deployment-operator",
          action: "PROVISION_HOSTED_DEMO",
          targetId: batchId,
          details: envelope,
        },
      });
      return envelope;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    },
  );
}
