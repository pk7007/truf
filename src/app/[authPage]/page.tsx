import { notFound } from "next/navigation";
import { Account } from "@/components/account";
import { localMode } from "@/server/local-mode";
import { accountReadiness } from "@/server/readiness";
import { isPortal } from "@/lib/login-portals";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ authPage: string }>;
  searchParams: Promise<{ portal?: string }>;
}) {
  const { authPage } = await params;
  const query = await searchParams;
  if (
    ![
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "two-factor",
    ].includes(authPage)
  )
    notFound();
  const ready = accountReadiness(process.env, localMode());
  const needsEmail = ["register", "forgot-password"].includes(authPage);
  const unavailable = !ready.authentication
    ? "Account access is temporarily unavailable. Please try again later."
    : needsEmail && !ready.email
      ? "Email verification is temporarily unavailable. Please try again later."
      : undefined;
  return (
    <Account
      mode={authPage}
      portal={isPortal(query.portal) ? query.portal : undefined}
      localMail={localMode() && !process.env.RESEND_API_KEY}
      unavailable={unavailable}
    />
  );
}
