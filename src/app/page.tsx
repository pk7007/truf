import Link from "next/link";
import { ArrowRight, Users, CalendarCheck, Trophy } from "lucide-react";
import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};
export default function Home() {
  return (
    <main className="hero">
      <div className="row between">
        <Link className="brand" href="/">
          TRUF.
        </Link>
        <div className="row">
          <Link href="/help">How it works</Link>
          <Link className="button" href="/login">
            Sign in
          </Link>
        </div>
      </div>
      <div className="hero-split">
        <section>
          <p className="tag">Your local sports community</p>
          <h1>
            Good games start
            <br />
            with <span className="accent">great company.</span>
          </h1>
          <p className="lead">
            Find players who love your sport. Organise your next match, share
            the booking, and build a habit that lasts.
          </p>
          <div className="row">
            <Link className="button primary" href="/register">
              Find your game{" "}
              <ArrowRight
                size={16}
                style={{ display: "inline", verticalAlign: "middle" }}
              />
            </Link>
            <Link className="button" href="/login/owner">
              Manage a venue
            </Link>
          </div>
        </section>
        <aside
          className="pitch-card"
          aria-label="Sports community illustration"
        >
          <p className="tag">Make time to play</p>
          <h2>A place for every player.</h2>
          <div className="pitch" aria-hidden="true">
            {[
              [18, 25],
              [18, 70],
              [38, 45],
              [62, 25],
              [62, 70],
              [82, 45],
            ].map(([left, top], i) => (
              <span
                key={i}
                className="pitch-player"
                style={{ left: left + "%", top: top + "%" }}
              />
            ))}
          </div>
          <div className="sport-chips">
            <span>Football</span>
            <span>Cricket</span>
            <span>Badminton</span>
          </div>
          <p className="muted">
            One community. More reasons to get out and play.
          </p>
        </aside>
      </div>
      <div className="cards">
        <article className="card">
          <Users size={24} className="accent" />
          <h2>Find your team</h2>
          <p className="muted">
            Discover community games or invite your friends to a private match.
          </p>
        </article>
        <article className="card">
          <CalendarCheck size={24} className="accent" />
          <h2>Book with clarity</h2>
          <p className="muted">
            Owners approve the slot hold. Players pay their share. A full team
            confirms the booking.
          </p>
        </article>
        <article className="card">
          <Trophy size={24} className="accent" />
          <h2>Make every game count</h2>
          <p className="muted">
            Verified attendance builds your playing record, weekly streaks, and
            non-cash rewards.
          </p>
        </article>
        <article className="card">
          <h2>Built for turf owners, too.</h2>
          <p className="muted">
            Manage availability, review booking requests, record attendance, and
            understand your venue’s activity.
          </p>
          <Link href="/help" className="accent">
            Explore the booking process →
          </Link>
        </article>
      </div>
      <p className="muted">
        Pilot version · Test payments only. Booking and refund policies are
        available in our{" "}
        <Link href="/help" className="accent">
          help centre
        </Link>
        .
      </p>
    </main>
  );
}
