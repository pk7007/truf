export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runtimeEnv } = await import("./server/env");
    runtimeEnv();
  }
}
