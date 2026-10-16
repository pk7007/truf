import Link from "next/link";
import { Users, Building2, ShieldCheck, ArrowRight } from "lucide-react";
import { portals } from "@/lib/login-portals";
export default function Login() {
  const icons = { player: Users, owner: Building2, admin: ShieldCheck };
  return (
    <main className="portal-picker">
      <Link href="/" className="brand">
        TRUF.
      </Link>
      <p className="tag">One community. Your space.</p>
      <h1>Welcome to TRUF</h1>
      <p className="muted">Choose where you want to sign in.</p>
      <div className="portal-grid">
        {Object.entries(portals).map(([key, portal]) => {
          const Icon = icons[key as keyof typeof icons];
          return (
            <Link
              className={`portal-card portal-${key}`}
              href={`/login/${key}`}
              key={key}
            >
              <Icon size={30} aria-hidden="true" />
              <h2>{portal.label}</h2>
              <p>{portal.description}</p>
              <span>
                Sign in <ArrowRight size={16} aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
      <p className="muted">
        New to TRUF? <Link href="/register">Create an account</Link>
      </p>
    </main>
  );
}
