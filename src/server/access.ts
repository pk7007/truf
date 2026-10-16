import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";
import { DEMO_ORGANIZATION, isDemoAdministrator } from "@/lib/demo-access";
// Reporting only: never use this helper to authorize mutations.
export async function reportScope(user: {
  id: string;
  role: string;
  twoFactorEnabled: boolean;
}) {
  return isDemoAdministrator(user) ? [DEMO_ORGANIZATION] : ownerScope(user);
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const currentUser = cache(async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AppError(401, "Please sign in.");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });
  if (user.suspended || !user.emailVerified)
    throw new AppError(403, "Account access is unavailable.");
  return user;
});
export async function admin(user: {
  id: string;
  role: string;
  twoFactorEnabled: boolean;
}) {
  if (user.role !== "ADMIN" || !user.twoFactorEnabled)
    throw new AppError(
      403,
      "Administrator access with two-factor authentication is required.",
    );
}
export async function ownerScope(user: {
  id: string;
  role: string;
  twoFactorEnabled: boolean;
}) {
  if (user.role === "ADMIN") {
    await admin(user);
    return undefined;
  }
  const memberships = await db.membership.findMany({
    where: { userId: user.id, organization: { status: "APPROVED" } },
  });
  if (!memberships.length)
    throw new AppError(403, "Approved owner or staff access required.");
  return memberships.map((m) => m.organizationId);
}
export async function requireOrganization(
  user: { id: string; role: string; twoFactorEnabled: boolean },
  organizationId: string,
) {
  const ids = await ownerScope(user);
  if (ids && !ids.includes(organizationId))
    throw new AppError(404, "Resource not found.");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(process.env.BETTER_AUTH_URL || request.url).origin
  )
    throw new AppError(403, "Invalid request origin.");
}
