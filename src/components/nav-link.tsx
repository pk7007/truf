"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [path, query] = href.split("?");
  const expectedScope = new URLSearchParams(query).get("scope");
  const active =
    pathname === path &&
    (path !== "/app/payments" || params.get("scope") === expectedScope);
  return (
    <Link
      href={href}
      className={className}
      aria-current={active && !className ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
