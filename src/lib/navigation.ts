/** Keep database-provided destinations inside this application. */
export function safeInternalHref(
  value: unknown,
  fallback = "/app/notifications",
) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }
  try {
    const url = new URL(value, "https://truf.invalid");
    return url.origin === "https://truf.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
