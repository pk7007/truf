import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
if (Number(process.versions.node.split(".")[0]) < 24)
  throw Error("Use Node.js 24 LTS.");
mkdirSync(".data", { recursive: true });
const children = [];
let stopping = false;
function start(args, env = process.env) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    windowsHide: true,
  });
  children.push(child);
  writeFileSync(
    ".data/local-processes.json",
    JSON.stringify({
      root: process.cwd(),
      supervisor: process.pid,
      children: children.map((c) => c.pid),
    }),
  );
  return child;
}
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function waitPort(port) {
  for (let i = 0; i < 90; i++) {
    if (await portOpen(port)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("Service did not start on port " + port);
}
function run(args) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  if (result.status !== 0) throw Error("Setup command failed: " + args[0]);
}
async function main() {
  if (await portOpen(3000)) {
    console.log(
      "Port 3000 is already in use. If TRUF is running, open http://localhost:3000. Use Stop-TRUF.ps1 before rebuilding.",
    );
    return;
  }
  if (existsSync(".data/stop-request")) unlinkSync(".data/stop-request");
  if (!(await portOpen(54329))) {
    start(["scripts/local-db.mjs"]);
    await waitPort(54329);
  }
  config();
  process.env.TRUF_LOCAL_MODE = "true";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  writeFileSync(
    ".data/LOCAL-ACCESS.txt",
    "TRUF local development only\nhttp://localhost:3000\n\nPlayer: player@truf.local\nOwner: owner@truf.local\nSecond owner: other@truf.local\nAdmin: admin@truf.local\n\nFixture password: " +
      process.env.SEED_PASSWORD +
      "\n\nAdmin requires authenticator setup under Account & security.\nVerification and recovery links: .data/mail\nRazorpay checkout needs your test API keys.\n",
    { mode: 0o600 },
  );
  if (!existsSync(".env")) throw Error("Local database did not create .env.");
  run(["node_modules/prisma/build/index.js", "generate"]);
  run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"]);
  run(["node_modules/next/dist/bin/next", "build"]);
  const web = start([
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
  ]);
  await waitPort(3000);
  start(["node_modules/tsx/dist/cli.mjs", "scripts/worker.ts"]);
  console.log(
    "TRUF READY: http://localhost:3000 · email links are saved in .data/mail · Razorpay requires test credentials.",
  );
  web.on("exit", () => {
    if (!stopping) {
      console.error("Web server stopped.");
      shutdown();
    }
  });
  setInterval(() => {
    if (existsSync(".data/stop-request") && !stopping) shutdown();
  }, 1000);
}
async function shutdown() {
  stopping = true;
  for (const child of [...children].reverse()) {
    if (child.connected) child.send("shutdown");
    if (child.spawnargs.some((a) => a.includes("next/dist/bin/next")))
      child.kill();
  }
  for (
    let attempt = 0;
    attempt < 24 && children.some((child) => child.exitCode === null);
    attempt++
  ) {
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch((error) => {
  console.error(error.message);
  for (const child of children) child.kill();
  process.exitCode = 1;
});
