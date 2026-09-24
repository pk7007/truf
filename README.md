# TRUF

A sports community application for discovering players, forming committed teams, and coordinating turf bookings.

## Team

TRUF Innovators: PRAVEEN KESHAVAN and S EVANDLE BENNI.

## Repository status

Initial repository setup only. The application is not implemented or runnable yet.

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
