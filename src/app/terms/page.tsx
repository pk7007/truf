import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pilot terms",
  description:
    "Terms for using the TRUF sports community and turf-booking pilot.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="hero prose-page">
      <Link className="brand" href="/">
        TRUF.
      </Link>
      <p className="tag">Terms of use · Pilot</p>
      <h1>Play fairly. Book responsibly.</h1>
      <p className="lead">
        These terms apply to the TRUF demonstration and controlled pilot.
      </p>
      <section className="card">
        <h2>Accounts and roles</h2>
        <p>
          Provide accurate information, protect your sign-in credentials, and
          use only the access assigned to you. Owner and administrator access
          requires approval. Administrators may suspend access to protect
          participants or investigate misuse.
        </p>
      </section>
      <section className="card">
        <h2>Bookings, cancellations, and attendance</h2>
        <p>
          A booking confirms only after the venue hold is valid and the required
          player shares are captured. Incomplete matches expire at their
          approved deadline. Owner cancellations initiate full refunds. After
          confirmation, a withdrawing player receives a refund when a paid
          substitute fills the place. Venue rules and safe conduct remain the
          responsibility of participants and facility operators.
        </p>
      </section>
      <section className="card">
        <h2>Payments and wallet</h2>
        <p>
          The demonstration uses test payments and fictional data. Live money
          movement requires an approved payment provider and verified merchant
          accounts. Wallet balances, refunds, fees, transfers, and settlements
          remain separate records. Points and badges have no cash value and
          cannot be transferred.
        </p>
      </section>
      <section className="card">
        <h2>Availability and acceptable use</h2>
        <p>
          Do not attempt unauthorized access, manipulate bookings or attendance,
          harass participants, or interfere with the service. Pilot features may
          change while they are tested. Report account, booking, or payment
          concerns to the project team or pilot coordinator.
        </p>
      </section>
      <p className="muted">Last updated: 17 October 2026.</p>
      <div className="row">
        <Link className="button primary" href="/">
          Back to TRUF
        </Link>
        <Link className="button" href="/privacy">
          Read the privacy notice
        </Link>
      </div>
    </main>
  );
}
