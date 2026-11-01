import { AppNavigation } from "@/components/app-navigation";
import { NavLink as Link } from "@/components/nav-link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/access";
import { db } from "@/server/db";
import { SignOut } from "@/components/account";
import { localMode } from "@/server/local-mode";
import { isDemoAdministrator } from "@/lib/demo-access";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: { default: "TRUF app", template: "%s · TRUF" },
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login");
  const owner = await db.membership.count({
    where: { userId: user.id, organization: { status: "APPROVED" } },
  });
  const appRole = user.role === "ADMIN" ? "ADMIN" : owner ? "OWNER" : "PLAYER";
  const homeHref =
    appRole === "ADMIN"
      ? "/app/admin"
      : appRole === "OWNER"
        ? "/app/owner"
        : "/app/discover";
  const workspaceLabel =
    appRole === "ADMIN"
      ? "Operate TRUF"
      : appRole === "OWNER"
        ? "Run your venues"
        : "Find your game";
  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link href={homeHref} className="brand">
          TRUF<span className="accent">.</span>
        </Link>
        <p className="muted">
          <small>{workspaceLabel}</small>
        </p>
        <AppNavigation role={appRole} />
      </aside>
      <main className="content" id="main-content">
        <header className="topbar">
          <span className="badge">PILOT · TEST PAYMENTS</span>
          <div className="row">
            <span>{user.name}</span>
            <SignOut />
          </div>
        </header>
        {isDemoAdministrator(user) && (
          <div className="demo-notice" role="note">
            Demo administrator · Read-only access to fictional demo records. No
            authenticator required for viewing.
          </div>
        )}
        {localMode() && (
          <div className="demo-notice" role="note">
            <strong>Sales demonstration</strong>
            <span>
              Fictional sample activity · No real collections or customer
              traction. Use the date filters to explore the latest week.
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
