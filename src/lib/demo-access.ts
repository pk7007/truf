export const DEMO_ORGANIZATION = "hosted-demo-20261015-org";
export function isDemoAdministrator(user: { id?: string; role: string }) {
  return user.id === "hosted-demo-20261015-admin" && user.role === "ADMIN";
}
