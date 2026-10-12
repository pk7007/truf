import { localMode } from "./local-mode";
export async function sendMail(to: string, subject: string, body: string) {
  if (localMode() && !process.env.RESEND_API_KEY) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { randomUUID } = await import("node:crypto");
    await mkdir(".data/mail", { recursive: true });
    await writeFile(
      ".data/mail/" + Date.now() + "-" + randomUUID() + ".json",
      JSON.stringify(
        { to, subject, body, createdAt: new Date().toISOString() },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    return;
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("Email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      text: body,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Email delivery failed");
}
