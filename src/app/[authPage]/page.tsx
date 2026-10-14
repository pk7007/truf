import { notFound } from "next/navigation";
import { Account } from "@/components/account";
import { localMode } from "@/server/local-mode";
import { accountReadiness } from "@/server/readiness";
export default async function Page({
  params,
}: {
  params: Promise<{ authPage: string }>;
}) {
  const { authPage } = await params;
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
      localMail={localMode() && !process.env.RESEND_API_KEY}
      unavailable={unavailable}
    />
  );
}
