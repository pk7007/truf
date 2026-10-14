import { db } from "@/server/db";
export async function GET() {
  try {
    // Verify application tables, not merely that PostgreSQL accepts connections.
    await Promise.all([
      db.user.findFirst({ select: { id: true } }),
      db.match.findFirst({ select: { id: true } }),
      db.job.findFirst({ select: { id: true } }),
    ]);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
