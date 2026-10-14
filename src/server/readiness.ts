export function accountReadiness(
  env: Record<string, string | undefined> = process.env,
  local = false,
) {
  let validUrl = false;
  try {
    const url = new URL(env.BETTER_AUTH_URL || "");
    validUrl = local || url.protocol === "https:";
  } catch {}
  const authentication =
    validUrl &&
    !!env.DATABASE_URL &&
    (env.BETTER_AUTH_SECRET?.length || 0) >= 32 &&
    env.BETTER_AUTH_SECRET !== "GENERATE_A_RANDOM_SECRET";
  const email = local || !!(env.RESEND_API_KEY && env.EMAIL_FROM);
  return { authentication, email };
}
