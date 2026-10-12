/** Resolve a chart bucket in IST, clipped to the report's selected dates. */
export function reportRange(q: URLSearchParams) {
  function date(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw Error("Use dates in YYYY-MM-DD format.");
    const utc = new Date(value + "T00:00:00Z");
    if (!Number.isFinite(+utc) || utc.toISOString().slice(0, 10) !== value)
      throw Error("Invalid calendar date.");
    return +utc - 19800000;
  }
  const from = q.get("from"),
    to = q.get("to"),
    bucket = q.get("date");
  let start = from ? date(from) : undefined;
  let end = to ? date(to) + 86400000 : undefined;
  const interval =
    q.get("basis") === "time" ? "week" : q.get("interval") || "day";
  if (!["day", "week", "month"].includes(interval))
    throw Error("Invalid reporting interval.");
  if (bucket && /^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
    const bucketStart = date(bucket);
    const calendar = new Date(bucketStart + 19800000);
    const bucketEnd =
      interval === "month"
        ? Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, 1) -
          19800000
        : bucketStart + (interval === "week" ? 7 : 1) * 86400000;
    start = Math.max(start ?? bucketStart, bucketStart);
    end = Math.min(end ?? bucketEnd, bucketEnd);
  }
  if (start === undefined && end === undefined) return undefined;
  if (start === undefined || end === undefined || start >= end)
    throw Error("Choose a valid date range.");
  return { gte: new Date(start), lt: new Date(end) };
}
