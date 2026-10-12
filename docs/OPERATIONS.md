# TRUF operations

## Startup

Run `npm run db:migrate` once per release before starting web and worker services. Run `npm start` and `npm run worker` as separate supervised processes. Use one shared database and identical test payment credentials. The worker locks jobs with `FOR UPDATE SKIP LOCKED`; a ten-minute stale lease is recoverable after a crash. Failures back off and become FAILED after twelve attempts.

## Health and alerts

`GET /api/health` checks database connectivity. `GET /api/ops` requires `Authorization: Bearer <OPS_TOKEN>` and reports failed/stale jobs, overdue refunds, unresolved orders and stale worker heartbeat. Connect an external monitor to both endpoints and test that an actual alert reaches the responsible operator. Never put OPS_TOKEN in a URL. Admin approvals/operations shows jobs and audit history.

## Refunds and transfers

Refunds are upserted once per captured payment. A worker persists SUBMITTING before contacting the provider. On retry it first looks for the matching `truf_refund` note. If a request outcome is unknown and no provider record is visible, it stops automatic resubmission and escalates via the job failure/ops endpoint. Investigate the provider dashboard, amount and receipt before any operator correction. A refund is completed only when provider status is `processed`.

Orders with uncertain creation outcomes are reconciled by their internal receipt. Captures are deduplicated by provider payment ID. A late capture cannot reopen a match. A separate reconciliation loop prevents a slow provider request from blocking deadline jobs.

The Route adapter checks completed matches, paid participation, linked account, pending refunds and explicit test approval. It keeps transfer processing separate from settlement completion; a processed transfer is not automatically a settled transfer. Do not mark settlements manually merely to make a dashboard look complete.

## Backup and restore drill

Use managed PostgreSQL automatic backups and point-in-time recovery when available. Also test a logical restore into a separate database:

```sh
pg_dump --format=custom --no-owner --file=truf-backup.dump "$DATABASE_URL"
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" truf-backup.dump
```

Keep credentials out of shell history; prefer a protected service environment or `.pgpass`. RESTORE_DATABASE_URL must name a new isolated database, never the running database. Compare table counts, verify foreign keys, run a read-only booking/payment report and document restore duration, backup timestamp and operator. Do not claim a production restore test from an empty or fixture-only database.

## Pilot support

An owner can correct attendance after completion. Corrections append audit/points entries, and affected badges are recalculated. Unknown attendance remains unknown. Never infer attendance from a payment.

To grant an initial administrator role from a trusted operator terminal: `npm run admin:promote -- verified-email`. The user then enrolls an authenticator under Account & security. No public API can assign the admin role. Store recovery codes securely.

## Data and metrics

Amounts are integer paise; charts display INR. UTC timestamps are interpreted in Asia/Kolkata. Bookings use creation/confirmation dates, payments use recorded capture dates, refunds use confirmed processing dates and attendance uses scheduled game dates. Player progress uses verified attendance. Points have no monetary value. Capacity heatmaps exclude closed slots and count reserved confirmed/completed minutes.

Development fixtures are labelled and never imported from prototype localStorage. Never run the seed command against a real pilot database. Do not log credentials, webhook payloads or participant payment details.
