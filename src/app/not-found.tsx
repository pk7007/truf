import Link from "next/link";
export default function NotFound() {
  return (
    <main className="hero">
      <h1>Page not found.</h1>
      <Link href="/" className="button primary">
        Go to the homepage
      </Link>
    </main>
  );
}
