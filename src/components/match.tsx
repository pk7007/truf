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
type CheckoutResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}
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
  async function pay() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const order = await action({
        action: "checkout",
        id,
        token: new URLSearchParams(location.search).get("token") || undefined,
      });
      if (!window.Razorpay)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(Error("Checkout could not load."));
          document.head.append(script);
        });
      new window.Razorpay({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: "TRUF · Test checkout",
        handler: async (result: CheckoutResult) => {
          try {
            const r = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const d = await r.json();
            if (!r.ok) setError(d.error);
            else done();
          } catch {
            setError(
              "We could not verify the payment yet. Check My payments before trying again.",
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            done();
          },
        },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
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
              full refunds. Refund timing depends on the payment provider.
            </p>
            <div className="row">
              <button
                className="primary"
                onClick={pay}
                disabled={
                  busy ||
                  !["RECRUITING", "CONFIRMED"].includes(data.status) ||
                  data.participations.some(
                    (p) =>
                      p.userId === data.myId &&
                      ["PAID", "WAITING_REPLACEMENT"].includes(p.status),
                  )
                }
              >
                {busy
                  ? "Checkout in progress…"
                  : data.participations.some(
                        (p) => p.userId === data.myId && p.status === "PAID",
                      )
                    ? "Your place is paid"
                    : "Pay your share · test mode"}
              </button>
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
