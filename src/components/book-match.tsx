"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/rules";
import { action, date } from "./records";

type Quote = {
  myId: string;
  walletBalancePaise: number;
  sharePaise: number;
  title: string;
  status: string;
  capacity: number;
  deadline: string | null;
  slot: { startsAt: string; area: { sport: string; venue: { name: string } } };
  participations: { userId: string; status: string }[];
};
export function BookMatch({
  id,
  status,
  done,
}: {
  id: string;
  status: string;
  done: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [paid, setPaid] = useState(false);
  const [quotedAt, setQuotedAt] = useState(0);
  const already = quote?.participations.some(
    (p) =>
      p.userId === quote.myId &&
      ["PAID", "WAITING_REPLACEMENT"].includes(p.status),
  );
  const places = quote
    ? Math.max(
        0,
        quote.capacity -
          quote.participations.filter((p) => p.status === "PAID").length,
      )
    : 0;
  const eligible =
    quote &&
    !already &&
    places > 0 &&
    new Date(quote.slot.startsAt).getTime() > quotedAt &&
    ((quote.status === "RECRUITING" &&
      quote.deadline &&
      new Date(quote.deadline).getTime() > quotedAt) ||
      (quote.status === "CONFIRMED" &&
        quote.participations.some((p) => p.status === "WAITING_REPLACEMENT")));
  async function open() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/data?id=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setQuote(data);
      setQuotedAt(Date.now());
      dialog.current?.showModal();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load booking.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (submitting.current || !eligible) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action({ action: "wallet-pay", id });
      setPaid(true);
      setMessage(
        "Your place is paid. The game confirms when the required roster is complete.",
      );
      dialog.current?.close();
      done();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={
          busy ||
          paid ||
          status === "REQUESTED" ||
          !["RECRUITING", "CONFIRMED"].includes(status)
        }
      >
        {paid || already
          ? "Already booked"
          : status === "REQUESTED"
            ? "Awaiting owner approval"
            : busy
              ? "Loading…"
              : "Book match"}
      </button>
      {paid && <Link href={`/matches/${id}`}>View my match</Link>}
      {message && <p role="status">{message}</p>}
      <dialog
        ref={dialog}
        aria-labelledby={`booking-${id}`}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        {quote && (
          <div className="card">
            <h2 id={`booking-${id}`}>Confirm your place</h2>
            <p>
              {quote.title} · {quote.slot.area.sport}
            </p>
            <p>
              {quote.slot.area.venue.name} · {date(quote.slot.startsAt)}
            </p>
            <p>
              {places} places available · Full share: {money(quote.sharePaise)}
            </p>
            <p>Wallet balance: {money(quote.walletBalancePaise)}</p>
            {quote.walletBalancePaise >= quote.sharePaise ? (
              <p>
                Balance after booking:{" "}
                {money(quote.walletBalancePaise - quote.sharePaise)}
              </p>
            ) : (
              <p>
                You need {money(quote.sharePaise - quote.walletBalancePaise)}{" "}
                more. <Link href="/app/wallet">Add money</Link>
              </p>
            )}
            <p>
              Full refund before match confirmation. After confirmation, a
              refund is issued when a paid substitute fills your place. Owner
              cancellation or an incomplete match at its deadline triggers a
              full refund.
            </p>
            {!eligible && (
              <p>
                {already
                  ? "You already have a commitment for this game."
                  : "This game is not currently accepting bookings."}
              </p>
            )}
            {message && <p role="alert">{message}</p>}
            <div className="row">
              <button disabled={busy} onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  !eligible ||
                  quote.walletBalancePaise < quote.sharePaise
                }
                onClick={confirm}
              >
                {busy ? "Processing…" : "Confirm & pay"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
