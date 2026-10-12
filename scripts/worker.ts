import "dotenv/config";
import { runOneJob, reconcile } from "../src/server/worker";
import { db } from "../src/server/db";
async function main() {
  let stopping = false;
  process.on("message", (message) => {
    if (message === "shutdown") stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await Promise.all([
    (async () => {
      while (!stopping) {
        try {
          if (!(await runOneJob())) await wait(2000);
        } catch (e) {
          console.error(
            "Worker operation failed:",
            e instanceof Error ? e.message : "unknown",
          );
          await wait(5000);
        }
      }
    })(),
    (async () => {
      while (!stopping) {
        try {
          await reconcile();
        } catch (e) {
          console.error(
            "Reconciliation failed:",
            e instanceof Error ? e.message : "unknown",
          );
        }
        for (let i = 0; i < 30 && !stopping; i++) await wait(2000);
      }
    })(),
  ]);
  await db.$disconnect();
}
main().catch(() => (process.exitCode = 1));
