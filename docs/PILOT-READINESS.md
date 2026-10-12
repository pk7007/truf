# Pilot release gates

This repository implements a local development application. Passing a local build is not permission to accept real money or a claim that the real pilot is ready.

## External setup, in order

| Phase | Setup and decision                                                                                                 | Gate                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 0     | Named pilot owners; written cancellation, substitute and fee policies; Razorpay merchant/Route eligibility enquiry | Keep live payments disabled                                                                     |
| 1     | Node.js 24 LTS, Git, private GitHub repository                                                                     | Install dependencies, build, lint and types                                                     |
| 2     | Development PostgreSQL; Resend account and verified sender                                                         | Test registration, email verification and password recovery with a real inbox; enroll admin MFA |
| 3     | Venue addresses, prices, playing areas and opening hours                                                           | Owners enter slots; admins approve venues; concurrency tests pass                               |
| 4     | Razorpay test key ID, key secret, webhook secret; HTTPS staging                                                    | Test successful/failed/late checkout, refunds and duplicate webhooks against the provider       |
| 5     | Render web service, persistent PostgreSQL and separate worker                                                      | Worker runs when browsers are closed; retry/restart checks pass                                 |
| 6     | No external service                                                                                                | Corrected attendance reverses points and recalculates badges/streaks                            |
| 7     | No external service                                                                                                | Reports reconcile; keyboard, mobile and chart CSV checks pass                                   |
| 8     | Optional server-side AI credentials and compatible endpoint                                                        | Validate outputs; use labelled demo parsing without credentials                                 |
| 9     | Backups, restore database, domain, uptime/ops monitoring                                                           | Run restore drill and alert delivery test; review privacy/retention and accessibility           |
| 10    | Provider-approved linked accounts and fee responsibility                                                           | Separate reviewed live integration is required; this code rejects live keys                     |

No purchases or hosted resources are created by the repository configuration. Review hosting prices before applying `render.yaml`. The prototype ₹2,000–₹5,000 estimate is not a production budget.

## Payment approval dependency

Razorpay's Route documentation, checked 30 September 2026, lists financial-turnover and payer/payee transparency requirements. Do not assume that a student prototype qualifies. Obtain written confirmation for this exact multiple-owner use case. No fallback to collecting unrelated owners' funds through a single unapproved merchant.

Official reference: https://razorpay.com/docs/payments/route/

## Release review

- Live payment keys remain rejected by `assertTestPayments`.
- The Route adapter is test-only and disabled by default. Linked-account setup and settlement reconciliation must be proven in provider staging before launch.
- Email delivery requires Resend configuration. Development fixture accounts are verified only in the local seed; this is not an authentication bypass in production.
- Local fixtures do not establish owner participation or policy acceptance.
- Provider requests with uncertain outcomes require reconciliation; never blindly resubmit a refund/transfer.
- Deployment, real-provider end-to-end checks, production backup restoration and external alert delivery require the actual service accounts.
- Venue photo uploads, broader notification delivery and the full provider settlement lifecycle require further integration work before the complete pilot scope is signed off.
- No generated chart data is used when a query fails. Development seeds are separate from browser-local prototype data.

## Post-pilot work

Native mobile apps, tournaments, dynamic pricing, weather automation, WhatsApp integration, cash rewards and public social feeds remain deferred.
