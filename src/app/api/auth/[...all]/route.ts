import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { accountReadiness } from "@/server/readiness";
import { localMode } from "@/server/local-mode";
const handlers = toNextJsHandler(auth);
async function handle(request: Request) {
  const ready = accountReadiness(process.env, localMode());
  const path = new URL(request.url).pathname;
  const needsEmail = [
    "/sign-up/email",
    "/request-password-reset",
    "/send-verification-email",
  ].some((suffix) => path.endsWith(suffix));
  if (!ready.authentication || (needsEmail && !ready.email))
    return Response.json(
      {
        code: "SERVICE_UNAVAILABLE",
        message:
          "Account service is temporarily unavailable. Please try again later.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "300" },
      },
    );
  return request.method === "GET"
    ? handlers.GET(request)
    : handlers.POST(request);
}
export const GET = handle;
export const POST = handle;
