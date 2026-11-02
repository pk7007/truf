export const DEMO_ORGANIZATION = "hosted-demo-20261015-org";
export const DEMO_ORGANIZATIONS = [
  DEMO_ORGANIZATION,
  "hosted-demo-20261015-month-v2-org-1",
  "hosted-demo-20261015-month-v2-org-2",
];
export function isDemoAdministrator(user: { id?: string; role: string }) {
  return user.id === "hosted-demo-20261015-admin" && user.role === "ADMIN";
}
