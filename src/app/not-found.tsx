import Link from "next/link";
export default function NotFound() {
  return (
    <main className="hero">
      <h1>Page not found.</h1>
      <Link href="/app/discover" className="button primary">
        Back to games
      </Link>
    </main>
  );
}
