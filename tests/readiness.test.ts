import { expect, test } from "vitest";
import { accountReadiness } from "../src/server/readiness";

const configured = {
  DATABASE_URL: "postgresql://example.invalid/truf",
  BETTER_AUTH_URL: "https://truf.example",
  BETTER_AUTH_SECRET: "test-only-secret-with-more-than-32-characters",
};
test("hosted accounts require a secret and HTTPS; email is independently gated", () => {
  expect(accountReadiness(configured)).toEqual({
    authentication: true,
    email: false,
  });
  expect(
    accountReadiness({ ...configured, BETTER_AUTH_SECRET: "" }).authentication,
  ).toBe(false);
  expect(
    accountReadiness({ ...configured, BETTER_AUTH_URL: "http://truf.example" })
      .authentication,
  ).toBe(false);
  expect(
    accountReadiness({
      ...configured,
      RESEND_API_KEY: "test",
      EMAIL_FROM: "TRUF <test@example.com>",
    }).email,
  ).toBe(true);
});
test("local mailbox mode still requires an authentication secret", () => {
  expect(
    accountReadiness(
      { ...configured, BETTER_AUTH_URL: "http://localhost:3000" },
      true,
    ),
  ).toEqual({ authentication: true, email: true });
  expect(accountReadiness({}, true).authentication).toBe(false);
});
