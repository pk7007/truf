"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="hero">
      <h1>Something went wrong.</h1>
      <p>
        We could not load this page. Your data has not been replaced with demo
        values.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
