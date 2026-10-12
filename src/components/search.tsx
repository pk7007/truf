"use client";
import { useState } from "react";
export function SmartSearch({ apply }: { apply: (query: string) => void }) {
  const [filters, setFilters] = useState<{
      sport?: string;
      locality?: string;
      date?: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="card">
      <summary>Describe the game you want</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: new FormData(e.currentTarget).get("query"),
              }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setFilters(d.filters);
            setMessage(
              (d.mode === "demo" ? "Demo mode · " : "AI filters · ") +
                d.message,
            );
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Search unavailable");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          What would you like to play?
          <input
            name="query"
            placeholder="Football in Velachery"
            maxLength={500}
            required
          />
        </label>
        <button disabled={busy}>
          {busy ? "Interpreting…" : "Suggest filters"}
        </button>
      </form>
      <p role="status">{message}</p>
      {filters && (
        <form
          key={JSON.stringify(filters)}
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            apply(
              new URLSearchParams(
                Object.fromEntries(new FormData(e.currentTarget)) as Record<
                  string,
                  string
                >,
              ).toString(),
            );
          }}
        >
          <label>
            Sport
            <select name="sport" defaultValue={filters.sport || ""}>
              <option value="">All sports</option>
              {["Football", "Cricket", "Badminton"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Locality
            <input name="locality" defaultValue={filters.locality} />
          </label>
          <label>
            Date
            <input name="date" type="date" defaultValue={filters.date} />
          </label>
          <button className="primary">Search permitted matches</button>
        </form>
      )}
    </details>
  );
}
