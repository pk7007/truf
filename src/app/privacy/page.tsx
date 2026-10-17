import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How the TRUF pilot handles account, booking, payment, and sports activity data.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className="hero prose-page">
      <Link className="brand" href="/">
        TRUF.
      </Link>
      <p className="tag">Privacy notice · Pilot</p>
      <h1>Your data supports your game.</h1>
      <p className="lead">
        This notice explains the information used by the TRUF pilot and why it
        is needed.
      </p>
      <section className="card">
        <h2>Information we use</h2>
        <p>
          TRUF stores account details, sports and locality preferences,
          organization membership, booking activity, attendance, notifications,
          and security records. Payment providers process payment credentials;
          TRUF records transaction references, amounts, and statuses rather than
          complete card or bank credentials.
        </p>
      </section>
      <section className="card">
        <h2>How it is used</h2>
        <p>
          We use this information to authenticate accounts, match players with
          games, manage venue bookings, calculate attendance and rewards,
          support refunds, produce role-scoped reports, prevent misuse, and
          investigate operational problems.
        </p>
      </section>
      <section className="card">
        <h2>Who can see it</h2>
        <p>
          Players see their own activity and the details needed to join a match.
          Approved owners and staff see records for their organization.
          Administrators see records needed to operate and audit the pilot.
          Service providers receive only the information required to provide
          hosting, email, and payment services.
        </p>
      </section>
      <section className="card">
        <h2>Control and retention</h2>
        <p>
          Access is protected by account permissions and audit records.
          Operational and financial records may be retained for reconciliation,
          security, and legal obligations. Pilot participants can ask the
          project team or their pilot coordinator to review or correct their
          profile data.
        </p>
      </section>
      <p className="muted">Last updated: 17 October 2026.</p>
      <div className="row">
        <Link className="button primary" href="/">
          Back to TRUF
        </Link>
        <Link className="button" href="/terms">
          Read the terms
        </Link>
      </div>
    </main>
  );
}
