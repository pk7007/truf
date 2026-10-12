import { notFound } from "next/navigation";
import { Account } from "@/components/account";
import { localMode } from "@/server/local-mode";
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
  return (
    <Account
      mode={authPage}
      localMail={localMode() && !process.env.RESEND_API_KEY}
    />
  );
}
