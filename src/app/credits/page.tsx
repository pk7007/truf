import Link from "next/link";
export const metadata = {
  title: "Credits & licenses",
  description:
    "TRUF project team, typography, and open-source acknowledgements.",
  alternates: { canonical: "/credits" },
};
export default function Credits() {
  return (
    <main className="hero prose-page">
      <Link className="brand" href="/">
        TRUF.
      </Link>
      <p className="tag">Made for the sports community</p>
      <h1>TRUF Innovators.</h1>
      <section className="card">
        <h2>Project team</h2>
        <p>
          Praveen Keshavan
          <br />S Evandle Benni
        </p>
        <p>Sports Technology · Turf Booking · Smart Scheduling</p>
        <p>
          © {new Date().getFullYear()} TRUF Innovators. All rights reserved for
          original project materials. Third-party components remain subject to
          their respective licenses.
        </p>
      </section>
      <section className="card">
        <h2>Typography & open-source credits</h2>
        <p>
          The Inter typeface is sourced from{" "}
          <a href="https://fonts.google.com/specimen/Inter">Google Fonts</a> and
          bundled locally under the SIL Open Font License. Its license is
          included in the project’s font directory.
        </p>
        <p>
          TRUF uses Next.js, React, Prisma, Better Auth, Recharts, Lucide, and
          other open-source packages. Package licenses remain with their
          authors.
        </p>
      </section>
      <Link className="button" href="/help">
        Help & booking policies
      </Link>
    </main>
  );
}
