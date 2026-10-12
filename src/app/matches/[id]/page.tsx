import { MatchDetail } from "@/components/match";
import { currentUser } from "@/server/access";
import { redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await currentUser().catch(() => null))) redirect("/login");
  return <MatchDetail id={(await params).id} />;
}
