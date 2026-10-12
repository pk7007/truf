"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ChartData } from "@/server/analytics";
import { csv, money } from "@/lib/rules";
type Report = {
  from: string;
  to: string;
  generatedAt: string;
  venues: { id: string; name: string }[];
  charts: ChartData[];
  summary: Record<string, number>;
  progress: null | {
    games: number;
    points: number;
    current: number;
    best: number;
    claims: string[];
    history: {
      title: string;
      date: string;
      sport: string;
      minutes: number;
      matchId: string;
    }[];
  };
};
const colors = [
  "#b6a1ff",
  "#5edac7",
  "#f4be6c",
  "#ef91ac",
  "#80b7ed",
  "#c0d580",
];
function exportChart(chart: ChartData) {
  const keys = ["date", ...chart.series];
  const text = csv(
    chart.rows.map((row) =>
      Object.fromEntries(keys.map((k) => [k, row[k] ?? ""])),
    ),
  );
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = chart.id + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
function Chart({ data }: { data: ChartData }) {
  const currency = data.id === "cash";
  const formatValue = (value: unknown) =>
    currency
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(Number(value))
      : new Intl.NumberFormat("en-IN").format(Number(value));
  const formatDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(value + "T00:00:00+05:30").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata",
        })
      : value;
  return (
    <article className="card report-chart">
      <div className="row between">
        <h2>{data.title}</h2>
        <button onClick={() => exportChart(data)} disabled={!data.rows.length}>
          Export CSV
        </button>
      </div>
      <p className="muted">
        <small>{data.basis}</small>
      </p>
      {!data.rows.length ? (
        <div className="empty">No records in this period.</div>
      ) : data.kind === "heatmap" ? (
        <div
          className={
            data.id === "utilization" ? "heatmap utilization-map" : "heatmap"
          }
          aria-label={data.title}
        >
          {data.rows.map((r, i) => (
            <a
              className="heatcell"
              key={i}
              href={
                data.href +
                (data.href.includes("?") ? "&" : "?") +
                "date=" +
                encodeURIComponent(String(r.date))
              }
              style={{
                background: Number(r[data.series[0]])
                  ? `hsl(260 32% ${24 + Math.min(100, Number(r[data.series[0]])) * 0.22}%)`
                  : "#222938",
              }}
              title={data.series[0] + ": " + r[data.series[0]]}
            >
              {r.date}
              <br />
              <strong>
                {r[data.series[0]]}
                {data.id === "utilization" &&
                typeof r[data.series[0]] === "number"
                  ? "%"
                  : ""}
              </strong>
            </a>
          ))}
        </div>
      ) : (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            {data.kind === "line" ? (
              <LineChart
                data={data.rows}
                margin={{ top: 12, right: 12, left: 12, bottom: 8 }}
              >
                <CartesianGrid stroke="#343c50" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "#acb6c8" }}
                />
                <YAxis
                  allowDecimals={data.id === "cash"}
                  tick={{ fill: "#acb6c8" }}
                />
                <Tooltip
                  formatter={(value) => formatValue(value)}
                  labelFormatter={(label) => formatDate(String(label))}
                  contentStyle={{
                    background: "#171c27",
                    borderColor: "#424c61",
                  }}
                />
                <Legend />
                {data.series.map((s, i) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    stroke={colors[i % colors.length]}
                    dot={data.rows.length <= 7 ? { r: 3 } : false}
                    strokeWidth={3}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart
                data={data.rows}
                margin={{ top: 12, right: 16, left: 12, bottom: 8 }}
                maxBarSize={36}
                barGap={4}
                layout={data.kind === "horizontal" ? "vertical" : "horizontal"}
              >
                <CartesianGrid stroke="#343c50" strokeDasharray="3 3" />
                <XAxis
                  allowDecimals={data.id === "cash"}
                  type={data.kind === "horizontal" ? "number" : "category"}
                  dataKey={data.kind === "horizontal" ? undefined : "date"}
                  tick={{ fontSize: 11, fill: "#acb6c8" }}
                />
                <YAxis
                  allowDecimals={data.id === "cash"}
                  type={data.kind === "horizontal" ? "category" : "number"}
                  dataKey={data.kind === "horizontal" ? "date" : undefined}
                  width={data.kind === "horizontal" ? 100 : 45}
                  tick={{ fontSize: 11, fill: "#acb6c8" }}
                />
                <Tooltip
                  formatter={(value) => formatValue(value)}
                  labelFormatter={(label) => formatDate(String(label))}
                  contentStyle={{
                    background: "#171c27",
                    borderColor: "#424c61",
                  }}
                />
                <Legend />
                {data.series.map((s, i) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    fill={colors[i % colors.length]}
                    stackId={data.kind === "stacked" ? "status" : undefined}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <details>
        <summary>View data table and matching records</summary>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              {data.title} — {data.basis}
            </caption>
            <thead>
              <tr>
                <th scope="col">Period / category</th>
                {data.series.map((s) => (
                  <th scope="col" key={s}>
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">
                    <a
                      href={
                        data.href +
                        (data.href.includes("?") ? "&" : "?") +
                        "date=" +
                        encodeURIComponent(String(r.date))
                      }
                    >
                      {r.date}
                    </a>
                  </th>
                  {data.series.map((s) => (
                    <td key={s}>{currency ? formatValue(r[s]) : r[s]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
export function Reports({ view }: { view: "player" | "owner" | "admin" }) {
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [query, setQuery] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/reports?view=" + view + "&" + query, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [view, query, retry]);
  return (
    <>
      <p className="tag">
        {view === "player" ? "Your sporting life" : "Performance overview"}
      </p>
      <h1>
        {view === "player"
          ? "Keep showing up."
          : view === "owner"
            ? "Your turf, in focus."
            : "The bigger picture."}
      </h1>
      <p className="muted">
        {view === "player"
          ? "Verified games become progress. One week at a time."
          : "Simple reports built from bookings, captured payments, and recorded attendance."}
      </p>
      <form
        className="filters card"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setRetry((value) => value + 1);
          setQuery(
            new URLSearchParams(
              new FormData(e.currentTarget) as unknown as Record<
                string,
                string
              >,
            ).toString(),
          );
        }}
      >
        <label>
          From
          <input name="from" type="date" defaultValue={data?.from} />
        </label>
        <label>
          To
          <input name="to" type="date" defaultValue={data?.to} />
        </label>
        <label>
          Sport
          <select name="sport">
            <option value="">All sports</option>
            {["Football", "Cricket", "Badminton"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {view !== "player" && (
          <label>
            Venue
            <select name="venue">
              <option value="">All permitted venues</option>
              {data?.venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {view !== "player" && (
          <label>
            Trend interval
            <select name="interval">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </label>
        )}
        <button className="primary" disabled={busy}>
          Apply
        </button>
        <div className="row">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              type="button"
              onClick={(e) => {
                setBusy(true);
                setRetry((value) => value + 1);
                const to = new Date(),
                  from = new Date(Date.now() - (n - 1) * 86400000);
                const filters = new URLSearchParams(
                  Object.fromEntries(
                    new FormData(e.currentTarget.form!),
                  ) as Record<string, string>,
                );
                filters.set(
                  "from",
                  from.toLocaleDateString("en-CA", {
                    timeZone: "Asia/Kolkata",
                  }),
                );
                filters.set(
                  "to",
                  to.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
                );
                setQuery(filters.toString());
                const form = e.currentTarget.form!;
                (form.elements.namedItem("from") as HTMLInputElement).value =
                  filters.get("from")!;
                (form.elements.namedItem("to") as HTMLInputElement).value =
                  filters.get("to")!;
              }}
            >
              {n} days
            </button>
          ))}
        </div>
      </form>
      {busy ? (
        <div className="empty" role="status">
          Loading report…
        </div>
      ) : error ? (
        <div className="error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setBusy(true);
              setRetry(retry + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        data && (
          <>
            {view === "player" && data.progress ? (
              <>
                <div className="stats">
                  {[
                    ["Verified games", data.progress.games],
                    ["Non-cash points", data.progress.points],
                    ["Current weekly streak", data.progress.current],
                    ["Best weekly streak", data.progress.best],
                  ].map(([label, value]) => (
                    <div className="card stat" key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h2>Your milestones</h2>
                  <p className="muted">
                    Progress uses all verified attendance. Weeks run
                    Monday–Sunday in IST.
                  </p>
                  <div className="stats">
                    {[
                      ["First game", data.progress.games, 1],
                      ["Three-week streak", data.progress.best, 3],
                      ["Five games", data.progress.games, 5],
                    ].map(([name, value, target]) => (
                      <div key={name}>
                        <strong>{name}</strong>
                        <progress
                          value={Math.min(Number(value), Number(target))}
                          max={Number(target)}
                          aria-label={String(name)}
                        />
                        <small>
                          {Math.min(Number(value), Number(target))} / {target} ·{" "}
                          {Number(value) >= Number(target)
                            ? "Earned"
                            : "In progress"}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="stats">
                {[
                  ["Bookings", String(data.summary.bookings)],
                  ["Gross collections", money(data.summary.capturedPaise)],
                  ["Completed refunds", money(data.summary.refundedPaise)],
                  ["Net collections", money(data.summary.netPaise)],
                  ["Provider fees", money(data.summary.providerFeesPaise)],
                  ["Owner settlements", money(data.summary.settledPaise)],
                ].map(([label, value]) => (
                  <div className="card stat" key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="charts">
              {data.charts.map((c) => (
                <Chart key={c.id} data={c} />
              ))}
            </div>
            <p className="muted">
              <small>
                Generated{" "}
                {new Date(data.generatedAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST.{" "}
                {view === "player"
                  ? "Progress is based on recorded attendance. Points have no cash value."
                  : "Collections are not profit. Platform commission is zero during the pilot; settlements are reported separately."}
              </small>
            </p>
          </>
        )
      )}
    </>
  );
}
