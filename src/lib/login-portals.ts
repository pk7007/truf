export const portals = {
  player: {
    title: "Player sign in",
    description:
      "Find your next game, connect with players, and track your progress.",
    label: "Player",
  },
  owner: {
    title: "Turf owner sign in",
    description:
      "Manage your venues, review bookings, and understand your business.",
    label: "Turf owner",
  },
  admin: {
    title: "Administrator sign in",
    description:
      "Oversee the community, review approvals, and manage platform operations.",
    label: "Administrator",
  },
} as const;
export type Portal = keyof typeof portals;
export function isPortal(value: unknown): value is Portal {
  return value === "player" || value === "owner" || value === "admin";
}
export function portalDestination(
  portal: Portal | undefined,
  user: { role: string; twoFactorEnabled: boolean },
  approvedOwner: boolean,
) {
  const selected =
    portal ||
    (user.role === "ADMIN" ? "admin" : approvedOwner ? "owner" : "player");
  if (selected === "admin")
    return user.role !== "ADMIN"
      ? null
      : user.twoFactorEnabled
        ? "/app/admin"
        : "/app/settings";
  if (selected === "owner") return approvedOwner ? "/app/owner" : null;
  return "/app/discover";
}
