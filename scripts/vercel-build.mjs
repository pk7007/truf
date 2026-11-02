import { spawnSync } from "node:child_process";

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    console.error("Deployment step failed; existing deployment is preserved.");
    process.exit(result.status || 1);
  }
}

run("node_modules/prisma/build/index.js", ["generate"]);
// Production uses the project's managed database. Preview builds never mutate it.
// Only forward, versioned migrations run before compiling.
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
  run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
}
// Webpack is the documented Next.js fallback and avoids intermittent
// Turbopack child-process failures observed on Windows development machines.
run("node_modules/next/dist/bin/next", ["build", "--webpack"]);
// Authorized presentation release. Exact target only; audit marker makes this
// a one-time, transactional fixture operation. Preview builds never seed.
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.BETTER_AUTH_URL === "https://truf-red.vercel.app"
) {
  run("node_modules/tsx/dist/cli.mjs", ["scripts/demo-month-v2.ts", "--apply"]);
}
