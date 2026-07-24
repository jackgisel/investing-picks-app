import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type ServerSessionUser = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Resolves the current authenticated user from request headers (cookies).
 * Returns null if not signed in. Designed for use inside Route Handlers.
 */
export async function getServerUser(): Promise<ServerSessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}
