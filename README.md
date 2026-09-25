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

This prototype uses fictional seed data and browser localStorage. Payment success/failure and refunds are explicitly simulated, not Razorpay test API calls. There is no authentication, server-side authorization, shared database, AI integration, automated deadline processing, or real booking/settlement service. The role selector is for demonstration only. Do not use this prototype for actual bookings or financial transactions.

## Prototype verification

Browser checks completed: last-player join confirms a match; simulated payment failure is recoverable; withdrawal marks the demo payment refunded; match creation appears in the owner panel and reserves its slot; adding an owner slot works; owner approval persists across reload. JavaScript syntax and Git whitespace checks passed. These are prototype checks, not production integration or security verification.

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
