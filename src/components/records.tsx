"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { money } from "@/lib/rules";
import { MFA } from "./account";
import { SmartSearch } from "./search";
type Slot = {
  id: string;
  startsAt: string;
  pricePaise: number;
  blocked: boolean;
  booking?: { source: string } | null;
  area: {
    name: string;
    sport: string;
    venue: { name: string; locality: string };
  };
};
type Match = {
  id: string;
  title: string;
  status: string;
  capacity: number;
  sharePaise: number;
  slot: Slot;
  _count: { participations: number };
};
type Venue = {
  id: string;
  name: string;
  approved: boolean;
  areas: { id: string; name: string; sport: string; slots: Slot[] }[];
};
export type RecordsData = {
  matches?: Match[];
  slots?: Slot[];
  name?: string;
  email?: string;
  twoFactorEnabled?: boolean;
  locality?: string;
  accountType?: string;
  sports?: string[];
  memberships?: {
    organization: { id: string; name: string; status: string };
  }[];
  organizations?: {
    id: string;
    name: string;
    status: string;
    venues: Venue[];
  }[];
  jobs?: { id: string; kind: string; status: string; error: string }[];
  audit?: { id: string; action: string; createdAt: string }[];
  users?: { id: string; name: string; email: string; suspended: boolean }[];
};
type Payment = {
  id: string;
  amountPaise: number;
  capturedAt: string;
  providerPaymentId: string;
  refunds: { id: string; amountPaise: number; status: string }[];
  order: { participation: { match: { id: string; title: string } } };
};
type Notice = {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
};
type WalletData = {
  id?: string;
  mode?: "ADMIN";
  currency: string;
  balancePaise: number;
  walletCount?: number;
  creditsPaise?: number;
  debitsPaise?: number;
  canWithdraw?: boolean;
  withdrawablePaise?: number;
  generatedAt?: string;
  readOnly?: boolean;
  testMode: "TEST" | "UNAVAILABLE";
  entries: {
    id: string;
    type: string;
    amountPaise: number;
    balanceAfterPaise: number;
    description: string;
    createdAt: string;
    userName?: string;
    userEmail?: string;
  }[];
  topUps: {
    id: string;
    amountPaise: number;
    status: string;
    createdAt: string;
  }[];
  withdrawals: {
    id: string;
    amountPaise: number;
    payoutMethod: string;
    status: string;
    note?: string | null;
    createdAt: string;
    user?: { name: string; email: string };
  }[];
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
export async function action(body: Record<string, unknown>) {
  const r = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (!r.ok) throw Error(result.error);
  return result;
}
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: string;
  required?: boolean;
};
export function ActionForm({
  title,
  kind,
  fields,
  extra = {},
  done,
}: {
  title: string;
  kind: string;
  fields: Field[];
  extra?: Record<string, unknown>;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <details className="card">
      <summary>{title}</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          setError("");
          setNotice("");
          const values = Object.fromEntries(new FormData(form));
          try {
            for (const field of fields)
              if (field.type === "datetime-local" && values[field.name])
                values[field.name] = new Date(
                  String(values[field.name]),
                ).toISOString();
            const r = await action({ action: kind, ...extra, ...values });
            setNotice(
              r.invitationToken
                ? "Private invitation: " +
                    location.origin +
                    "/matches/" +
                    r.id +
                    "?token=" +
                    r.invitationToken
                : "Saved.",
            );
            done();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Request failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {fields.map((f) => (
          <label key={f.name}>
            {f.label}
            {f.options ? (
              <select
                name={f.name}
                defaultValue={f.value}
                required={f.required !== false}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                type={f.type || "text"}
                defaultValue={f.value}
                required={f.required !== false}
              />
            )}
          </label>
        ))}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : title}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p
            className="success"
            style={{ overflowWrap: "anywhere" }}
            role="status"
          >
            {notice}
          </p>
        )}
      </form>
    </details>
  );
}
export function ActionButton({
  body,
  children,
  done,
}: {
  body: Record<string, unknown>;
  children: React.ReactNode;
  done: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await action(body);
            done();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </button>
      {message && (
        <span role="alert" className="error">
          {message}
        </span>
      )}
    </span>
  );
}
export const date = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " IST";

function WalletPanel({ data, done }: { data: WalletData; done: () => void }) {
  const [amount, setAmount] = useState("500");
  const [withdrawalAmount, setWithdrawalAmount] = useState("500");
  const [payoutMethod, setPayoutMethod] = useState("BANK");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function topUp() {
    setBusy(true);
    setMessage("");
    try {
      const order = await action({
        action: "wallet-top-up",
        amountPaise: Math.round(Number(amount) * 100),
      });
      if (!window.Razorpay)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(Error("Secure checkout could not load."));
          document.head.append(script);
        });
      new window.Razorpay({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: "TRUF Wallet · Test mode",
        description: "Add money to your TRUF Wallet",
        handler: async (result: CheckoutResult) => {
          try {
            const response = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const body = await response.json();
            if (!response.ok) throw Error(body.error);
            setMessage("Top-up complete. Your balance is updated.");
            done();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Verification is pending.",
            );
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Top-up failed.");
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    setMessage("");
    try {
      await action({
        action: "wallet-withdraw",
        amountPaise: Math.round(Number(withdrawalAmount) * 100),
        payoutMethod,
      });
      setMessage("Withdrawal request submitted. The amount is now reserved.");
      done();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Withdrawal failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="wallet-hero card">
        <div>
          <p className="eyebrow">
            {data.mode === "ADMIN"
              ? "Wallets under management"
              : "Available balance"}
          </p>
          <strong>{money(data.balancePaise)}</strong>
          <p>
            {data.mode === "ADMIN"
              ? `${data.walletCount || 0} wallets · ${money(data.creditsPaise || 0)} credits · ${money(data.debitsPaise || 0)} booking debits`
              : "Use this balance for any eligible TRUF match."}
          </p>
        </div>
        {data.mode !== "ADMIN" && (
          <div className="wallet-top-up">
            <label>
              Add money (₹)
              <input
                type="number"
                min="100"
                max="5000"
                step="100"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={busy || data.testMode === "UNAVAILABLE"}
              onClick={topUp}
            >
              {busy ? "Opening checkout…" : "Add with Razorpay"}
            </button>
            {data.testMode === "UNAVAILABLE" && (
              <small>
                Online top-ups are disabled until Razorpay test keys are
                configured.
              </small>
            )}
            {message && <p role="status">{message}</p>}
          </div>
        )}
      </section>
      {data.mode !== "ADMIN" && data.canWithdraw && (
        <section className="card withdrawal-panel">
          <div>
            <p className="eyebrow">Owner earnings</p>
            <h2>Withdraw earnings</h2>
            <p className="muted">
              Available to withdraw:{" "}
              <strong>{money(data.withdrawablePaise || 0)}</strong>. Requests
              reserve funds immediately and require administrator review.
            </p>
          </div>
          <div className="withdrawal-form">
            <label>
              Amount (₹)
              <input
                type="number"
                min="500"
                max="50000"
                step="100"
                value={withdrawalAmount}
                onChange={(event) => setWithdrawalAmount(event.target.value)}
              />
            </label>
            <label>
              Preferred payout method
              <select
                value={payoutMethod}
                onChange={(event) => setPayoutMethod(event.target.value)}
              >
                <option value="BANK">Verified bank account</option>
                <option value="UPI">Verified UPI account</option>
              </select>
            </label>
            <button
              className="primary"
              onClick={withdraw}
              disabled={busy || (data.withdrawablePaise || 0) < 50000}
            >
              {busy ? "Submitting…" : "Request withdrawal"}
            </button>
          </div>
          <small className="muted">
            Pilot workflow only. Actual payout starts after KYC and a payout
            provider are connected.
          </small>
        </section>
      )}
      {!!data.withdrawals?.length && (
        <section className="card">
          <div className="row between">
            <div>
              <p className="eyebrow">Payout queue</p>
              <h2>
                {data.mode === "ADMIN"
                  ? "Withdrawal review"
                  : "Withdrawal requests"}
              </h2>
            </div>
            {data.readOnly && <span className="badge">Demo · read only</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  {data.mode === "ADMIN" && <th>Owner</th>}
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id}>
                    <td>{date(withdrawal.createdAt)}</td>
                    {data.mode === "ADMIN" && (
                      <td>
                        {withdrawal.user?.name}
                        <br />
                        <small>{withdrawal.user?.email}</small>
                      </td>
                    )}
                    <td>{withdrawal.payoutMethod}</td>
                    <td>{money(withdrawal.amountPaise)}</td>
                    <td>
                      <span
                        className={`badge status-${withdrawal.status.toLowerCase()}`}
                      >
                        {withdrawal.status}
                      </span>
                    </td>
                    <td>
                      {data.mode === "ADMIN" &&
                      withdrawal.status === "REQUESTED" &&
                      !data.readOnly ? (
                        <div className="row">
                          <ActionButton
                            body={{
                              action: "wallet-withdraw-review",
                              id: withdrawal.id,
                              decision: "APPROVED",
                            }}
                            done={done}
                          >
                            Approve
                          </ActionButton>
                          <ActionButton
                            body={{
                              action: "wallet-withdraw-review",
                              id: withdrawal.id,
                              decision: "REJECTED",
                            }}
                            done={done}
                          >
                            Reject
                          </ActionButton>
                        </div>
                      ) : data.mode !== "ADMIN" &&
                        withdrawal.status === "REQUESTED" ? (
                        <ActionButton
                          body={{
                            action: "wallet-withdraw-cancel",
                            id: withdrawal.id,
                          }}
                          done={done}
                        >
                          Cancel request
                        </ActionButton>
                      ) : (
                        withdrawal.note || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {data.mode !== "ADMIN" && !!data.topUps?.length && (
        <section className="card">
          <p className="eyebrow">Payment reconciliation</p>
          <h2>Recent top-ups</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topUps.map((topUp) => (
                  <tr key={topUp.id}>
                    <td>{date(topUp.createdAt)}</td>
                    <td>{money(topUp.amountPaise)}</td>
                    <td>
                      <span
                        className={`badge status-${topUp.status.toLowerCase()}`}
                      >
                        {topUp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card">
        <div className="row between">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2>Wallet activity</h2>
          </div>
          <span className="badge">INR · protected ledger</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                {data.mode === "ADMIN" && <th>Account</th>}
                <th>Details</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{date(entry.createdAt)}</td>
                  {data.mode === "ADMIN" && (
                    <td>
                      {entry.userName}
                      <br />
                      <small>{entry.userEmail}</small>
                    </td>
                  )}
                  <td>{entry.description}</td>
                  <td>
                    <span className="badge">
                      {entry.type.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td
                    className={
                      entry.type === "BOOKING"
                        ? "wallet-debit"
                        : "wallet-credit"
                    }
                  >
                    {entry.type === "BOOKING" ? "−" : "+"}
                    {money(entry.amountPaise)}
                  </td>
                  <td>{money(entry.balanceAfterPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.entries.length && (
          <p className="empty">Your wallet has no activity yet.</p>
        )}
      </section>
      <p className="muted wallet-note">
        TRUF Wallet is a closed-loop booking balance. It is not a bank account
        and cannot be transferred between users or withdrawn as cash during the
        pilot.
        {data.generatedAt && <> · Last synced {date(data.generatedAt)}</>}
      </p>
    </>
  );
}
export function Records({
  view,
  initialData,
}: {
  view: string;
  initialData?: RecordsData;
}) {
  const urlQuery = useSearchParams().toString();
  const [data, setData] = useState<
      RecordsData | Venue[] | Payment[] | Notice[] | WalletData | null
    >(initialData ?? null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(!initialData),
    [version, setVersion] = useState(0),
    [query, setQuery] = useState("");
  const done = () => setVersion((v) => v + 1);
  useEffect(() => {
    if (initialData && version === 0 && !query && !urlQuery) return;
    const controller = new AbortController();
    fetch(
      "/api/data?view=" +
        (view === "moderation" ? "admin" : view) +
        "&" +
        query +
        "&" +
        urlQuery,
      { signal: controller.signal },
    )
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
  }, [view, version, query, urlQuery, initialData]);
  useEffect(() => {
    if (
      ![
        "wallet",
        "matches",
        "discover",
        "owner-bookings",
        "notifications",
        "venues",
        "payments",
        "moderation",
      ].includes(view)
    )
      return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        setVersion((value) => value + 1);
    };
    const timer = window.setInterval(
      refresh,
      view === "wallet" ? 10000 : 20000,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [view]);
  const info = (data && !Array.isArray(data) ? data : {}) as RecordsData;
  return (
    <>
      <p className="tag">TRUF community</p>
      <h1>
        {
          (
            {
              discover: "Find your next game.",
              matches: "Your matches.",
              payments: "Every payment, clear.",
              wallet: "Your money, clearly managed.",
              notifications: "Stay in the loop.",
              venues: "Your venues & slots.",
              "owner-bookings": "Manage match days.",
              moderation: "Approvals & operations.",
              settings: "Account & security.",
            } as Record<string, string>
          )[view]
        }
      </h1>
      {view === "discover" && <SmartSearch apply={setQuery} />}
      {view === "discover" && (
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            done();
            setQuery(
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
            <select name="sport">
              <option value="">All sports</option>
              {["Football", "Cricket", "Badminton"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Locality
            <input name="locality" placeholder="Your neighbourhood" />
          </label>
          <button className="primary">Find games</button>
        </form>
      )}
      {busy ? (
        <div className="empty" role="status">
          Loading…
        </div>
      ) : error ? (
        <div className="error" role="alert">
          {error}
          <button onClick={done}>Retry</button>
        </div>
      ) : (
        <>
          {info.matches && (
            <>
              <div className="cards">
                {info.matches.map((m) => (
                  <article className="card match-card" key={m.id}>
                    <div className="row between">
                      <span className="tag">{m.slot.area.sport}</span>
                      <span
                        className={"badge status-" + m.status.toLowerCase()}
                      >
                        {m.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <h2>{m.title}</h2>
                    <p className="muted">
                      {m.slot.area.venue.name} · {m.slot.area.venue.locality}
                      <br />
                      {date(m.slot.startsAt)}
                    </p>
                    <div className="row between">
                      <span>
                        {m._count.participations} / {m.capacity} paid ·{" "}
                        {money(m.sharePaise)} each
                      </span>
                      <Link
                        className="button primary"
                        href={"/matches/" + m.id}
                      >
                        View match →
                      </Link>
                    </div>
                    {view === "owner-bookings" && m.status === "REQUESTED" && (
                      <ActionForm
                        title="Approve hold"
                        kind="approve"
                        extra={{ id: m.id }}
                        fields={[
                          {
                            name: "deadline",
                            label:
                              "Recruitment deadline (at least 1 hour before play)",
                            type: "datetime-local",
                          },
                        ]}
                        done={done}
                      />
                    )}
                  </article>
                ))}
              </div>
              {!info.matches.length && (
                <div className="empty">
                  No matches to show. Explore available games or adjust your
                  filters.
                </div>
              )}
            </>
          )}
          {view === "discover" && (
            <section style={{ marginTop: 30 }}>
              <h2>Start a match</h2>
              <p className="muted">
                Choose an available slot. The owner approves your hold before
                anyone pays.
              </p>
              {info.slots?.length ? (
                <ActionForm
                  title="Create a match"
                  kind="match"
                  fields={[
                    {
                      name: "slotId",
                      label: "Available slot",
                      options: info.slots.map((s) => ({
                        value: s.id,
                        label:
                          s.area.venue.name +
                          " · " +
                          s.area.sport +
                          " · " +
                          date(s.startsAt) +
                          " · " +
                          money(s.pricePaise),
                      })),
                    },
                    { name: "title", label: "Match title" },
                    {
                      name: "capacity",
                      label: "Total players (even number; badminton 2 or 4)",
                      type: "number",
                      value: "12",
                    },
                    {
                      name: "visibility",
                      label: "Who can join?",
                      options: [
                        { value: "PUBLIC", label: "Public community match" },
                        { value: "PRIVATE", label: "Private invitation" },
                      ],
                    },
                  ]}
                  done={done}
                />
              ) : (
                <div className="empty">
                  No available slots. Owners need to publish future
                  availability.
                </div>
              )}
            </section>
          )}
          {view === "payments" && (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Captured</th>
                    <th>Amount</th>
                    <th>Refunds</th>
                  </tr>
                </thead>
                <tbody>
                  {(data as Payment[])?.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link
                          href={"/matches/" + p.order.participation.match.id}
                        >
                          {p.order.participation.match.title}
                        </Link>
                      </td>
                      <td>{date(p.capturedAt)}</td>
                      <td>{money(p.amountPaise)}</td>
                      <td>
                        {p.refunds.map((r) => (
                          <p key={r.id}>
                            {money(r.amountPaise)} · {r.status}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(data as Payment[])?.length && (
                <p className="empty">No captured payments.</p>
              )}
            </div>
          )}
          {view === "wallet" && (
            <WalletPanel data={data as WalletData} done={done} />
          )}
          {view === "notifications" && (
            <div className="cards">
              {(data as Notice[])?.map((n) => (
                <article className="card" key={n.id}>
                  <h2>{n.title}</h2>
                  <p>{n.body}</p>
                  <div className="row">
                    <Link className="button" href={n.href}>
                      View
                    </Link>
                    {!n.readAt && (
                      <ActionButton
                        body={{ action: "read", id: n.id }}
                        done={done}
                      >
                        Mark read
                      </ActionButton>
                    )}
                  </div>
                </article>
              ))}
              {!(data as Notice[])?.length && (
                <div className="empty">You are all caught up.</div>
              )}
            </div>
          )}
          {view === "settings" && (
            <>
              <div className="cards">
                <ActionForm
                  title="Update profile"
                  kind="profile"
                  extra={{ sports: info.sports || [] }}
                  fields={[
                    { name: "name", label: "Name", value: info.name },
                    {
                      name: "locality",
                      label: "Locality",
                      value: info.locality,
                      required: false,
                    },
                  ]}
                  done={done}
                />
                <ActionForm
                  title={
                    info.accountType === "OWNER"
                      ? "Register your turf business"
                      : "Apply as a turf owner"
                  }
                  kind="organization"
                  fields={[{ name: "name", label: "Business name" }]}
                  done={done}
                />
              </div>
              <p className="muted">{info.email}</p>
              {info.memberships?.map((m) => (
                <p key={m.organization.id}>
                  {m.organization.name} · {m.organization.status}
                </p>
              ))}
              <MFA enabled={info.twoFactorEnabled} />
              {info.memberships
                ?.filter((m) => m.organization.status === "APPROVED")
                .map((m) => (
                  <div className="cards" key={m.organization.id}>
                    <ActionForm
                      title={"Add venue to " + m.organization.name}
                      kind="venue"
                      extra={{ organizationId: m.organization.id }}
                      fields={[
                        { name: "name", label: "Venue name" },
                        { name: "locality", label: "Locality" },
                        { name: "address", label: "Address" },
                      ]}
                      done={done}
                    />
                    <ActionForm
                      title="Add verified staff member"
                      kind="staff"
                      extra={{ organizationId: m.organization.id }}
                      fields={[
                        { name: "email", label: "Staff email", type: "email" },
                      ]}
                      done={done}
                    />
                  </div>
                ))}
            </>
          )}
          {view === "venues" &&
            (data as Venue[])?.map((v) => (
              <section key={v.id} className="card" style={{ marginBottom: 20 }}>
                <h2>{v.name}</h2>
                <p className="badge">
                  {v.approved ? "Approved" : "Awaiting admin approval"}
                </p>
                <ActionForm
                  title="Add playing area"
                  kind="area"
                  extra={{ venueId: v.id }}
                  fields={[
                    { name: "name", label: "Area name" },
                    {
                      name: "sport",
                      label: "Sport",
                      options: ["Football", "Cricket", "Badminton"].map(
                        (s) => ({ value: s, label: s }),
                      ),
                    },
                  ]}
                  done={done}
                />
                {v.areas.map((a) => (
                  <div key={a.id}>
                    <h3>
                      {a.name} · {a.sport}
                    </h3>
                    <ActionForm
                      title="Publish 60-minute slot"
                      kind="slot"
                      extra={{ areaId: a.id }}
                      fields={[
                        {
                          name: "startsAt",
                          label: "Starts at (your local time)",
                          type: "datetime-local",
                        },
                        {
                          name: "pricePaise",
                          label: "Total price in paise (₹1 = 100 paise)",
                          type: "number",
                        },
                      ]}
                      done={done}
                    />
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Starts at</th>
                            <th>Price</th>
                            <th>Status / action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.slots.map((s) => (
                            <tr key={s.id}>
                              <td>{date(s.startsAt)}</td>
                              <td>{money(s.pricePaise)}</td>
                              <td>
                                {s.booking ? (
                                  "Reserved · " + s.booking.source
                                ) : (
                                  <div className="row">
                                    <ActionButton
                                      body={{
                                        action: "closure",
                                        id: s.id,
                                        blocked: !s.blocked,
                                      }}
                                      done={done}
                                    >
                                      {s.blocked
                                        ? "Reopen"
                                        : "Close for maintenance"}
                                    </ActionButton>
                                    {!s.blocked && (
                                      <ActionButton
                                        body={{
                                          action: "offline",
                                          id: s.id,
                                          note: "Owner recorded offline booking",
                                        }}
                                        done={done}
                                      >
                                        Reserve offline
                                      </ActionButton>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </section>
            ))}
          {view === "moderation" && (
            <>
              <h2>Organizations</h2>
              <div className="cards">
                {info.organizations?.map((o) => (
                  <article className="card" key={o.id}>
                    <h3>{o.name}</h3>
                    <p>{o.status}</p>
                    {o.status === "PENDING" && (
                      <ActionButton
                        body={{ action: "approve-organization", id: o.id }}
                        done={done}
                      >
                        Approve organization
                      </ActionButton>
                    )}
                    {o.venues.map((v) => (
                      <p key={v.id}>
                        {v.name}{" "}
                        {v.approved ? (
                          "· Approved"
                        ) : (
                          <ActionButton
                            body={{ action: "approve-venue", id: v.id }}
                            done={done}
                          >
                            Approve venue
                          </ActionButton>
                        )}
                      </p>
                    ))}
                  </article>
                ))}
              </div>
              <h2>Background operations</h2>
              {info.jobs?.length ? (
                info.jobs.map((j) => (
                  <p className="error" key={j.id}>
                    {j.kind} · {j.status} · {j.error}
                  </p>
                ))
              ) : (
                <p className="muted">No failed or running jobs.</p>
              )}
              <h2>Accounts</h2>
              {info.users?.map((u) => (
                <p key={u.id}>
                  {u.name} · {u.email}{" "}
                  <ActionButton
                    body={{
                      action: "suspend",
                      id: u.id,
                      suspended: !u.suspended,
                    }}
                    done={done}
                  >
                    {u.suspended ? "Restore account" : "Suspend"}
                  </ActionButton>
                </p>
              ))}
              <details>
                <summary>Recent audit history</summary>
                {info.audit?.map((a) => (
                  <p key={a.id}>
                    {date(a.createdAt)} · {a.action}
                  </p>
                ))}
              </details>
            </>
          )}
        </>
      )}
    </>
  );
}
