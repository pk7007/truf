import { afterAll, describe, expect, test } from "vitest";
import {
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { provisionDemo } from "../scripts/provision-demo";
import { seedDemoMonth } from "../scripts/demo-month";
const suite = process.env.INTEGRATION_TEST === "1" ? describe : describe.skip;
suite("authorized hosted demo provisioning", () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  test("creates scoped users once, delivers encrypted credentials and preserves passwords on retry", async () => {
    const keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const result = (await provisionDemo(
      db,
      "test-hosted-demo",
      keys.publicKey,
    )) as Record<string, string>;
    const key = privateDecrypt(
      { key: keys.privateKey, oaepHash: "sha256" },
      Buffer.from(result.key, "base64"),
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(result.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(result.tag, "base64"));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(result.data, "base64")),
        decipher.final(),
      ]).toString(),
    );
    expect(payload.credentials).toHaveLength(3);
    for (const credential of payload.credentials) {
      const user = await db.user.findUniqueOrThrow({
        where: { email: credential.email },
        include: { accounts: true, memberships: true },
      });
      expect(
        await verifyPassword({
          password: credential.password,
          hash: user.accounts[0].password!,
        }),
      ).toBe(true);
      expect(user.role).toBe(credential.role === "admin" ? "ADMIN" : "PLAYER");
      expect(user.twoFactorEnabled).toBe(false);
      expect(user.memberships.length).toBe(credential.role === "owner" ? 1 : 0);
    }
    expect(await provisionDemo(db, "test-hosted-demo", keys.publicKey)).toEqual(
      result,
    );
    expect(
      await db.user.count({
        where: { id: { startsWith: "test-hosted-demo-" } },
      }),
    ).toBe(3);
    await expect(
      provisionDemo(db, "conflicting-demo", keys.publicKey),
    ).rejects.toThrow();
    expect(
      await db.user.count({
        where: { id: { startsWith: "conflicting-demo-" } },
      }),
    ).toBe(0);
    const date = new Date("2026-10-15T10:00:00Z");
    const month = await seedDemoMonth(db, "test-hosted-demo", date);
    expect(month).toMatchObject({
      completed: 15,
      upcoming: 3,
      points: 1500,
      hours: 15,
      from: "2026-09-16",
      to: "2026-10-14",
    });
    expect(await seedDemoMonth(db, "test-hosted-demo", date)).toEqual(month);
    const matches = await db.match.findMany({
      where: { id: { startsWith: "test-hosted-demo-month-v1" } },
      include: {
        participations: { include: { attendance: true, orders: true } },
        slot: true,
      },
    });
    expect(matches).toHaveLength(18);
    expect(matches.filter((m) => m.status === "COMPLETED")).toHaveLength(15);
    expect(
      matches
        .flatMap((m) => m.participations)
        .filter(
          (p) =>
            p.userId === "test-hosted-demo-player" &&
            p.attendance?.points === 100,
        ),
    ).toHaveLength(15);
    expect(
      matches.flatMap((m) => m.participations).flatMap((p) => p.orders),
    ).toHaveLength(0);
    expect(
      matches
        .filter((m) => m.status === "REQUESTED")
        .every((m) => m.slot.startsAt > date && m.participations.length === 0),
    ).toBe(true);
  });
});
