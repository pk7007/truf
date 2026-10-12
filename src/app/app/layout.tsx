import { AppNavigation } from "@/components/app-navigation";
import { NavLink as Link } from "@/components/nav-link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/access";
import { db } from "@/server/db";
import { SignOut } from "@/components/account";
import { localMode } from "@/server/local-mode";
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
  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link href="/app/discover" className="brand">
          TRUF<span className="accent">.</span>
        </Link>
        <p className="muted">
          <small>Find your game</small>
        </p>
        <AppNavigation
          owner={owner > 0 || user.role === "ADMIN"}
          admin={user.role === "ADMIN"}
        />
      </aside>
      <main className="content" id="main-content">
        <header className="topbar">
          <span className="badge">PILOT · TEST PAYMENTS</span>
          <div className="row">
            <span>{user.name}</span>
            <SignOut />
          </div>
        </header>
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
