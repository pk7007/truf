import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
const inter = localFont({
  src: "./fonts/Inter-Variable.ttf",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.BETTER_AUTH_URL || "https://truf-red.vercel.app",
  ),
  title: {
    default: "TRUF · Find your game",
    template: "%s · TRUF",
  },
  description:
    "Your sports community. Find matches, book together, and keep playing.",
  openGraph: {
    type: "website",
    siteName: "TRUF",
    title: "TRUF · Find your game",
    description:
      "Find local sports matches, book together, and build a playing habit.",
  },
  twitter: {
    card: "summary",
    title: "TRUF · Find your game",
    description:
      "Find local sports matches, book together, and build a playing habit.",
  },
  robots: { index: true, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="site-body">{children}</div>
        <footer className="site-footer">
          <span className="footer-brand">
            TRUF<span className="accent">.</span>
          </span>
          <span>
            © {new Date().getFullYear()} TRUF Innovators. All rights reserved.
          </span>
          <span className="footer-motto">
            Find your people. Play your sport.
          </span>
          <nav aria-label="Footer">
            <Link href="/help">Help & booking policies</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/credits">Credits & licenses</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
