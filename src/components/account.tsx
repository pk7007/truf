"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { QRCodeSVG } from "qrcode.react";
import { portals, type Portal } from "@/lib/login-portals";
export function Account({
  mode,
  localMail = false,
  unavailable,
  portal,
}: {
  mode: string;
  localMail?: boolean;
  unavailable?: string;
  portal?: Portal;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const title =
    mode === "register"
      ? "Join the community"
      : mode === "forgot-password"
        ? "Reset your password"
        : mode === "reset-password"
          ? "Choose a new password"
          : mode === "two-factor"
            ? "Verify your sign-in"
            : portal
              ? portals[portal].title
              : "Welcome back";
  const destination = "/auth/continue" + (portal ? `?portal=${portal}` : "");
  return (
    <main className={`auth ${portal ? `portal-${portal}` : ""}`}>
      <Link className="brand" href="/">
        TRUF
      </Link>
      <p className="tag">
        {portal
          ? `${portals[portal].label} portal`
          : "Your next game starts here"}
      </p>
      <h1>{title}</h1>
      {portal && <p className="muted">{portals[portal].description}</p>}
      {portal === "admin" && (
        <p className="portal-note">
          Administrator access is invitation-only. Authenticator verification is
          required for admin operations.
        </p>
      )}
      {portal === "owner" && (
        <p className="portal-note">
          Use the email linked to your approved owner or staff account.
        </p>
      )}
      {unavailable && (
        <p role="status" className="muted">
          {unavailable}
        </p>
      )}
      {localMail && (
        <p className="muted">
          Local development: verification and recovery emails are saved as files
          in <code>.data/mail</code>. Open the link in the latest file to
          continue. No email is sent externally.
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (unavailable) return;
          setBusy(true);
          setError("");
          setNotice("");
          const f = new FormData(e.currentTarget);
          try {
            const email = String(f.get("email") || ""),
              password = String(f.get("password") || "");
            const result =
              mode === "register"
                ? await authClient.signUp.email({
                    email,
                    password,
                    name: String(f.get("name")),
                    callbackURL: "/app/discover",
                  })
                : mode === "forgot-password"
                  ? await authClient.requestPasswordReset({
                      email,
                      redirectTo:
                        "/reset-password" + (portal ? `?portal=${portal}` : ""),
                    })
                  : mode === "reset-password"
                    ? await authClient.resetPassword({
                        newPassword: password,
                        token:
                          new URLSearchParams(location.search).get("token") ||
                          "",
                      })
                    : mode === "two-factor"
                      ? await authClient.twoFactor.verifyTotp({
                          code: String(f.get("code")).replace(/\s/g, ""),
                        })
                      : await authClient.signIn.email({
                          email,
                          password,
                          callbackURL: destination,
                        });
            if (result.error) throw Error(result.error.message);
            if (mode === "register")
              setNotice(
                "Check your email to verify your account before signing in.",
              );
            else if (mode === "forgot-password")
              setNotice(
                "If this account exists, a reset link will be emailed.",
              );
            else if (mode === "reset-password")
              setNotice("Password updated. You can now sign in.");
            else if (mode === "two-factor") {
              router.replace(destination);
              router.refresh();
            } else if (!("twoFactorRedirect" in (result.data || {}))) {
              router.replace(destination);
              router.refresh();
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Request failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "register" && (
          <label>
            Your name
            <input name="name" required minLength={2} autoComplete="name" />
          </label>
        )}
        {!["two-factor", "reset-password"].includes(mode) && (
          <label>
            Email
            <input type="email" name="email" required autoComplete="email" />
          </label>
        )}
        {!["two-factor", "forgot-password"].includes(mode) && (
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              minLength={12}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            <small>At least 12 characters</small>
          </label>
        )}
        {mode === "two-factor" && (
          <label>
            Authenticator code
            <input
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
            />
          </label>
        )}
        <button className="primary" disabled={busy || !!unavailable}>
          {busy
            ? "Please wait…"
            : mode === "register"
              ? "Create account"
              : mode === "login"
                ? "Sign in"
                : "Continue"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <div className="row" style={{ marginTop: 24 }}>
        <Link href="/login">Choose another portal</Link>
        {(!portal || portal === "player") && (
          <Link href="/register">Create an account</Link>
        )}
        <Link
          href={
            portal ? `/forgot-password?portal=${portal}` : "/forgot-password"
          }
        >
          Forgot password?
        </Link>
      </div>
    </main>
  );
}
export function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
export function MFA({ enabled = false }: { enabled?: boolean }) {
  const router = useRouter();
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(enabled);
  const setupKey = uri ? new URL(uri).searchParams.get("secret") || "" : "";
  return (
    <section className="card">
      <h2>Two-factor authentication</h2>
      <p className="muted">
        Required for administrators. Store recovery codes securely.
      </p>
      {verified ? (
        <p className="success" role="status">
          Two-factor authentication is enabled. Your account has an extra layer
          of protection.
        </p>
      ) : !uri ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const password = String(
              new FormData(e.currentTarget).get("password"),
            );
            setBusy(true);
            setMessage("");
            try {
              const r = await authClient.twoFactor.enable({ password });
              if (r.error)
                setMessage(r.error.message || "Unable to start setup.");
              else if (r.data && "totpURI" in r.data) {
                setUri(r.data.totpURI);
                setCodes(r.data.backupCodes);
              }
            } catch {
              setMessage(
                "Could not start setup. Check your connection and try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Start setup once. Starting again replaces any unfinished setup key.
          </p>
          <label>
            Current password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button disabled={busy}>
            {busy ? "Preparing…" : "Set up authenticator"}
          </button>
        </form>
      ) : (
        <>
          <div className="mfa-guide">
            <div className="mfa-qr">
              <QRCodeSVG
                value={uri}
                size={180}
                marginSize={4}
                title="Scan with your authenticator app"
              />
            </div>
            <div>
              <h3>Scan to connect your authenticator</h3>
              <p>
                Open your phone’s authenticator app, add an account, and scan
                this QR code. Then enter the six-digit code shown in the app
                below.
              </p>
              <p className="muted">
                No code is sent by email or SMS. You can also use the manual
                setup key.
              </p>
            </div>
          </div>
          <ol>
            <li>
              In your authenticator app, add an account using a setup key.
            </li>
            <li>
              Name it TRUF and choose <strong>Time based</strong>.
            </li>
            <li>
              Copy the key below into the app. Use this latest entry if you
              started setup before.
            </li>
            <li>Enter the six-digit code generated by that app below.</li>
          </ol>
          <label>
            Manual setup key
            <input
              readOnly
              value={setupKey}
              autoComplete="off"
              spellCheck={false}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <p className="muted">
            Keep this key private. The setup key and recovery codes are not the
            six-digit authenticator code. Keep this page open until verification
            succeeds.
          </p>
          <details>
            <summary>Show setup URI for compatible apps</summary>
            <code style={{ overflowWrap: "anywhere" }}>{uri}</code>
          </details>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const code = String(
                new FormData(e.currentTarget).get("code") || "",
              ).replace(/\s/g, "");
              if (!/^[0-9]{6}$/.test(code)) {
                setMessage(
                  "Enter the six-digit code from your authenticator app.",
                );
                return;
              }
              setBusy(true);
              setMessage("");
              try {
                const r = await authClient.twoFactor.verifyTotp({ code });
                if (r.error)
                  setMessage(
                    r.error.message === "Invalid code"
                      ? "Code not accepted. Use the latest TRUF setup key, enable automatic date and time on your phone and computer, then try a fresh six-digit code. Do not restart setup."
                      : r.error.message || "Verification failed.",
                  );
                else {
                  setVerified(true);
                  setUri("");
                  router.refresh();
                }
              } catch {
                setMessage(
                  "Could not verify the code. Check your connection and try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Authenticator code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                required
              />
            </label>
            <button disabled={busy}>
              {busy ? "Verifying…" : "Verify setup"}
            </button>
          </form>
        </>
      )}
      {codes.length > 0 && (
        <details>
          <summary>Show recovery codes — save securely</summary>
          {codes.map((code) => (
            <p key={code}>
              <code>{code}</code>
            </p>
          ))}
        </details>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
