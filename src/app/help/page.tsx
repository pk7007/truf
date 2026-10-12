import Link from "next/link";
export const metadata = { title: "Help & booking policies · TRUF" };
export default function Help() {
  return (
    <main className="hero prose-page">
      <Link className="brand" href="/app/discover">
        TRUF.
      </Link>
      <p className="tag">Help centre</p>
      <h1>A clear path to your next game.</h1>
      <p className="lead">
        Understand bookings, payments, and account security before you play.
      </p>
      <section className="card">
        <h2>Booking a match</h2>
        <ol>
          <li>
            Choose an available slot in Discover games and create a public or
            private match.
          </li>
          <li>
            The venue owner reviews the request and approves a recruitment
            deadline.
          </li>
          <li>
            Each player pays their displayed share. The booking confirms once
            the required payments are captured.
          </li>
          <li>
            After the game, venue staff record attendance. Verified attendance
            updates player progress.
          </li>
        </ol>
        <p>
          Owner approval and a full team are required. Attendance is not
          guaranteed.
        </p>
      </section>
      <section className="card">
        <h2>Cancellations and refunds</h2>
        <p>
          Before confirmation, withdrawing starts a full refund. After
          confirmation, a refund starts when a paid substitute fills your place.
          If the owner cancels, or an incomplete match reaches its deadline,
          full refunds are initiated.
        </p>
        <p>
          Refund completion depends on the payment provider. Check My payments
          for the recorded status.
        </p>
      </section>
      <section className="card">
        <h2>Set up your authenticator</h2>
        <p>
          Under Account & security, enter your password and start setup once.
          Scan the QR code using an authenticator app on your phone, or add the
          manual key as a time-based account. Enter the fresh six-digit code
          displayed in the app to verify.
        </p>
        <p>
          Codes are not sent by email or SMS. Keep automatic date and time
          enabled on your devices. Starting setup again replaces an unfinished
          key. Keep setup keys and recovery codes private.
        </p>
      </section>
      <section className="card">
        <h2>About this pilot</h2>
        <p>
          Payments are test-only. Sample records are labelled as development
          data. Rewards are non-cash points and badges; they cannot be
          transferred or redeemed for money. Reporting dates and streak weeks
          use India Standard Time.
        </p>
        <p>
          This local installation stores account and booking records on the host
          computer. Production services and payment-provider approval are
          required before a public launch.
        </p>
      </section>
      <Link className="button primary" href="/app/discover">
        Back to TRUF
      </Link>
    </main>
  );
}
