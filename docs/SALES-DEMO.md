# TRUF sales demonstration

Use the actual Next.js application at the repository root. `prototype/` and the public `truf-preview` deployment remain the earlier browser-only prototype; they are not the full application's backend.

## One week of operating activity

Start the local app with `Start-TRUF.ps1`. Its guarded seed adds the previous seven complete IST days: 42 matches across two organizations and three sports, full payment rosters, processed refunds for cancellations, attendance, no-shows, unknown attendance, points entries, and spare published slots. Three upcoming badminton requests demonstrate owner approval using normal application flows.

Dates roll forward on the next seed/startup. Existing demo records are preserved, so repeated startup does not reset decisions, duplicate payments, or undo attendance corrections. This is a rolling fixture, not a promise that live services have operated for a week. Choose custom dates from seven days ago through yesterday to reconcile the week exactly. Historical examples and new manual actions can also appear in wider report ranges.

Run `npx tsx scripts/verify-demo-week.ts` against the local development database after seeding to verify roster totals, captured/refunded amounts and seed idempotency. This checks pristine fixtures; deliberate edits to those records may require a separate fresh development database for repeatable verification.

## Presentation sequence

1. Player: discover an upcoming match, open details, explain the owner-approved deadline and individual checkout.
2. Owner: approve a request, inspect date/venue filters, compare collections and refunds, and explain utilization against published capacity.
3. Owner: show attended/no-show/unknown states and how recording attendance affects player progress.
4. Player: show the activity calendar, weekly playing duration, sport preferences and non-cash milestones.
5. Admin: use an enrolled MFA account to show cross-venue reporting and approvals. Never bypass MFA for the presentation.

All demo figures are fictional. There are no real captures, refunds, settlements, customers, or revenue claims. Fictional users have no credential accounts. Seed commands refuse hosted databases and production mode. Do not import these figures into the live database or describe them as commercial traction.

## Commercial release boundary

This is a demonstrable pilot, not a certified commercial release. Provider checkout and webhook verification with actual test credentials, production authentication/email, worker hosting, backup restoration, settlement integration, venue photo storage and operational monitoring remain release gates in `PILOT-READINESS.md`. The public prototype is independent of the full application's hosted database.
