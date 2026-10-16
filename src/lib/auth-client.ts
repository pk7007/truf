"use client";
import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins";
import { isPortal } from "./login-portals";
import type { auth } from "@/server/auth";
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
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
