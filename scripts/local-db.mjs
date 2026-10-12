import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
if (process.env.NODE_ENV === "production")
  throw Error("Local database is development-only");
mkdirSync(".data", { recursive: true });
const configPath = ".data/local.json";
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, "utf8"))
  : {
      password: randomBytes(24).toString("hex"),
      secret: randomBytes(32).toString("hex"),
    };
if (!existsSync(configPath))
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
const pg = new EmbeddedPostgres({
  databaseDir: resolve(".data/postgres"),
  user: "truf",
  password: config.password,
  port: 54329,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (error) => console.error(error),
});
if (!existsSync(".data/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const found = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='truf'",
);
await client.end();
if (!found.rowCount) await pg.createDatabase("truf");
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    'DATABASE_URL="postgresql://truf:' +
      config.password +
      '@127.0.0.1:54329/truf"\nBETTER_AUTH_SECRET="' +
      config.secret +
      '"\nBETTER_AUTH_URL="http://localhost:3000"\nSEED_PASSWORD="' +
      randomBytes(18).toString("base64url") +
      '"\n',
    { mode: 0o600 },
  );
console.log(
  "Development PostgreSQL ready on 127.0.0.1:54329. Local credentials are in ignored .env.",
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (process.platform === "win32") {
    execFileSync(
      resolve(
        "node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe",
      ),
      ["stop", "-D", resolve(".data/postgres"), "-m", "fast", "-w", "-t", "10"],
      { windowsHide: true, stdio: "inherit" },
    );
  } else await pg.stop();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);
process.on("message", async (message) => {
  if (message === "shutdown") {
    await shutdown();
  }
});
setInterval(() => {}, 60000);
