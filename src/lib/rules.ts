export const SPORTS = ["Football", "Cricket", "Badminton"] as const;
export function validateCapacity(
  sport: string,
  capacity: number,
  price: number,
) {
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 30)
    throw Error("Choose 2–30 players.");
  if (sport === "Badminton" ? ![2, 4].includes(capacity) : capacity % 2 !== 0)
    throw Error("Choose a valid number of players for this sport.");
  if (price % capacity)
    throw Error("The slot price must divide equally to the paise.");
}
export const istDay = (date: Date) =>
  new Date(date.getTime() + 19800000).toISOString().slice(0, 10);
export function weekStart(day: string) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}
export function streak(dates: Date[], now = new Date()) {
  const today = istDay(now),
    week = 604800000,
    current = weekStart(today);
  const weeks = [
    ...new Set(dates.filter((d) => d <= now).map((d) => weekStart(istDay(d)))),
  ].sort((a, b) => a - b);
  let best = 0,
    run = 0,
    previous = -Infinity;
  for (const w of weeks) {
    run = w === previous + week ? run + 1 : 1;
    best = Math.max(best, run);
    previous = w;
  }
  let at = weeks.includes(current) ? current : current - week,
    active = 0;
  while (weeks.includes(at)) {
    active++;
    at -= week;
  }
  return { current: active, best };
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export function csv(rows: Record<string, string | number>[]) {
  if (!rows.length) return "";
  const quote = (v: unknown) =>
    '"' +
    String(v)
      .replace(/^[=+@\-\t\r\n]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [Object.keys(rows[0]), ...rows.map(Object.values)]
    .map((r) => r.map(quote).join(","))
    .join("\r\n");
}
