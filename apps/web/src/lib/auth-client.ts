import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  plugins: [magicLinkClient()],
});

export const {
  // authClient.signIn.magicLink({ email, callbackURL }) is the entire sign-in
  // and sign-up surface — there is no password on this account model. It
  // creates the account on first use, so a separate `signUp` isn't needed.
  signIn,
  signOut,
  useSession,
  updateUser,
  deleteUser,
} = authClient;
