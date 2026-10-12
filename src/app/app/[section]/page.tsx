import { notFound } from "next/navigation";
import { Reports } from "@/components/reports";
import { Records } from "@/components/records";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (["progress", "owner", "admin"].includes(section))
    return (
      <Reports
        view={
          section === "progress" ? "player" : (section as "owner" | "admin")
        }
      />
    );
  if (
    ![
      "discover",
      "matches",
      "payments",
      "notifications",
      "venues",
      "owner-bookings",
      "moderation",
      "settings",
    ].includes(section)
  )
    notFound();
  return <Records view={section} />;
}
