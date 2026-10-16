"use client";
import { useState } from "react";
import {
  Compass,
  CalendarDays,
  TrendingUp,
  Wallet,
  Bell,
  Building2,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  Menu,
  X,
  CircleHelp,
} from "lucide-react";
import { NavLink } from "./nav-link";

export function AppNavigation({
  owner,
  admin,
}: {
  owner: boolean;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/app/discover", label: "Discover games", icon: Compass },
    { href: "/app/matches", label: "My matches", icon: CalendarDays },
    { href: "/app/progress", label: "Progress & rewards", icon: TrendingUp },
    { href: "/app/wallet", label: "TRUF Wallet", icon: Wallet },
    { href: "/app/payments", label: "Payment history", icon: Wallet },
    { href: "/app/notifications", label: "Notifications", icon: Bell },
    ...(owner
      ? [
          {
            href: "/app/owner",
            label: "Owner overview",
            icon: ChartNoAxesCombined,
          },
          {
            href: "/app/owner-bookings",
            label: "Venue bookings",
            icon: CalendarDays,
          },
          {
            href: "/app/venues",
            label: "Venues & availability",
            icon: Building2,
          },
          {
            href: "/app/payments?scope=owner",
            label: "Venue payments",
            icon: Wallet,
          },
        ]
      : []),
    ...(admin
      ? [
          {
            href: "/app/admin",
            label: "Admin overview",
            icon: ChartNoAxesCombined,
          },
          {
            href: "/app/moderation",
            label: "Approvals & audit",
            icon: ShieldCheck,
          },
          {
            href: "/app/payments?scope=admin",
            label: "All payments",
            icon: Wallet,
          },
          {
            href: "/app/wallet?scope=admin",
            label: "Wallet control",
            icon: Wallet,
          },
        ]
      : []),
    { href: "/app/settings", label: "Account & security", icon: Settings },
    { href: "/help", label: "Help & policies", icon: CircleHelp },
  ];
  return (
    <>
      <button
        className="mobile-menu"
        aria-expanded={open}
        aria-controls="app-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={18} /> : <Menu size={18} />}{" "}
        {open ? "Close menu" : "Menu"}
      </button>
      <nav
        id="app-navigation"
        aria-label="Main"
        className={open ? "app-nav is-open" : "app-nav"}
      >
        {links.map(({ href, label, icon: Icon }) => (
          <div key={href} onClick={() => setOpen(false)}>
            <NavLink href={href}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </div>
        ))}
      </nav>
    </>
  );
}
