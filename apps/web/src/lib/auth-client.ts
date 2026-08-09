import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  updateUser,
  changePassword,
  deleteUser,
  // The recovery path for a verification link that was lost, expired, or never
  // arrived. Better-auth has always exposed the endpoint; nothing in the app
  // called it, so an unverified account had no way back and could never pay.
  sendVerificationEmail,
} = authClient;
