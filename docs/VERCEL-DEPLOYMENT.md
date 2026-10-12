# TRUF on Vercel

Status: deployment configuration prepared; no hosted deployment verified yet.

## Services

- Vercel: Next.js web application and server routes, Node.js 24.x.
- Hosted PostgreSQL: shared by the web application and worker. The local `.data/postgres` database cannot be used by Vercel.
- Separate Node worker: build with `npm ci && npm run db:generate`, start with `npm run worker`. The existing worker is a continuous process; do not start it inside a request handler or substitute a daily cron.
- Resend with a verified sender: required for registration verification and password recovery outside localhost.

## Deployment sequence

1. Sign in to the intended Vercel account and select its project/team. Deploy the full current app directory containing this file's parent `package.json`; do not deploy the older prototype from GitHub.
2. Provision or select hosted PostgreSQL and configure the deployment environment below. Keep preview and production databases separate.
3. Run `npm run db:migrate` once against the selected hosted database using its migration-capable connection. Migrations are deliberately not part of every preview build. Do not run the local seed or upload local user records.
4. Set the Vercel project runtime to Node.js 24.x. `vercel.json` selects Next.js, `npm ci`, and `npm run build` (including Prisma generation).
5. Deploy, set `BETTER_AUTH_URL` to the stable HTTPS project domain, and redeploy if that value changed. Keep preview deployments protected until their isolated environment is ready.
6. Deploy the worker from the same source revision with the same database and relevant provider settings. Do not apply the existing Render blueprint unchanged: it also provisions a web service/database.
7. Verify health, registration email, recovery, admin MFA, owner isolation, booking approval, expiry jobs, and reports on the hosted URL. Provider checkout remains test-only and needs its own end-to-end validation.

## Server environment

Required: `DATABASE_URL`, a new random `BETTER_AUTH_SECRET` of at least 32 characters, `BETTER_AUTH_URL`, `RESEND_API_KEY`, and `EMAIL_FROM`.

Set `TRUF_LOCAL_MODE=false`. Never upload `.env`, `.data`, local fixture passwords, or authenticator secrets. Add secrets through the hosting environment settings, not public `NEXT_PUBLIC_` variables or chat.

Optional payment test setup: `RAZORPAY_KEY_ID` (test key only), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Point the provider webhook to `/api/payments/webhook`. Route remains disabled pending provider approval and testing.

Optional: AI provider settings and `OPS_TOKEN` as described in `.env.example`. Keep `SEED_PASSWORD` unset on hosted deployments. Provision administrators through the existing promotion script after account verification, then enroll MFA.

## References

- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/cron-jobs/usage-and-pricing

No paid services have been purchased or created by adding this configuration.
