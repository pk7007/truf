import { notFound } from "next/navigation";
import { Account } from "@/components/account";
import { isPortal } from "@/lib/login-portals";
import { accountReadiness } from "@/server/readiness";
import { localMode } from "@/server/local-mode";
export default async function Page({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal } = await params;
  if (!isPortal(portal)) notFound();
  const ready = accountReadiness(process.env, localMode());
  return (
    <Account
      mode="login"
      portal={portal}
      unavailable={
        !ready.authentication
          ? "Account access is temporarily unavailable. Please try again later."
          : undefined
      }
    />
  );
}
