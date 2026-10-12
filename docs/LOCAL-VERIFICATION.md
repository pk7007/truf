# Local verification — 12 October 2026

Run the app at http://localhost:3000. Start-TRUF.ps1 starts the database, production web server and background worker; Stop-TRUF.ps1 stops this app's services.

## Test accounts

| Access | Email |
| --- | --- |
| Player | player@truf.local |
| Turf owner | owner@truf.local |
| Second organization owner | other@truf.local |
| Administrator | admin@truf.local |

The local fixture password is in `.data/LOCAL-ACCESS.txt` (ignored by Git). Admin must enroll an authenticator under Account & security before accessing protected admin operations. Sign out before changing accounts.

## Verified

- Production build, TypeScript and ESLint pass.
- 22 unit and database integration tests pass in a separate disposable schema. Provider calls are mocked in those tests.
- Real localhost HTTP checks pass: four account logins, registration verification, password recovery, CSRF, MFA gate, organization isolation, owner approval/cancellation, reports and missing-provider-configuration handling.
- Browser checks: current navigation state, repeated report submission, desktop match cards, player charts, copyright footer, and no recorded browser errors in the inspected tab.
- Player dashboard has no horizontal document overflow at 320, 390, 768 and desktop 1280 pixel viewports. These checks are not a claim that every browser/device has been tested.

## Fixes in this pass

- Identical filter submissions no longer leave the loading indicator stuck.
- Payment panel changes refetch when URL scope changes.
- Chart date ranges include the full selected week/month and respect report boundaries; invalid dates are rejected.
- Locally hosted Inter variable font, licensed credits, refined landing page and mobile menu; consistent typography, tabular metric numbers, active navigation, status colors, mobile form spacing and touch targets.
- Global copyright footer: © 2026 TRUF Innovators. All rights reserved.

## Remaining pilot gates

Razorpay test credentials and HTTPS webhook testing are still needed for real provider checkout. Live payments remain disabled. Hosted email, photo uploads, complete settlement integration, backup restoration and external monitoring remain pilot release work; see PILOT-READINESS.md. Local email verification/recovery links are written to `.data/mail`.

## Latest regression fixes

- Refund webhooks reconcile provider state and validate payment, amount and currency. Duplicate or stale updates cannot downgrade completed refunds.
- Development slots use calendar-date identifiers, so restarting on a later date adds upcoming availability without rewriting existing bookings.
- Profile saves preserve sports preferences; match management controls follow server permissions; checkout prevents repeated clicks.
- Authenticator setup provides a locally generated QR code and clearer six-digit-code guidance.
- Latest browser checks verified Inter, mobile menu navigation, player progress at 320/390/768/1280 pixels, and no captured console errors.
- Production dependency audit: zero reported vulnerabilities in the last audit. Five high-severity development-only lint dependency advisories remain without a compatible offered fix; do not interpret this as a complete security audit.

