# TRUF

A sports community application for discovering players, forming committed teams, and coordinating turf bookings.

## Team

TRUF Innovators: PRAVEEN KESHAVAN and S EVANDLE BENNI.

## Repository status

An interactive browser prototype is available in `prototype/`. The production application is not implemented yet.

## Run the prototype

From this repository folder, run:

```sh
node prototype/server.cjs
```

Open http://127.0.0.1:4173 in your browser. No dependency installation is required. Alternatively, open `prototype/index.html` directly; browser storage behaviour for local files can vary.

Use the role selector to switch between Player, Owner, and Admin views. Try completing the badminton roster, creating a match, adding an owner slot, reviewing an owner application, and withdrawing for a demo refund. My profile includes a reset action.

This prototype uses fictional seed data and browser localStorage. Payment success/failure and refunds are explicitly simulated, not Razorpay test API calls. There is no authentication, server-side authorization, shared database, AI integration, background server scheduler, or real booking/settlement service. The role selector is for demonstration only. Do not use this prototype for actual bookings or financial transactions.

## Prototype improvements

- Admin and owner booking metrics: venue and match-date filters; created, confirmed/completed, cancelled/expired counts; recorded gross payments, refunds, and net collections; sport breakdown. Money is based on actual local payment records, not seeded roster commitments. The owner venue selector is a demo filter, not tenant authorization.
- Player progress at `#progress`: attended-game history, sport filters, an eight-week activity strip, current/best weekly streaks, and 100 demo points per attended one-hour game. Weeks run Monday–Sunday in IST; the previous week's streak remains active until the current week ends.
- Owner attendance recording is available for completed games that the demo player actually joined. One attendance per game; payments alone do not earn progress. Demo badges unlock at the first game, three consecutive weeks, and five games, and can be collected once. Badges have no cash value.
- A clearly labelled sample-progress toggle previews three fictional games without saving attendance or allowing reward claims.

Run all rules tests with `node --test prototype/domain.test.cjs prototype/progress.test.cjs`. The reporting tests cover deduplication, streak gaps, future-date exclusion, venue/date filters, attendance eligibility, and idempotent reward collection.

- Distinct player, owner, and admin payment/discovery URLs preserve navigation context across reloads and browser history.
- Booking-table names open match details; receipts link to matches; match details link back to payment history.
- Match history retains withdrawals and cancellations. Hosts can edit match names while prices and times stay fixed.
- Search includes sorting, open-place filtering, result counts, and a clear-filters empty state.
- Validation rejects blank names, odd team sizes, unsupported badminton formats, incompatible sport/slot selections, and overlapping slots or joined games.
- Cancellation clears player reservations and refunds local payment records. Duplicate joins and withdrawals are rejected.
- Joining closes one hour before start (IST). Incomplete games expire and demo payments are refunded on page activity or the 30-second check while visible. Nothing runs when the app is closed; reopening reconciles deadlines.
- Existing valid sample data is migrated in memory; another tab's storage changes update the view. This does not provide atomic multi-user concurrency.
- Dialog labels, focus restoration, skip navigation, mobile sizing, and storage-error feedback improve usability.

Run the regression suite with `node --test prototype/domain.test.cjs`. `domain.js` contains the tested rules; the standalone HTML embeds the same source, and a regression test checks they match.

## Prototype verification

Initial browser checks completed: last-player join confirms a match; simulated payment failure is recoverable; withdrawal marks the demo payment refunded; match creation appears in the owner panel and reserves its slot; adding an owner slot works; owner approval persists across reload.

Enhancement verification: 12 automated regression tests cover validation, reservation reuse, duplicate joins, refunds, cancellations, deadlines, completion, overlapping slots/games, time formatting, and embedded-source consistency. Browser checks cover receipt-to-match navigation, owner payment reloads, admin Back/Forward navigation, sport-dependent slot choices, blank-profile validation, search empty states, retained withdrawal history, and a 390-pixel mobile layout without page-level horizontal overflow. These are prototype checks, not production integration or security verification.

## Planned application

- Player panel: sports profiles, match discovery, match creation, participation, payments, and refunds.
- Owner panel: venues, playing areas, availability, bookings, staff access, and financial reports.
- Admin panel: owner approval, account moderation, booking investigations, payment oversight, and audit history.
- Shared PostgreSQL database and server-enforced permissions.
- Razorpay API integration for orders, verified payments, webhooks, and refunds.
- AI-assisted match search with a clearly labelled demo mode when credentials are unavailable.

## Planned stack

Next.js App Router, TypeScript, Tailwind CSS, accessible UI components, PostgreSQL, Prisma, Better Auth, and Zod. Compatible versions will be verified and pinned during implementation.

## Implementation milestones

1. Scaffold the application and design system.
2. Implement database migrations, authentication, and access controls.
3. Build player, owner, and admin workflows.
4. Integrate payment test APIs and booking concurrency safeguards.
5. Implement deadlines, reminders, substitutes, and AI search.
6. Test, document, and prepare staging and production deployment.

## Local preparation

Install a supported Node.js LTS release and Git. Configure a PostgreSQL development database when database implementation starts. Project installation and startup commands will be added when the application is scaffolded.

## Credentials

`.env.example` contains safe placeholders. Local environment files are ignored by Git. Never commit real credentials, payment secrets, production data, or personal data. Use separate development, staging, and production environments.

## Collaboration

Use feature branches and pull requests. Commit and push after tested milestones. Keep `main` usable and document any unverified external integrations.
