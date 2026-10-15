"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { isPortal } from "./login-portals";
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const portal = window.location.pathname.split("/")[2];
        window.location.assign(
          new URL(
            "/two-factor" + (isPortal(portal) ? `?portal=${portal}` : ""),
            window.location.origin,
          ).href,
        );
      },
    }),
  ],
});
