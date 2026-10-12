# TRUF

Sports community, owner-approved match bookings and participation analytics.
TRUF Innovators: **PRAVEEN KESHAVAN** and **S EVANDLE BENNI**.

The repository now contains a Next.js application at the root. The original browser-local prototype remains in `prototype/`. No prototype data is imported into PostgreSQL.

## Run locally

**On this Windows computer:** run `./Start-TRUF.ps1` from PowerShell in this folder. It starts PostgreSQL, applies migrations, prepares development accounts, builds the app, and starts the web server and worker in the background. Wait for `.data/startup.log` to say `TRUF READY`, then open http://localhost:3000. Use `./Stop-TRUF.ps1` to stop the services before rebuilding.

Local sign-in details are in `.data/LOCAL-ACCESS.txt`. Local registration and recovery links are written to `.data/mail` when the launcher enables local mode; no external email is sent. This mailbox mode requires loopback database and application URLs. It does not enable fake payment success.

Use **Node.js 24 LTS** and Git. The earlier Node 20.15 installation is too old for this dependency set.

```sh
npm ci
npm run db:local
```

Leave the local PostgreSQL process running. It binds to 127.0.0.1:54329 and creates an ignored `.env` only if one does not already exist. In a second terminal:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. In a third terminal run `npm run worker` for deadlines, completion, reminders, refunds and reconciliation. Without this worker, time-based operations do not run.

For your own PostgreSQL server, copy `.env.example` to `.env`, configure DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL, and skip db:local. Use `npm run build` then `npm start` for a production build.

Development accounts: player@truf.local, owner@truf.local, other@truf.local and admin@truf.local. Their password is SEED_PASSWORD in your ignored .env. The admin must enroll MFA under Account & security before accessing administration. These are local fixtures, not shared/public demo credentials. The seed command refuses production and non-local databases.

## Implemented foundation

- Better Auth registration, verification/recovery email adapters and authenticator MFA; server-side sessions, suspension and organization permissions.
- Player discovery, public/private match requests, owner-approved holds, 60-minute slots, closures, offline reservations and staff membership.
- Test Razorpay order/checkout/verification/webhook integration. Serializable booking transitions, unique roster identities and PostgreSQL overlap constraints.
- Durable expiry, completion, reminder and refund jobs; retries, stale lease recovery and delayed-payment reconciliation.
- Attendance corrections with points ledger, non-cash badges and IST weekly streaks.
- Player, owner and admin charts with filters, accessible tables and CSV exports. Reports query PostgreSQL rather than localStorage.
- Optional AI filter adapter with explicit demo fallback; it cannot book, approve, join or move funds.
- CI configuration, Render web/database/worker blueprint, health endpoints and operational documentation.

This is a development implementation, **not a completed live-launch approval**. Provider, email, deployment and operational acceptance gates remain. Read [pilot readiness](docs/PILOT-READINESS.md) before inviting real users. Live payment keys are rejected in code. The Route adapter is disabled unless explicit test approval is configured; it does not establish a live settlement arrangement.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm audit
node scripts/smoke-local.mjs
node --test prototype/domain.test.cjs prototype/progress.test.cjs
```

Integration tests create a uniquely named temporary schema in a local/CI PostgreSQL database, migrate it, run concurrency/financial-rule tests and remove only that schema. Unit tests work without a database. Payment-provider calls are mocked in automated integration tests; real Razorpay staging tests are a separate release gate.

## Structure

| Location       | Responsibility                                                                         |
| -------------- | -------------------------------------------------------------------------------------- |
| src/app        | Pages, authenticated APIs, payment webhook, health                                     |
| src/components | Forms, navigation, match interfaces and charts                                         |
| src/server     | Authorization, booking transactions, attendance, analytics, provider adapters and jobs |
| src/lib        | Shared pure rules and browser auth client                                              |
| prisma         | Schema and versioned migrations                                                        |
| scripts        | Local database, fixtures, worker and integration runner                                |
| tests          | Business and database integration tests                                                |
| prototype      | Preserved standalone reference                                                         |

See [operations](docs/OPERATIONS.md) for monitoring, refund investigations, backups and administrator setup. See [pilot readiness](docs/PILOT-READINESS.md) for exactly when each external service is needed. Applying render.yaml can create paid infrastructure; no resources are purchased by this repository change.
