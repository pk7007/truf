# TRUF Wallet audit and product specification

Audited 17 October 2026. This document covers the web wallet used by players, approved turf owners, and administrators. It describes a test-only pilot workflow; it is not approval to hold or transfer live customer funds.

## Executive summary

TRUF Wallet is a closed-loop INR booking balance. Players can add test funds, pay match shares, and receive eligible refunds. Completed wallet-funded games credit approved owners with settlement earnings. Owners may reserve eligible earnings in a withdrawal request; administrators can approve or reject the request, but approval does not send money without KYC and an approved payout provider.

The audit corrected debit presentation for withdrawal holds, corrected aggregate admin totals, added transaction search and CSV export, added owner balance breakdowns, improved validation and table accessibility, required a rejection reason, and added durable audit records for withdrawal decisions.

## Current flows and dependencies

| Role           | Entry point                     | Supported actions                                                                                | Server authorization                                                                                  |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Player         | Main navigation → TRUF Wallet   | View balance and ledger, create a test top-up, spend on eligible matches, receive wallet refunds | Authenticated user; payment capture validates provider order, amount, currency, status, and signature |
| Approved owner | Main navigation → TRUF Wallet   | Player actions plus view settlement earnings, request and cancel withdrawals                     | Active OWNER membership in an approved organization                                                   |
| Administrator  | Administration → Wallet control | View scoped wallets and withdrawal queue, approve or reject requests                             | ADMIN role with MFA; hosted demo administrator is read-only and isolated to demo records              |

The frontend uses `records.tsx`. `/api/data?view=wallet` returns role-scoped wallet data. `/api/actions` handles top-ups and withdrawal actions. Razorpay test checkout and verified webhooks capture top-ups. PostgreSQL stores immutable ledger entries, top-up attempts, withdrawals, notifications, and audit logs. The worker reconciles delayed provider events and credits owner settlements after completion.

## Intended behavior

### Goals

- Make match payment and refund state understandable without WhatsApp or manual reconciliation.
- Prevent duplicate balance movements through unique idempotency keys and serializable transactions.
- Keep player booking funds separate from owner settlement eligibility.
- Give operators a traceable approval queue while real payouts remain disabled.

### Non-goals for the pilot

- TRUF Wallet is not a bank account, general-purpose payment account, transferable balance, or stored-value product offered for cash withdrawal.
- Players cannot withdraw top-ups.
- Administrator approval does not represent a completed bank or UPI transfer.
- Live payment credentials, automatic owner payouts, cross-currency balances, and cash rewards are outside the pilot.

### Core acceptance criteria

1. Every posted entry has one direction, amount, resulting balance, reference, and idempotency key.
2. Money added, refunds, settlement earnings, releases, and positive adjustments display as credits. Match payments and withdrawal holds display as debits.
3. Wallet payment cannot create a negative balance or overfill a match.
4. A refund posts once and returns exactly the related wallet debit.
5. Only approved owners can request withdrawal of completed-game earnings.
6. Withdrawal requests accept ₹500–₹50,000 and cannot exceed eligible earnings.
7. A request reserves funds atomically. Owner cancellation or administrator rejection returns them once.
8. Rejection requires a human-readable reason. Request, cancellation, approval, and rejection are auditable.
9. Admin data remains scoped; demo administration remains read-only.
10. Loading, empty, filtered-empty, success, unavailable-provider, and error states are explicit.
11. Tables expose captions and column headers; forms have labels; status updates use live regions; controls remain keyboard operable.
12. Dates display in IST, money is stored as integer paise, and exports state INR and IST explicitly.

## Competitor comparison

Facts below come from each product's official site or published policy. App-only interaction details that could not be verified on the public web are left unspecified.

| Capability            | TRUF                                                              | Hudle                                                                      | Playo                                                                                            | Turf Town                                                              | Gap                                                                  | Recommended action                                                                                      |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Booking balance       | Closed-loop booking balance with auditable entries                | Terms define an e-wallet/prepaid instrument                                | Offers prepaid credit packages to venue businesses                                               | Public terms describe booking payments; wallet capability not verified | TRUF needs provider/legal validation before live use                 | Keep test-only gate and obtain written provider/legal approval                                          |
| Refund disclosure     | Rule is documented; wallet refunds post immediately when eligible | Venue-specific policies and handling charges; some cases use venue credits | Shows applicable policy and refund amount before cancellation; source refund in 5–7 working days | Policy is shown before booking; eligible refunds in 5–7 business days  | TRUF does not yet show a calculated refund preview before withdrawal | Add policy and expected refund outcome to match withdrawal confirmation                                 |
| Rescheduling          | Deferred                                                          | Venue policies may permit one amendment                                    | Supported when venue permits, including price difference handling                                | Not verified from public policy                                        | Missing flexibility can force cancellations                          | Add owner-controlled rescheduling after pilot payment hardening                                         |
| Owner reporting       | Admin/owner charts and CSV/Excel reporting; wallet CSV            | Public page emphasizes venue booking; reporting details not verified       | Downloadable transaction reports and graphs advertised                                           | Not verified                                                           | Wallet export previously missing                                     | Added filtered wallet CSV; keep report totals reconciled                                                |
| Split/group payment   | Each participant pays a disclosed share                           | Split-payment refund rules are documented                                  | Participant payment status is advertised for events                                              | Spots in games are covered by booking policy                           | TRUF's team-funded confirmation is a differentiator                  | Preserve per-participant ledger references and clear deadlines                                          |
| Withdrawal operations | Reviewed owner settlement requests; no live transfer              | Public owner payout workflow not verified                                  | Public owner payout workflow not verified                                                        | Public owner payout workflow not verified                              | TRUF lacks KYC destination records and provider payout lifecycle     | Block live payouts until verified payout accounts, webhooks, reconciliation, and failure recovery exist |

Official references: [Hudle terms](https://hudle.in/terms-and-conditions), [Hudle refunds policy](https://www.hudle.in/return-and-refunds-policy), [Playo cancellation policy](https://playo.co/cancellation-refund), [Playo business features](https://playo.co/list-business), [Turf Town terms](https://www.turftown.in/terms-of-service).

## Prioritized gap analysis

| Priority | Area                 | Evidence and impact                                                                                                                           | Resolution or next action                                                                                                                                  |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Live-money readiness | No payout KYC destination, connected payout provider, or production reconciliation. A failed payout state has no implemented recovery action. | Live money remains blocked. Add provider-approved account onboarding, payout IDs, webhooks, retry/release rules, alerts, and reconciliation before launch. |
| P1       | Financial accuracy   | `WITHDRAWAL_HOLD` was shown and aggregated as a credit. Users and admins could misread cash movement.                                         | Fixed with a shared direction classifier used by API totals, UI signs, styling, export, and tests.                                                         |
| P1       | Auditability         | Withdrawal request/cancel/review actions were not written to `AuditLog`; rejection could omit a reason.                                       | Added audit records and required a rejection reason on server and UI.                                                                                      |
| P1       | Policy clarity       | Footer said no wallet funds could be withdrawn while the same page offered owner withdrawals.                                                 | Clarified that player top-ups are non-withdrawable and only owner settlement earnings enter the reviewed workflow.                                         |
| P2       | Reconciliation UX    | Ledger had no filter or export and exposed internal enum labels.                                                                              | Added search, type filter, readable labels, result count, and filtered CSV export.                                                                         |
| P2       | Owner comprehension  | One balance mixed spendable balance with withdrawable settlement earnings.                                                                    | Added separate spendable, withdrawable, and in-progress summary cards.                                                                                     |
| P2       | Accessibility        | Financial tables lacked captions and explicit header scopes.                                                                                  | Added accessible captions, column scopes, live result counts, labelled controls, and debit/credit screen-reader text.                                      |
| P2       | Refund preview       | Match cancellation does not yet show the exact expected destination and timing before confirmation.                                           | Add a server-computed cancellation quote to the match flow. Does not block the test-only demo.                                                             |
| P3       | Large histories      | The UI intentionally returns the latest 100 ledger entries without pagination.                                                                | Add cursor pagination and server-generated full-range export when real transaction volume requires it.                                                     |

## State and recovery map

- **First use/empty:** zero balance, disabled payment path when provider keys are absent, and an explicit empty ledger.
- **Top-up:** creating, created, captured, or failed. Delayed captures are reconciled by the worker; duplicate captures return the existing record.
- **Booking:** an atomic debit succeeds once or returns a clear insufficient-balance/conflict error.
- **Refund:** a related debit is credited once. Refresh and retries are safe because the idempotency key is stable.
- **Withdrawal:** requested → approved/rejected/cancelled. Requested, approved, and processing amounts are presented as in progress. Rejected/cancelled requests release funds once.
- **Provider outage:** checkout is unavailable or reports verification pending; the worker reconciles captured provider orders. No operation silently reports success.
- **Session/permissions:** unauthenticated requests fail; cross-user withdrawal cancellation returns not found; non-owner withdrawal returns forbidden; non-admin review returns forbidden.
- **Responsive/assistive use:** tables scroll horizontally, summary and form grids collapse to one column, controls remain at least 44px high, reduced-motion preferences are respected.

## Rollout, monitoring, and rollback

Ship schema-free presentation and audit improvements first. Monitor action errors, stale withdrawal requests, failed webhook processing, negative-balance constraint errors, and ledger/reconciliation mismatches. The code change can be rolled back without data migration; newly written audit records remain valid operational history. Enabling actual payouts requires a separate reviewed migration and launch gate.

## Remaining limitations

- Real top-ups require Razorpay test keys for staging; live keys are rejected. This blocks live payments, not the presentation demo.
- Real owner payouts require KYC, verified payout destinations, provider approval, webhook processing, and settlement reconciliation. This blocks live withdrawals.
- Hosted self-registration needs configured email delivery. Demo accounts remain usable for presentation.
- Full ledger pagination and server-generated wallet XLSX are deferred; filtered CSV covers the current capped view.
- Competitor behavior available only inside native apps was not asserted without a verifiable public source.
