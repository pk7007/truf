"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { action, ActionButton, date } from "./records";
import { money } from "@/lib/rules";
type Detail = {
  id: string;
  myId: string;
  canManage: boolean;
  title: string;
  status: string;
  capacity: number;
  sharePaise: number;
  walletBalancePaise: number;
  deadline: string | null;
  slot: { startsAt: string; area: { sport: string; venue: { name: string } } };
  participations: {
    id: string;
    userId: string;
    status: string;
    user: { name: string };
    attendance: { status: string } | null;
  }[];
  events: { id: string; status: string; at: string }[];
};
export function MatchDetail({ id }: { id: string }) {
  const query = useSearchParams().toString();
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  const done = () => setVersion((v) => v + 1);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/data?id=" + encodeURIComponent(id) + "&" + query, {
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
      });
    return () => controller.abort();
  }, [id, version, query]);
  async function payFromWallet() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action({
        action: "wallet-pay",
        id,
        token: new URLSearchParams(location.search).get("token") || undefined,
      });
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet payment failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="hero">
      <Link className="brand" href="/app/discover">
        TRUF
      </Link>
      <div className="row" style={{ margin: "25px 0" }}>
        <Link href="/app/discover">← Discover</Link>
        <Link href="/app/matches">My matches</Link>
        {data?.canManage && (
          <Link href="/app/owner-bookings">Venue bookings</Link>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data ? (
        <>
          <p className="tag">
            {data.slot.area.sport} · {data.status}
          </p>
          <h1>{data.title}</h1>
          <p className="muted">
            {data.slot.area.venue.name} · {date(data.slot.startsAt)}
          </p>
          <div className="stats">
            <div className="card stat">
              <small>Paid players</small>
              <strong>
                {data.participations.filter((p) => p.status === "PAID").length}{" "}
                / {data.capacity}
              </strong>
            </div>
            <div className="card stat">
              <small>Your full share</small>
              <strong>{money(data.sharePaise)}</strong>
            </div>
            <div className="card">
              <small>Recruitment deadline</small>
              <p>
                {data.deadline
                  ? date(data.deadline)
                  : "Awaiting owner approval"}
              </p>
            </div>
          </div>
          <div className="card">
            <h2>Commit to the game</h2>
            <p className="muted">
              Before confirmation, withdrawal starts a full refund. After
              confirmation, your refund starts only when a paid substitute takes
              your place. An incomplete match expires at its deadline and starts
              full refunds. Wallet refunds appear instantly in your TRUF Wallet.
            </p>
            <div className="wallet-inline">
              <span>Available wallet balance</span>
              <strong>{money(data.walletBalancePaise)}</strong>
              {data.walletBalancePaise < data.sharePaise && (
                <Link href="/app/wallet">Add money to wallet</Link>
              )}
            </div>
            <div className="row">
              <button
                className="primary"
                onClick={payFromWallet}
                disabled={
                  busy ||
                  data.walletBalancePaise < data.sharePaise ||
                  !["RECRUITING", "CONFIRMED"].includes(data.status) ||
                  data.participations.some(
                    (p) =>
                      p.userId === data.myId &&
                      ["PAID", "WAITING_REPLACEMENT"].includes(p.status),
                  )
                }
              >
                {busy
                  ? "Processing wallet payment…"
                  : data.participations.some(
                        (p) => p.userId === data.myId && p.status === "PAID",
                      )
                    ? "Your place is paid"
                    : "Pay from wallet · " + money(data.sharePaise)}
              </button>
              <Link className="button" href="/app/wallet">
                Open wallet
              </Link>
              {data.participations.some(
                (p) => p.userId === data.myId && p.status === "PAID",
              ) && (
                <ActionButton body={{ action: "withdraw", id }} done={done}>
                  Withdraw / request substitute
                </ActionButton>
              )}
            </div>
          </div>
          <div className="cards">
            <section className="card">
              <h2>Team commitments</h2>
              {data.participations.map((p) => (
                <p key={p.id}>
                  {p.user.name} <span className="badge">{p.status}</span>{" "}
                  {p.attendance?.status}
                </p>
              ))}
            </section>
            <section className="card">
              <h2>Match timeline</h2>
              {data.events.map((e) => (
                <p key={e.id}>
                  {e.status}
                  <br />
                  <small>{date(e.at)}</small>
                </p>
              ))}
            </section>
          </div>
          {data.canManage && (
            <details className="card">
              <summary>Manage this booking</summary>
              <ActionButton body={{ action: "cancel", id }} done={done}>
                Cancel match and refund players
              </ActionButton>
              {data.status === "COMPLETED" &&
                data.participations
                  .filter((p) => p.status === "PAID")
                  .map((p) => (
                    <div className="row" key={p.id}>
                      <span>{p.user.name}</span>
                      {["ATTENDED", "NO_SHOW", "UNMARKED"].map((status) => (
                        <ActionButton
                          key={status}
                          body={{ action: "attendance", id: p.id, status }}
                          done={done}
                        >
                          {status}
                        </ActionButton>
                      ))}
                    </div>
                  ))}
            </details>
          )}
        </>
      ) : (
        !error && <p role="status">Loading match…</p>
      )}
    </main>
  );
}
