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
type Data = {
  matches?: Match[];
  slots?: Slot[];
  name?: string;
  email?: string;
  twoFactorEnabled?: boolean;
  locality?: string;
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
export function Records({ view }: { view: string }) {
  const urlQuery = useSearchParams().toString();
  const [data, setData] = useState<
      Data | Venue[] | Payment[] | Notice[] | null
    >(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [version, setVersion] = useState(0),
    [query, setQuery] = useState("");
  const done = () => setVersion((v) => v + 1);
  useEffect(() => {
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
  }, [view, version, query, urlQuery]);
  const info = (data && !Array.isArray(data) ? data : {}) as Data;
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
                  title="Apply as a turf owner"
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
