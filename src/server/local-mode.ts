export function localMode() {
  try {
    return (
      process.env.TRUF_LOCAL_MODE === "true" &&
      ["localhost", "127.0.0.1"].includes(
        new URL(process.env.BETTER_AUTH_URL!).hostname,
      ) &&
      ["localhost", "127.0.0.1"].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      )
    );
  } catch {
    return false;
  }
}
