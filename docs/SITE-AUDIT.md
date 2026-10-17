# TRUF website audit

Audit date: 17 October 2026  
Targets: `http://localhost:3000` and `https://truf-red.vercel.app`  
Framework: Next.js App Router

## 1. Executive summary

The application has a coherent public journey and authenticated player, owner, and administrator workspaces. This audit closed the confirmed navigation, authorization, legal-page, link-safety, and search-indexing gaps. The production build, automated route crawl, role checks, unit tests, and database integration tests pass locally.

Release status: **Ready with warnings.** The application is suitable for a controlled, labelled pilot and presentation. Live payments, real email delivery, merchant onboarding, production worker hosting, monitoring, and restore verification remain operational launch gates.

## 2. Page inventory and classification

| Route | Audience | Purpose | Classification | Action |
|---|---|---|---|---|
| `/` | Public | Product landing page | Useful public page | Keep and optimize |
| `/help` | Public | Booking, wallet, refund, and security guidance | Useful public page | Improve public navigation |
| `/privacy` | Public | Pilot privacy notice | Required trust page | Added |
| `/terms` | Public | Pilot terms and booking responsibilities | Required trust page | Added |
| `/credits` | Public | Team and license attribution | Useful public page | Keep and optimize |
| `/login` | Public/account | Role portal selection | Authentication utility | Keep; noindex |
| `/login/[portal]` | Public/account | Player, owner, or admin sign-in | Authentication utility | Keep; noindex |
| `/register`, `/forgot-password`, `/reset-password`, `/two-factor` | Account | Account lifecycle | Authentication utility | Keep; noindex |
| `/auth/continue` | Account | Role-aware post-login routing | Authentication utility | Keep; noindex |
| `/app` | Authenticated | Default app entry | Redirect utility | Redirect to `/app/discover` |
| `/app/discover` | Player+ | Find games and slots | Core application | Keep |
| `/app/matches` | Player+ | Player match history and commitments | Core application | Keep |
| `/app/progress` | Player+ | Attendance, streak, points, badges | Core application | Keep |
| `/app/wallet` | Player+ | Balance and wallet ledger | Core application | Keep |
| `/app/payments` | Player+ | Payment and refund history | Core application | Keep |
| `/app/notifications` | Player+ | Operational notifications | Core application | Keep; sanitize destinations |
| `/app/settings` | Player+ | Profile and account security | Core application | Keep |
| `/app/owner` | Owner/admin | Owner metrics | Restricted application | Protect before render |
| `/app/owner-bookings` | Owner/admin | Venue booking operations | Restricted application | Protect before render |
| `/app/venues` | Owner/admin | Venue and slot management | Restricted application | Protect before render |
| `/app/payments?scope=owner` | Owner/admin | Organization payments | Restricted application | Protect before render |
| `/app/admin` | Admin + MFA | Platform metrics | Restricted application | Protect before render |
| `/app/moderation` | Admin + MFA | Approvals and audit | Restricted application | Protect before render |
| `/app/payments?scope=admin` | Admin + MFA | Platform payments | Restricted application | Protect before render |
| `/app/wallet?scope=admin` | Admin + MFA | Wallet and withdrawal control | Restricted application | Protect before render |
| `/app/access-denied` | Authenticated | Clear role-denial recovery | Error/recovery state | Added |
| `/matches/[id]` | Authenticated/invited | Match details | Restricted application | Keep; noindex |
| `/robots.txt`, `/sitemap.xml` | Crawlers | Discovery controls | SEO infrastructure | Added |
| `/_not-found` | All | Invalid route recovery | Error state | Point to public home |

No page met the threshold for deletion. Similar payment and wallet routes serve distinct ledger and transaction purposes and should remain separate.

## 3. Broken-link and route report

The automated crawl checks 31 public and role-scoped route cases plus 19 rendered internal links. All returned successful or intentional redirect responses. Unknown routes return 404. Unauthenticated application requests redirect to sign-in. Owner and administrator URLs now redirect unauthorized signed-in users to `/app/access-denied`; administrator accounts without MFA continue to `/app/settings?notice=mfa-required`.

The help-page logo and back action now return public visitors to `/` instead of forcing an authentication redirect. The 404 action also returns to `/`.

## 4. Navigation and cross-linking

Public pages share the global footer with Help, Privacy, Terms, and Credits. The landing page links directly to public guidance, player registration, sign-in, and the owner portal. Authenticated navigation remains role-aware and includes recovery paths from denied access. Match, report, payment, and notification links remain contextual to their source records.

## 5. Authorization and security review

The app layout authenticates all `/app/*` routes. Page-level checks now run before rendering owner and administrator content. Query-based owner/admin scopes receive the same checks as direct pages. Administrator access requires the database role and MFA, except for the existing explicitly identified, read-only hosted demo administrator. Server APIs retain their own authorization checks.

Database-provided notification destinations are normalized to same-application paths. Absolute URLs, protocol-relative URLs, JavaScript URLs, malformed strings, and non-path values fall back to the notifications page.

## 6. Accessibility and UX review

The site provides a skip link, labelled navigation, semantic headings, button/link names, table structure, visible focus styles, empty states, and responsive navigation. The new access-denied and policy pages use the existing semantic card and typography system. A 390 × 844 mobile check confirmed that the landing-page hierarchy, primary actions, copy, and illustration fit without horizontal clipping.

Charts continue to include accessible data tables and empty/error states. A complete manual screen-reader and contrast certification remains a pre-public-launch activity.

## 7. SEO review

Public pages have unique titles, descriptions, canonical URLs, and inherited Open Graph/Twitter metadata. `metadataBase` uses the configured application URL. `robots.txt` allows public content and blocks API, account, match, and authenticated application paths. `sitemap.xml` includes only the five public pages. Account and application layouts explicitly use `noindex, nofollow`.

## 8. Redirect map

| Source | Destination | Reason |
|---|---|---|
| `/app` | `/app/discover` | Authenticated default entry |
| Unauthenticated `/app/*` | `/login` | Sign-in required |
| Player on owner route | `/app/access-denied?area=owner` | Approved membership required |
| Non-admin on admin route | `/app/access-denied?area=administrator` | Administrator role required |
| Admin without MFA on admin/owner scope | `/app/settings?notice=mfa-required` | MFA enrollment required |

## 9. Files changed

- Root and route metadata, global footer, help navigation, and 404 recovery.
- New privacy, terms, robots, and sitemap routes.
- Page-level owner/admin authorization and an access-denied state.
- Safe internal notification-link normalization and unit tests.
- Deterministic Windows test-worker configuration.
- A reusable localhost route and rendered-link crawler.

## 10. Verification results

| Check | Result |
|---|---|
| Prettier | Pass |
| TypeScript | Pass |
| ESLint | Pass |
| Unit suite | 30 passed; 16 integration-only tests skipped by design |
| Isolated PostgreSQL integration suite | 46 passed |
| Next.js production build | Pass; 20 static/dynamic route entries |
| Production dependency audit | Pass; zero production vulnerabilities reported |
| Local route/link crawl | Pass; 31 role checks and 19 rendered internal links |
| Browser role denial | Pass |
| Browser public policy page | Pass |
| Mobile landing-page check | Pass at 390 × 844 |

## 11. Remaining warnings

- Razorpay remains test-only until merchant and Route eligibility approval, linked accounts, production webhook checks, and reconciliation sign-off.
- Production registration and recovery require Resend credentials and a verified sender.
- Deadline, notification, refund, and reconciliation jobs require a continuously running production worker; Vercel alone does not provide that worker.
- Production database backups, a restore exercise, alerting, and rate-limit monitoring must be verified before accepting real users or money.
- The privacy notice and terms are pilot copy and should receive legal review before commercial launch.
- npm reports an unpatched high-severity advisory in the development-only ESLint file-matching chain. It is not included in the deployed runtime; CI still runs lint, type checks, tests, and the production build, while its vulnerability gate covers production dependencies.

## 12. Recommended launch sequence

1. Deploy this audited commit and confirm the hosted health endpoint and public policy pages.
2. Configure managed PostgreSQL, the worker host, email delivery, monitoring, and backups.
3. Run staging payment, webhook, refund, substitute, settlement, and failure-retry scenarios.
4. Complete accessibility and legal review.
5. Invite a small owner/player cohort and monitor the controlled pilot.
6. Enable live money movement only after provider approval and operational sign-off.

## 13. Final recommendation

**Ready with warnings** for a presentation and controlled test-data pilot. **Not yet ready for unrestricted commercial launch or live payments** until the operational gates above are completed.
