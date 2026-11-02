# TRUF presentation dataset — November 2026

This is fictional demonstration activity, not commercial revenue. The existing
login credentials, real customer records, and older fixtures are preserved.

## Audit and changes

- P1: Wallet debits/refunds were omitted from payment history. History now joins
  authorized participation records to ledger entries, pairs each refund with its
  debit cycle, and preserves legacy fictional history without duplicate matches.
- P1: Default reports had sparse recent data and zero provider-only financial
  graphs. A separate wallet chart and summary now report bookings, refunds, and
  settlements without counting wallet funding as revenue.
- P1: Admin chart links led to an owner-only page. `/app/admin-bookings` now uses
  the same permitted organization scope as admin reports.
- P2: Wallet CSV text could be interpreted as a spreadsheet formula. Leading
  formula characters are now escaped.
- P2: Existing demo users and a single organization did not illustrate multi-owner
  reporting. The demo admin is restricted to three explicit fictional organizations.

## Dataset

Batch: `hosted-demo-20261015-month-v2`. Default reference date: 2026-11-02.
Historical window: October 4–November 2, 2026 (IST). Future games: November 3–7.

- 60 historical matches: 48 completed, 6 cancelled, 6 expired.
- 9 upcoming matches: 3 requested, 3 recruiting, 3 confirmed.
- 6 new venues across 3 organizations; 18 playing areas.
- 24 players including the existing demo player; two additional fictional owners
  have no login credentials. Existing demo owner retains only its original organization.
- 196 attended participations, with additional no-shows and unmarked attendance.
- Six unreserved slots for new requests, on November 8.
- No provider records, notification deliveries, or background jobs are seeded.

| New-batch ledger measure | Amount |
|---|---:|
| Fictional opening wallet credits | ₹480,000 |
| Booking debits, including upcoming matches | ₹62,400 |
| Refund credits | ₹8,600 |
| Net booking spending | ₹53,800 |
| Completed-game owner settlements | ₹49,600 |
| Net amount awaiting game completion | ₹4,200 |
| Actual provider collections | ₹0 |

These are batch totals, not whole-database totals. Existing presentation activity
can contribute to overlapping date ranges. Old offline demo history remains
explicitly fictional and is not converted into provider collections. The old
aggregate owner credit is preserved, but does not masquerade as a match-linked
settlement in the new chart.

## Safe operator commands

With the intended DATABASE_URL supplied securely:

```powershell
npx tsx scripts/demo-month-v2.ts
npx tsx scripts/demo-month-v2.ts --apply
```

The default is a dry run. `DEMO_REFERENCE_DATE=YYYY-MM-DD` selects the reference
date before first application. An existing batch is returned unchanged, even if
a different date is later supplied. There is deliberately no destructive reset.
Refreshing requires a reviewed new batch and corresponding scope updates; do not
delete the audit marker or shift bookings that users have already demonstrated.

The transaction verifies existing demo identities, creates the dataset atomically,
reconciles wallet balances, and records an audit summary. It rolls back on failure.
Historical insertion recomputes running balances only for the affected demo wallets.

For this authorized release, Vercel runs the idempotent seed after a successful
production build, only when BETTER_AUTH_URL exactly identifies truf-red.vercel.app.
Preview deployments never seed. Remove that release hook after live verification;
the standalone operator script remains available.

## Presentation walkthrough

1. Player: open Discover, inspect a requested game, then open an approved recruiting
   game and use Confirm & pay. Show My matches, wallet debit, and payment history.
2. Owner: open Match requests, approve a request with a deadline at least one hour
   before play, then show venue availability, the roster, and the last-30-days report.
3. Player: withdraw before confirmation and show the refund and restored balance.
4. Admin: show demo organizations, users, wallet charts, and booking drill-downs.
   The demo administrator remains read-only.
5. Export a filtered chart as Excel/CSV and compare it with the accessible data table.

## Verification boundaries

Automated tests exercise fixture idempotence, wallet balances, chart reconciliation,
owner scope, approval/payment/refund flow, and existing booking concurrency rules.
Browser/mobile visual verification and production seed execution must be reported
separately; passing local tests is not evidence that those steps have completed.
The dataset is not a claim of production readiness. General report queries still
load broad scoped histories and need pagination/aggregation before commercial scale.
